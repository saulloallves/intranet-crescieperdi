import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface UniversalRequest {
  message: string;
  module?: string;
  context?: any;
  field_name?: string;
  user_role?: string;
  conversation_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { 
      message, 
      module = 'general', 
      context, 
      field_name, 
      user_role,
      conversation_id 
    }: UniversalRequest = await req.json();

    console.log(`[GiraBot Universal] Module: ${module}, User Role: ${user_role}`);

    // Buscar configurações do GiraBot
    const { data: settings } = await supabase
      .from('girabot_settings')
      .select('*');

    const config: Record<string, any> = {};
    settings?.forEach(s => {
      // Manter valores como estão (JSONB vem como objeto)
      config[s.key] = s.value;
    });

    // Verificar se GiraBot está habilitado (lida com múltiplos formatos JSONB)
    const girabotEnabled = config['girabot_enabled'];
    let isEnabled = false;
    
    // Tentar parsear string JSON se necessário
    let enabledValue = girabotEnabled;
    if (typeof girabotEnabled === 'string') {
      try {
        enabledValue = JSON.parse(girabotEnabled);
      } catch {
        // Se não for JSON válido, tratar como string simples
        enabledValue = girabotEnabled;
      }
    }
    
    // Verificar valor após parse
    if (enabledValue === true || enabledValue === 'true') {
      isEnabled = true;
    } else if (typeof enabledValue === 'object' && enabledValue !== null) {
      isEnabled = enabledValue.enabled === true || enabledValue.enabled === 'true';
    }

    console.log('[GiraBot] Enabled check:', { 
      original: girabotEnabled, 
      parsed: enabledValue, 
      isEnabled, 
      type: typeof enabledValue 
    });
    
    if (!isEnabled) {
      return new Response(
        JSON.stringify({ error: 'GiraBot está desativado. Ative nas configurações.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar histórico de conversação se fornecido
    let conversationHistory: any[] = [];
    if (conversation_id) {
      const { data: history } = await supabase
        .from('ai_sessions')
        .select('question, response')
        .eq('id', conversation_id)
        .order('created_at', { ascending: true })
        .limit(10);

      if (history) {
        conversationHistory = history.flatMap(h => [
          { role: 'user', content: h.question },
          { role: 'assistant', content: h.response }
        ]);
      }
    }

    // Buscar contexto relevante via busca semântica
    let relevantContext = '';
    if (config.connect_with_search === 'true') {
      try {
        const { data: searchResults } = await supabase.rpc('match_search_embeddings' as any, {
          query_embedding: null,
          match_threshold: 0.7,
          match_count: 3
        });

        if (searchResults && searchResults.length > 0) {
          relevantContext = searchResults
            .map((r: any) => `- ${r.title}: ${r.content}`)
            .join('\n');
        }
      } catch (e) {
        console.log('[GiraBot] Search integration skipped:', e);
      }
    }

    // Buscar FAQs relacionados
    const { data: faqs } = await supabase
      .from('faq_training')
      .select('question, answer')
      .eq('context', module)
      .eq('active', true)
      .limit(5);

    const faqContext = faqs?.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n') || '';

    // Montar contexto específico do módulo
    let moduleContext = '';
    if (module === 'feed') {
      moduleContext = 'Módulo Feed - Sistema de comunicação interna com posts, likes e comentários.';
    } else if (module === 'training') {
      moduleContext = 'Módulo Treinamentos - Sistema de capacitação com trilhas, módulos e certificados.';
    } else if (module === 'checklist') {
      moduleContext = 'Módulo Rotinas - Sistema de checklists diários para controle operacional.';
    } else if (module === 'mural') {
      moduleContext = 'Módulo Mural - Sistema anônimo para compartilhar conquistas e pedir ajuda.';
    } else if (module === 'ideias') {
      moduleContext = 'Módulo Ideias - Sistema de inovação para submissão e votação de ideias.';
    }

    // Adicionar contexto de campo específico se fornecido
    if (field_name) {
      moduleContext += `\n\nCampo em questão: ${field_name}`;
      if (context) {
        moduleContext += `\nContexto adicional: ${JSON.stringify(context)}`;
      }
    }

    // Construir prompt do sistema
    let contextPrompt = config.girabot_context_prompt || 'Você é o GiraBot, assistente institucional.';
    if (typeof contextPrompt === 'object' && contextPrompt.prompt) {
      contextPrompt = contextPrompt.prompt;
    }
    
    const systemPrompt = `${contextPrompt}

PAPEL E CONTEXTO:
${moduleContext}

INFORMAÇÕES RELEVANTES:
${relevantContext}

FAQs RELACIONADAS:
${faqContext}

INSTRUÇÕES:
1. Responda de forma clara, concisa e profissional
2. Use o contexto fornecido para dar respostas precisas
3. Se não souber algo, admita e sugira onde procurar
4. Para perguntas sobre campos de formulário, seja específico e objetivo
5. Adapte sua resposta ao cargo do usuário: ${user_role || 'colaborador'}
6. Use emojis moderadamente para tornar a resposta mais amigável

Contexto atual da conversa:
${context ? JSON.stringify(context, null, 2) : 'Nenhum contexto adicional'}`;

    // Preparar mensagens
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory,
      { role: 'user', content: message }
    ];

    // Chamar Lovable AI Gateway (sem streaming)
    const startTime = Date.now();
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        temperature: (() => {
          const temp = config.girabot_temperature;
          if (typeof temp === 'object' && temp !== null && temp.temperature) {
            return parseFloat(temp.temperature);
          }
          if (typeof temp === 'string') return parseFloat(temp);
          if (typeof temp === 'number') return temp;
          return 0.7;
        })(),
        max_tokens: (() => {
          const depth = config.global_context_depth;
          if (typeof depth === 'object' && depth !== null && depth.depth) {
            return parseInt(depth.depth);
          }
          if (typeof depth === 'string') return parseInt(depth);
          if (typeof depth === 'number') return depth;
          return 4000;
        })(),
        stream: false, // Resposta JSON simples
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[GiraBot] AI Gateway error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Limite de uso excedido. Tente novamente em alguns minutos.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Créditos de IA esgotados. Contacte o administrador.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const data = await aiResponse.json();
    const reply = data.choices?.[0]?.message?.content || 'Erro ao processar resposta';
    const responseTime = Date.now() - startTime;

    // Obter usuário autenticado
    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      try {
        const token = authHeader.replace('Bearer ', '');
        const { data: { user } } = await supabase.auth.getUser(token);
        
        if (user) {
          // Salvar sessão completa
          await supabase.from('ai_sessions').insert({
            user_id: user.id,
            module: module || 'general',
            question: message,
            answer: reply,
            model_used: 'google/gemini-2.5-flash',
            tokens_used: data.usage?.total_tokens || 0,
            response_time_ms: responseTime
          });
        }
      } catch (sessionError) {
        console.error('[GiraBot] Error saving session:', sessionError);
      }
    }

    // Retornar resposta JSON
    return new Response(
      JSON.stringify({ reply }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GiraBot Universal] Error:', error);
    return new Response(
      JSON.stringify({ error: error.message || 'Erro ao processar solicitação' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
