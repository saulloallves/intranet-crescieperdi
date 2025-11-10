import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizerRequest {
  user_id?: string; // If provided, analyze specific user
  optimization_type?: 'remove_unused' | 'suggest_new' | 'detect_excessive' | 'all';
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

    const { user_id, optimization_type = 'all' } = await req.json() as OptimizerRequest;

    console.log(`Permission optimization requested for ${user_id || 'all users'}, type: ${optimization_type}`);

    // Fetch permissions data
    const { data: permissionsData, error: permError } = await supabaseClient.functions.invoke(
      'user-permissions-management',
      {
        body: { action: user_id ? 'get_user_permissions' : 'list', user_id },
      }
    );

    if (permError) {
      console.error('Error fetching permissions:', permError);
      throw new Error('Failed to fetch permissions');
    }

    // Fetch activity data to understand actual usage
    const { data: activityData, error: actError } = await supabaseClient.functions.invoke(
      'user-activity-monitoring',
      {
        body: { 
          action: 'get_activity_logs',
          user_id,
          limit: 500,
        },
      }
    );

    if (actError) {
      console.error('Error fetching activity data:', actError);
      throw new Error('Failed to fetch activity data');
    }

    const context = {
      permissions: permissionsData,
      activity_logs: activityData,
      optimization_type,
      target_user: user_id,
    };

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const systemPrompt = `Você é o GiraBot, especialista em otimização de permissões de sistemas.
Analise as permissões atuais e o uso real dos módulos para sugerir otimizações.

Foque em:
1. Permissões não utilizadas (usuários com acesso a módulos que nunca usam)
2. Permissões excessivas (usuários com nível admin quando write é suficiente)
3. Permissões faltantes (usuários tentando acessar módulos sem permissão)
4. Otimizações de segurança (princípio do menor privilégio)

Seja prático e justifique cada recomendação com dados de uso.`;

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
            content: `Analise estas permissões e uso real, e sugira otimizações:\n\n${JSON.stringify(context, null, 2)}`
          },
        ],
        tools: [
          {
            type: 'function',
            function: {
              name: 'permission_optimization',
              description: 'Return structured permission optimization recommendations',
              parameters: {
                type: 'object',
                properties: {
                  remove_unused: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_id: { type: 'string' },
                        user_name: { type: 'string' },
                        module: { type: 'string' },
                        current_access: { type: 'string' },
                        reason: { type: 'string' },
                        last_used: { type: 'string' },
                        confidence: { type: 'string', enum: ['low', 'medium', 'high'] },
                      },
                      required: ['module', 'current_access', 'reason', 'confidence'],
                    },
                  },
                  reduce_excessive: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_id: { type: 'string' },
                        user_name: { type: 'string' },
                        module: { type: 'string' },
                        current_access: { type: 'string' },
                        suggested_access: { type: 'string' },
                        reason: { type: 'string' },
                        usage_pattern: { type: 'string' },
                      },
                      required: ['module', 'current_access', 'suggested_access', 'reason', 'usage_pattern'],
                    },
                  },
                  suggest_new: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        user_id: { type: 'string' },
                        user_name: { type: 'string' },
                        module: { type: 'string' },
                        suggested_access: { type: 'string' },
                        reason: { type: 'string' },
                        access_attempts: { type: 'number' },
                        priority: { type: 'string', enum: ['low', 'medium', 'high'] },
                      },
                      required: ['module', 'suggested_access', 'reason', 'priority'],
                    },
                  },
                  summary: {
                    type: 'object',
                    properties: {
                      total_optimizations: { type: 'number' },
                      high_priority_count: { type: 'number' },
                      potential_security_improvements: { type: 'string' },
                      estimated_impact: { type: 'string' },
                    },
                    required: ['total_optimizations', 'high_priority_count', 'potential_security_improvements', 'estimated_impact'],
                  },
                },
                required: ['remove_unused', 'reduce_excessive', 'suggest_new', 'summary'],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: 'function', function: { name: 'permission_optimization' } },
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

      throw new Error('AI optimization failed');
    }

    const aiData = await aiResponse.json();
    const toolCall = aiData.choices[0]?.message?.tool_calls?.[0];
    
    if (!toolCall) {
      throw new Error('No structured output from AI');
    }

    const optimization = JSON.parse(toolCall.function.arguments);

    console.log('Permission optimization completed successfully');

    return new Response(JSON.stringify(optimization), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in user-permission-optimizer:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
