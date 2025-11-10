import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface InsightsRequest {
  time_range?: string; // 'day' | 'week' | 'month' | 'quarter'
  insight_type?: 'patterns' | 'engagement' | 'trends' | 'all';
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

    const { time_range = 'week', insight_type = 'all' } = await req.json() as InsightsRequest;

    console.log(`Activity insights requested: ${time_range}, type: ${insight_type}`);

    // Fetch comprehensive activity data
    const { data: activityData, error: actError } = await supabaseClient.functions.invoke(
      'user-activity-monitoring',
      {
        body: { 
          action: 'get_activity_summary',
          time_range,
          include_details: true,
        },
      }
    );

    if (actError) {
      console.error('Error fetching activity data:', actError);
      throw new Error('Failed to fetch activity data');
    }

    const context = {
      activity_summary: activityData,
      time_range,
      insight_type,
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é o GiraBot, especialista em análise de dados e comportamento de usuários.
Analise os dados de atividade e gere insights valiosos sobre padrões de uso.

Foque em:
1. Padrões temporais (horários de pico, dias mais ativos, sazonalidade)
2. Engajamento por módulo (quais são mais/menos usados, por quê)
3. Tendências (crescimento, declínio, mudanças de comportamento)
4. Usuários mais ativos (identificar embaixadores da plataforma)
5. Oportunidades de melhoria (módulos subutilizados, recursos desconhecidos)

Seja analítico, use números e percentuais quando possível, e sugira ações práticas.`;

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
            content: `Analise estes dados de atividade e gere insights:\n\n${JSON.stringify(context, null, 2)}`
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'activity_insights',
              description: 'Return structured activity insights with patterns, engagement metrics, and trends',
              parameters: {
                type: 'object',
                properties: {
                  temporal_patterns: {
                    type: 'object',
                    properties: {
                      peak_hours: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      peak_days: {
                        type: 'array',
                        items: { type: 'string' },
                      },
                      slowest_periods: { type: 'string' },
                      pattern_insights: { type: 'string' },
                    },
                    required: ['peak_hours', 'peak_days', 'slowest_periods', 'pattern_insights'],
                  },
                  module_engagement: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        module: { type: 'string' },
                        usage_score: { type: 'number' },
                        trend: { type: 'string', enum: ['increasing', 'stable', 'decreasing'] },
                        top_users_count: { type: 'number' },
                        avg_session_time: { type: 'string' },
                        insights: { type: 'string' },
                        recommendations: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['module', 'usage_score', 'trend', 'insights', 'recommendations'],
                    },
                  },
                  top_active_users: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_name: { type: 'string' },
                        activity_score: { type: 'number' },
                        most_used_modules: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                        engagement_type: { type: 'string' },
                        suggestion: { type: 'string' },
                      },
                      required: ['activity_score', 'most_used_modules', 'engagement_type', 'suggestion'],
                    },
                  },
                  trends: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        trend_name: { type: 'string' },
                        direction: { type: 'string', enum: ['positive', 'negative', 'neutral'] },
                        magnitude: { type: 'string', enum: ['low', 'medium', 'high'] },
                        description: { type: 'string' },
                        implications: { type: 'string' },
                        recommended_actions: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['trend_name', 'direction', 'magnitude', 'description', 'implications', 'recommended_actions'],
                    },
                  },
                  opportunities: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        title: { type: 'string' },
                        category: { type: 'string', enum: ['engagement', 'feature_adoption', 'user_experience', 'efficiency'] },
                        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                        description: { type: 'string' },
                        potential_impact: { type: 'string' },
                        action_steps: {
                          type: 'array',
                          items: { type: 'string' },
                        },
                      },
                      required: ['title', 'category', 'priority', 'description', 'potential_impact', 'action_steps'],
                    },
                  },
                  executive_summary: { type: 'string' },
                },
                required: ['temporal_patterns', 'module_engagement', 'top_active_users', 'trends', 'opportunities', 'executive_summary'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'activity_insights' } },
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

      throw new Error('AI insights generation failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No structured output from AI');
    }

    const insights = JSON.parse(toolCall.function.arguments);

    console.log('Activity insights generated successfully');

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in user-activity-insights:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
