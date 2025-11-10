import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check authorization
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

    // Check if user is admin or gestor_setor
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .in('role', ['admin', 'gestor_setor'])
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin or manager role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { training_path_id, period_days } = await req.json();

    // Calculate date range
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period_days || 30));

    // Fetch feedback data
    const { data: feedbackData, error: feedbackError } = await supabase
      .from('training_feedback')
      .select(`
        *,
        profiles!training_feedback_user_id_fkey(nome_completo, cargo, unidade)
      `)
      .gte('created_at', startDate.toISOString())
      .order('created_at', { ascending: false });

    if (feedbackError) throw feedbackError;

    if (!feedbackData || feedbackData.length === 0) {
      return new Response(
        JSON.stringify({
          summary: 'Nenhum feedback encontrado no período selecionado.',
          metrics: {
            total_responses: 0,
            avg_clarity: 0,
            avg_preparedness: 0,
            by_role: {}
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Filter by training path if specified
    let filteredData = feedbackData;
    if (training_path_id) {
      filteredData = feedbackData.filter(f => f.training_path_id === training_path_id);
    }

    // Calculate metrics
    const totalResponses = filteredData.length;
    const avgClarity = filteredData.reduce((sum, f) => sum + f.was_clear, 0) / totalResponses;
    const avgPreparedness = filteredData.reduce((sum, f) => sum + f.feels_prepared, 0) / totalResponses;

    // Group by role
    const byRole: Record<string, { count: number; clarity: number; preparedness: number }> = {};
    
    filteredData.forEach(feedback => {
      const role = feedback.profiles?.cargo || 'Não especificado';
      if (!byRole[role]) {
        byRole[role] = { count: 0, clarity: 0, preparedness: 0 };
      }
      byRole[role].count++;
      byRole[role].clarity += feedback.was_clear;
      byRole[role].preparedness += feedback.feels_prepared;
    });

    // Calculate averages by role
    Object.keys(byRole).forEach(role => {
      byRole[role].clarity = byRole[role].clarity / byRole[role].count;
      byRole[role].preparedness = byRole[role].preparedness / byRole[role].count;
    });

    // Collect comments for AI analysis
    const comments = filteredData
      .filter(f => f.additional_comments)
      .map(f => `[${f.profiles?.cargo || 'N/A'}] ${f.additional_comments}`)
      .join('\n');

    // Generate AI summary
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const aiPrompt = `Você é GiraBot, assistente de análise da Cresci e Perdi.

Analise os dados de feedback dos treinamentos e gere um relatório executivo:

Métricas Gerais:
- Total de respostas: ${totalResponses}
- Clareza média: ${avgClarity.toFixed(1)}/5
- Preparação média: ${avgPreparedness.toFixed(1)}/5

Feedback por Cargo:
${Object.entries(byRole).map(([role, metrics]) => 
  `- ${role}: ${metrics.count} respostas | Clareza: ${metrics.clarity.toFixed(1)}/5 | Preparação: ${metrics.preparedness.toFixed(1)}/5`
).join('\n')}

Comentários dos Colaboradores:
${comments || 'Nenhum comentário adicional.'}

Gere um relatório executivo com:
1. Resumo geral da satisfação
2. Padrões identificados por cargo
3. Pontos de atenção e melhorias sugeridas
4. Recomendações específicas

Use emojis e formatação clara. Máximo 300 palavras.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é GiraBot, assistente analítico da Cresci e Perdi.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Erro ao gerar análise com IA');
    }

    const aiData = await aiResponse.json();
    const aiSummary = aiData.choices?.[0]?.message?.content || 'Análise não disponível.';

    return new Response(
      JSON.stringify({
        summary: aiSummary,
        metrics: {
          total_responses: totalResponses,
          avg_clarity: parseFloat(avgClarity.toFixed(2)),
          avg_preparedness: parseFloat(avgPreparedness.toFixed(2)),
          by_role: byRole
        },
        raw_data: filteredData
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error analyzing feedback:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
