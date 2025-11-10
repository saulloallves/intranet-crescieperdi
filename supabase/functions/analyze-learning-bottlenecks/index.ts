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

    // Verificar se é admin
    const { data: roleData } = await supabase
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roleData) {
      return new Response(JSON.stringify({ error: 'Forbidden: Admin role required' }), {
        status: 403,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const { period_days } = await req.json();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - (period_days || 30));

    // Buscar todas as tentativas de quiz
    const { data: attempts, error: attemptsError } = await supabase
      .from('training_quiz_attempts' as any)
      .select(`
        *,
        trainings:training_id (title)
      `)
      .gte('created_at', startDate.toISOString());

    if (attemptsError) throw attemptsError;

    if (!attempts || attempts.length === 0) {
      return new Response(
        JSON.stringify({
          bottlenecks: [],
          summary: 'Nenhum dado de quiz encontrado no período selecionado.',
          recommendations: []
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agrupar por training_id e module_id
    const moduleStats: Record<string, {
      training_id: string;
      training_title: string;
      module_id: string;
      total_attempts: number;
      failed_attempts: number;
      avg_score: number;
      unique_users: Set<string>;
    }> = {};

    attempts.forEach((attempt: any) => {
      const key = `${attempt.training_id}_${attempt.module_id}`;
      
      if (!moduleStats[key]) {
        moduleStats[key] = {
          training_id: attempt.training_id,
          training_title: attempt.trainings?.title || 'Treinamento desconhecido',
          module_id: attempt.module_id,
          total_attempts: 0,
          failed_attempts: 0,
          avg_score: 0,
          unique_users: new Set()
        };
      }

      moduleStats[key].total_attempts++;
      moduleStats[key].unique_users.add(attempt.user_id);
      if (!attempt.passed) {
        moduleStats[key].failed_attempts++;
      }
      moduleStats[key].avg_score += attempt.score;
    });

    // Calcular médias e identificar gargalos
    const bottlenecks = Object.values(moduleStats)
      .map(stat => ({
        training_id: stat.training_id,
        training_title: stat.training_title,
        module_id: stat.module_id,
        total_attempts: stat.total_attempts,
        unique_users: stat.unique_users.size,
        failure_rate: (stat.failed_attempts / stat.total_attempts) * 100,
        avg_score: stat.avg_score / stat.total_attempts,
      }))
      .filter(stat => stat.failure_rate > 30 || stat.avg_score < 60) // Gargalos: >30% reprovação OU <60% média
      .sort((a, b) => b.failure_rate - a.failure_rate);

    // Gerar recomendações com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY não configurado');
    }

    const bottleneckSummary = bottlenecks.slice(0, 5).map(b => 
      `- ${b.training_title} (Módulo ${b.module_id}): ${b.failure_rate.toFixed(1)}% reprovação, ${b.avg_score.toFixed(0)}% média, ${b.unique_users} usuários`
    ).join('\n');

    const aiPrompt = `Você é GiraBot, analista pedagógico da Cresci e Perdi.

Analise os gargalos de aprendizado identificados e gere recomendações:

Gargalos detectados (${bottlenecks.length} total):
${bottleneckSummary || 'Nenhum gargalo significativo detectado.'}

Gere:
1. Resumo executivo da situação (2-3 frases)
2. Top 3 ações prioritárias de reforço
3. Sugestões específicas para cada módulo problemático

Use emojis e formatação clara. Máximo 250 palavras.`;

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'system', content: 'Você é GiraBot, analista pedagógico da Cresci e Perdi.' },
          { role: 'user', content: aiPrompt }
        ],
      }),
    });

    if (!aiResponse.ok) {
      console.error('AI API error:', aiResponse.status, await aiResponse.text());
      throw new Error('Erro ao gerar análise com IA');
    }

    const aiData = await aiResponse.json();
    const analysis = aiData.choices?.[0]?.message?.content || 'Análise não disponível.';

    // Gerar recomendações automáticas
    const recommendations = bottlenecks.slice(0, 5).map(b => ({
      training_id: b.training_id,
      module_id: b.module_id,
      action: b.failure_rate > 50 
        ? 'review_content'
        : b.avg_score < 50
        ? 'reinforce_learning'
        : 'extra_support',
      priority: b.failure_rate > 60 ? 'high' : b.failure_rate > 40 ? 'medium' : 'low',
      suggested_action: b.failure_rate > 50
        ? 'Revisar e simplificar o conteúdo do módulo'
        : b.avg_score < 50
        ? 'Criar material de reforço e exercícios práticos'
        : 'Disponibilizar tutoria individual com GiraBot'
    }));

    return new Response(
      JSON.stringify({
        bottlenecks,
        analysis,
        recommendations,
        period_days,
        total_modules_analyzed: Object.keys(moduleStats).length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error analyzing bottlenecks:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
