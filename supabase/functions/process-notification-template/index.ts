import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ProcessTemplateRequest {
  template_id: string;
  variables: Record<string, string>;
  user_id?: string; // Para personalização adicional
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const { template_id, variables, user_id }: ProcessTemplateRequest = await req.json();
    console.log('Processing template:', template_id);

    // Buscar template
    const { data: template, error: templateError } = await supabaseClient
      .from('notification_templates')
      .select('*')
      .eq('id', template_id)
      .single();

    if (templateError || !template) {
      throw new Error('Template not found');
    }

    if (!template.active) {
      throw new Error('Template is not active');
    }

    let processedTitle = template.title;
    let processedMessage = template.message_template;

    // Buscar dados do usuário se fornecido
    if (user_id) {
      const { data: user } = await supabaseClient
        .from('profiles')
        .select('full_name, email, phone, unit_code, role')
        .eq('id', user_id)
        .single();

      if (user) {
        // Adicionar variáveis do usuário
        variables['nome'] = user.full_name || '';
        variables['email'] = user.email || '';
        variables['unidade'] = user.unit_code || '';
        variables['cargo'] = user.role || '';
      }
    }

    // Processar todas as variáveis
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`{{${key}}}`, 'g');
      processedTitle = processedTitle.replace(regex, value);
      processedMessage = processedMessage.replace(regex, value);
    }

    // Detectar variáveis não processadas
    const unprocessedVars: string[] = [];
    const varRegex = /{{([^}]+)}}/g;
    let match;

    while ((match = varRegex.exec(processedMessage)) !== null) {
      unprocessedVars.push(match[1]);
    }

    // Variáveis disponíveis do template
    const availableVariables = template.variables || [];

    return new Response(
      JSON.stringify({
        success: true,
        template_id: template.id,
        channel: template.channel,
        processed: {
          title: processedTitle,
          message: processedMessage,
        },
        original: {
          title: template.title,
          message: template.message_template,
        },
        variables_used: Object.keys(variables),
        unprocessed_variables: unprocessedVars,
        available_variables: availableVariables,
        warnings: unprocessedVars.length > 0 
          ? [`Variáveis não processadas: ${unprocessedVars.join(', ')}`]
          : [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in process-notification-template:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
