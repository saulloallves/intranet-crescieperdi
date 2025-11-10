import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ContextualHelpRequest {
  field_name: string;
  field_type?: string;
  field_value?: any;
  module: string;
  form_data?: Record<string, any>;
  user_role?: string;
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
      field_name, 
      field_type = 'text', 
      field_value,
      module,
      form_data,
      user_role = 'colaborador'
    }: ContextualHelpRequest = await req.json();

    console.log(`[GiraBot Contextual] Field: ${field_name} in module: ${module}`);

    // Verificar se ajuda contextual está habilitada
    const { data: settings } = await supabase
      .from('ai_settings')
      .select('value')
      .eq('param', 'contextual_help_enabled')
      .single();

    if (settings?.value !== 'true') {
      return new Response(
        JSON.stringify({ error: 'Ajuda contextual desabilitada' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Buscar FAQs específicos para o campo
    const { data: faqs } = await supabase
      .from('faq_training')
      .select('question, answer')
      .ilike('question', `%${field_name}%`)
      .eq('context', module)
      .eq('active', true)
      .limit(3);

    const faqContext = faqs?.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n') || '';

    // Definir contextos por módulo
    const moduleContexts: Record<string, string> = {
      feed: 'Feed de comunicação interna - posts, likes e comentários',
      training: 'Sistema de treinamentos e capacitação',
      checklist: 'Rotinas e checklists operacionais',
      mural: 'Mural anônimo para compartilhar conquistas e pedir ajuda',
      ideias: 'Sistema de inovação para submissão de ideias',
      campaigns: 'Campanhas e metas comerciais',
      announcements: 'Comunicados oficiais da empresa',
      recognition: 'Sistema de reconhecimento de colaboradores',
    };

    // Prompt específico para ajuda contextual
    const prompt = `Você é o GiraBot, assistente da Cresci e Perdi. Forneça ajuda contextual sobre este campo de formulário:

CAMPO: ${field_name}
TIPO: ${field_type}
MÓDULO: ${moduleContexts[module] || module}
CARGO DO USUÁRIO: ${user_role}
${field_value ? `VALOR ATUAL: ${JSON.stringify(field_value)}` : ''}
${form_data ? `DADOS DO FORMULÁRIO: ${JSON.stringify(form_data, null, 2)}` : ''}

${faqContext ? `FAQs RELACIONADAS:\n${faqContext}\n` : ''}

INSTRUÇÕES:
1. Explique de forma clara e concisa o propósito deste campo
2. Forneça exemplos práticos quando relevante
3. Mencione validações ou requisitos importantes
4. Se houver erro no valor atual, explique o problema
5. Dê dicas de preenchimento baseadas no cargo do usuário
6. Seja breve (máximo 3 parágrafos)
7. Use emojis para tornar a explicação mais amigável

Responda de forma direta e prática.`;

    // Chamar Lovable AI Gateway
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { 
            role: 'system', 
            content: 'Você é um assistente especializado em ajudar usuários a preencher formulários. Seja claro, direto e útil.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.5,
        max_tokens: 1000,
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[GiraBot Contextual] AI error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ 
            help_text: 'Sistema de ajuda temporariamente indisponível. Tente novamente em alguns minutos.',
            suggestions: []
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      throw new Error(`AI Gateway error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const helpText = aiData.choices[0].message.content;

    // Gerar sugestões automáticas baseadas no campo
    let suggestions: string[] = [];
    
    // Sugestões específicas por tipo de campo
    if (field_type === 'select' && field_name.includes('category')) {
      suggestions = ['Operacional', 'Vendas', 'Marketing', 'RH', 'Financeiro'];
    } else if (field_type === 'select' && field_name.includes('priority')) {
      suggestions = ['Baixa', 'Média', 'Alta', 'Urgente'];
    } else if (field_name.includes('title') || field_name.includes('titulo')) {
      suggestions = [
        'Seja claro e objetivo',
        'Use até 60 caracteres',
        'Inclua palavras-chave relevantes'
      ];
    } else if (field_name.includes('description') || field_name.includes('descricao')) {
      suggestions = [
        'Detalhe o contexto completo',
        'Adicione informações relevantes',
        'Seja específico sobre o que espera'
      ];
    }

    // Registrar interação
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      await supabase.from('ai_sessions').insert({
        user_id: user.id,
        module: module,
        question: `Ajuda contextual: ${field_name}`,
        response: helpText,
        context: {
          field_name,
          field_type,
          field_value,
          form_data
        },
        tokens_used: Math.ceil(helpText.length / 4),
      });
    }

    return new Response(
      JSON.stringify({
        help_text: helpText,
        suggestions,
        field_name,
        module,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GiraBot Contextual] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro ao gerar ajuda contextual',
        help_text: 'Desculpe, não foi possível gerar ajuda para este campo no momento.',
        suggestions: []
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
