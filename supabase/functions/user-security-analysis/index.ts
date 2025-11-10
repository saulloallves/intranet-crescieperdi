import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface SecurityAnalysisRequest {
  time_range?: string; // 'day' | 'week' | 'month'
  focus_area?: 'anomalies' | 'recommendations' | 'optimization' | 'all';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Verify admin access
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (profile?.role !== 'admin') {
      return new Response(JSON.stringify({ error: 'Admin access required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { time_range = 'week', focus_area = 'all' } = await req.json() as SecurityAnalysisRequest;

    console.log(`Security analysis requested: ${time_range}, focus: ${focus_area}`);

    // Fetch security monitoring data
    const { data: securityData, error: securityError } = await supabaseClient.functions.invoke(
      'user-security-monitoring',
      {
        body: { action: 'get_security_report', time_range },
      }
    );

    if (securityError) {
      console.error('Error fetching security data:', securityError);
      throw new Error('Failed to fetch security data');
    }

    // Fetch activity logs
    const { data: activityData, error: activityError } = await supabaseClient.functions.invoke(
      'user-activity-monitoring',
      {
        body: { action: 'get_activity_summary', time_range },
      }
    );

    if (activityError) {
      console.error('Error fetching activity data:', activityError);
      throw new Error('Failed to fetch activity data');
    }

    // Prepare context for AI
    const context = {
      security_metrics: securityData,
      activity_summary: activityData,
      time_range,
      focus_area,
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    // Call Lovable AI for analysis
    const systemPrompt = `Você é o GiraBot, um assistente especializado em segurança de sistemas.
Analise os dados de segurança fornecidos e gere insights acionáveis.

Foque em:
1. Padrões de acesso anômalos (horários incomuns, IPs suspeitos, múltiplas tentativas de login)
2. Recomendações de bloqueio (usuários com comportamento suspeito)
3. Otimizações de segurança (permissões excessivas, contas inativas)
4. Engajamento por módulo (identificar módulos pouco usados ou com problemas)

Seja específico, prático e prioritize ações de alto impacto.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: systemPrompt },
          { 
            role: 'user', 
            content: `Analise estes dados de segurança e gere recomendações:\n\n${JSON.stringify(context, null, 2)}`
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'security_analysis',
              description: 'Return structured security analysis with anomalies, recommendations, and insights',
              parameters: {
                type: 'object',
                properties: {
                  anomalies: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_id: { type: 'string' },
                        user_name: { type: 'string' },
                        issue: { type: 'string' },
                        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'] },
                        details: { type: 'string' },
                        suggested_action: { type: 'string' },
                      },
                      required: ['issue', 'severity', 'details', 'suggested_action'],
                    },
                  },
                  recommendations: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                        description: { type: 'string' },
                        impact: { type: 'string' },
                        action_items: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['title', 'priority', 'description', 'impact', 'action_items'],
                    },
                  },
                  module_engagement: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        module: { type: 'string' },
                        usage_level: { type: 'string', enum: ['very_low', 'low', 'medium', 'high', 'very_high'] },
                        trend: { type: 'string', enum: ['increasing', 'stable', 'decreasing'] },
                        insights: { type: 'string' },
                      },
                      required: ['module', 'usage_level', 'trend', 'insights'],
                    },
                  },
                  summary: { type: 'string' },
                },
                required: ['anomalies', 'recommendations', 'module_engagement', 'summary'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'security_analysis' } },
      }),
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('AI API error:', aiResponse.status, errorText);
      
      if (aiResponse.status === 429) {
        return new Response(
          JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
          { status: 429, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
      
      if (aiResponse.status === 402) {
        return new Response(
          JSON.stringify({ error: 'Payment required. Please add credits to your Lovable AI workspace.' }),
          { status: 402, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      throw new Error('AI analysis failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No structured output from AI');
    }

    const analysis = JSON.parse(toolCall.function.arguments);

    console.log('Security analysis completed successfully');

    return new Response(JSON.stringify(analysis), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in user-security-analysis:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
