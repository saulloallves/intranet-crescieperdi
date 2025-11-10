import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface TutorRequest {
  message: string;
  training_id?: string;
  module_id?: string;
  context?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);

    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { message, training_id, module_id, context }: TutorRequest = await req.json();

    console.log('[GiraBot Tutor] Forwarding to universal system');

    // Buscar perfil do usuário
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    // Preparar contexto específico de treinamento
    let trainingContext: any = { context };

    if (training_id) {
      const { data: training } = await supabase
        .from('trainings' as any)
        .select('title, description, modules_json')
        .eq('id', training_id)
        .single();

      if (training) {
        trainingContext.training = {
          id: training_id,
          title: training.title,
          description: training.description,
        };

        if (module_id && training.modules_json) {
          const modules = training.modules_json as any[];
          const currentModule = modules.find((m: any) => m.id === module_id);
          if (currentModule) {
            trainingContext.module = {
              id: module_id,
              title: currentModule.title,
              content: currentModule.content?.substring(0, 500),
            };
          }
        }
      }
    }

    // Comando direto de busca (mantido por compatibilidade)
    if (message.startsWith('/buscar ')) {
      const query = message.replace('/buscar ', '').trim();
      
      console.log('[GiraBot Tutor] Direct search command:', query);

      const searchResponse = await fetch(`${supabaseUrl}/functions/v1/semantic-search`, {
        method: 'POST',
        headers: {
          'Authorization': authHeader,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ query, limit: 5 })
      });

      if (!searchResponse.ok) {
        return new Response(
          JSON.stringify({
            reply: '🔍 Desculpe, não consegui realizar a busca no momento. Tente novamente!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const searchData = await searchResponse.json();

      if (!searchData.results || searchData.results.length === 0) {
        return new Response(
          JSON.stringify({
            reply: '🔍 Não encontrei resultados para essa busca. Tente reformular ou me pergunte de outra forma!'
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const formattedResults = searchData.results
        .map((r: any, i: number) => 
          `${i + 1}. **${r.title}**\n   _${r.content_type}_ - ${r.content.substring(0, 100)}...`
        )
        .join('\n\n');

      return new Response(
        JSON.stringify({
          reply: `🔎 Encontrei estes resultados:\n\n${formattedResults}\n\nQuer que eu explique algum deles?`
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Encaminhar para girabot-universal (novo sistema)
    const universalResponse = await fetch(`${supabaseUrl}/functions/v1/girabot-universal`, {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message,
        module: 'training',
        context: trainingContext,
        user_role: profile?.role || 'colaborador',
      }),
    });

    if (!universalResponse.ok) {
      const errorText = await universalResponse.text();
      console.error('[GiraBot Tutor] Universal system error:', universalResponse.status, errorText);
      
      // Fallback: resposta padrão
      return new Response(
        JSON.stringify({
          reply: 'Desculpe, estou com dificuldades técnicas no momento. Por favor, revise o material e tente novamente em instantes. 🤖',
          error: 'Sistema temporariamente indisponível'
        }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Se for streaming, passar direto
    if (universalResponse.headers.get('content-type')?.includes('text/event-stream')) {
      return new Response(universalResponse.body, {
        headers: {
          ...corsHeaders,
          'Content-Type': 'text/event-stream',
        },
      });
    }

    // Se for JSON normal, processar
    const data = await universalResponse.json();
    
    // Adaptar resposta para formato esperado pelo componente antigo
    return new Response(
      JSON.stringify({ 
        reply: data.reply || data.response || 'Resposta não disponível',
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('[GiraBot Tutor] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        fallback: 'Desculpe, não consegui processar sua mensagem. Tente novamente.'
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
