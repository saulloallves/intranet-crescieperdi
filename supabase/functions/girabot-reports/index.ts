import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportData {
  checklist_compliance: {
    total_units: number;
    completed_on_time: number;
    late_units: string[];
    recurring_late_units: string[];
  };
  module_engagement: {
    module: string;
    interactions: number;
    trend: 'up' | 'down' | 'stable';
  }[];
  training_progress: {
    total_trainings: number;
    completion_rate: number;
    bottlenecks: string[];
  };
  feed_activity: {
    posts_today: number;
    engagement_rate: number;
    top_content_types: string[];
  };
  recommendations: string[];
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

    console.log('[GiraBot Reports] Generating daily intelligent report...');

    // Get report type from request or use 'daily' as default
    const { report_type = 'daily' } = req.method === 'POST' 
      ? await req.json() 
      : { report_type: 'daily' };

    // === 1. CHECKLIST COMPLIANCE ANALYSIS ===
    const today = new Date();
    const todayStart = new Date(today.setHours(0, 0, 0, 0)).toISOString();
    const yesterdayStart = new Date(today.setDate(today.getDate() - 1)).toISOString();

    // Get all active checklists
    const { data: checklists } = await supabase
      .from('checklists')
      .select('id, applicable_units, deadline_time')
      .eq('is_active', true)
      .eq('frequency', 'daily');

    let totalUnits = 0;
    let completedOnTime = 0;
    const lateUnits: string[] = [];
    const unitResponseTimes: Record<string, Date[]> = {};

    if (checklists && checklists.length > 0) {
      // Get today's responses
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('unit_code, submitted_at, checklist_id')
        .gte('submitted_at', todayStart);

      // Collect all applicable units
      const allUnits = new Set<string>();
      checklists.forEach(checklist => {
        checklist.applicable_units?.forEach((unit: string) => allUnits.add(unit));
      });

      totalUnits = allUnits.size;

      // Check which units completed on time
      allUnits.forEach(unit => {
        const unitResponses = responses?.filter(r => r.unit_code === unit);
        const deadlineTime = checklists[0]?.deadline_time || '09:00';
        const deadlineHour = parseInt(deadlineTime.split(':')[0]);

        if (unitResponses && unitResponses.length > 0) {
          const submittedAt = new Date(unitResponses[0].submitted_at);
          
          // Track response times for recurring analysis
          if (!unitResponseTimes[unit]) unitResponseTimes[unit] = [];
          unitResponseTimes[unit].push(submittedAt);

          if (submittedAt.getHours() <= deadlineHour) {
            completedOnTime++;
          } else {
            lateUnits.push(unit);
          }
        } else {
          lateUnits.push(unit);
        }
      });
    }

    // Identify recurring late units (late more than 3 times in last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    
    const { data: weekResponses } = await supabase
      .from('checklist_responses')
      .select('unit_code, submitted_at')
      .gte('submitted_at', sevenDaysAgo.toISOString());

    const lateCounts: Record<string, number> = {};
    weekResponses?.forEach(response => {
      const hour = new Date(response.submitted_at).getHours();
      if (hour > 9) {
        lateCounts[response.unit_code] = (lateCounts[response.unit_code] || 0) + 1;
      }
    });

    const recurringLateUnits = Object.entries(lateCounts)
      .filter(([_, count]) => count >= 3)
      .map(([unit, _]) => unit);

    // === 2. MODULE ENGAGEMENT ANALYSIS ===
    const { data: aiSessions } = await supabase
      .from('ai_sessions')
      .select('module, created_at')
      .gte('created_at', yesterdayStart)
      .order('created_at', { ascending: false });

    const moduleEngagement: Record<string, number> = {};
    aiSessions?.forEach(session => {
      moduleEngagement[session.module] = (moduleEngagement[session.module] || 0) + 1;
    });

    const moduleEngagementData = Object.entries(moduleEngagement)
      .map(([module, interactions]) => ({
        module,
        interactions,
        trend: 'stable' as 'up' | 'down' | 'stable' // Simplified, could calculate trend
      }))
      .sort((a, b) => b.interactions - a.interactions);

    const lowEngagementModules = moduleEngagementData
      .filter(m => m.interactions < 5)
      .map(m => m.module);

    // === 3. TRAINING PROGRESS ANALYSIS ===
    const { data: trainings, count: totalTrainings } = await supabase
      .from('trainings')
      .select('*', { count: 'exact' })
      .eq('is_published', true);

    const { data: completedTrainings } = await supabase
      .from('training_progress')
      .select('training_id')
      .eq('completed', true);

    const completionRate = totalTrainings && completedTrainings
      ? (completedTrainings.length / totalTrainings) * 100
      : 0;

    // Find trainings with low completion rates
    const { data: trainingProgress } = await supabase
      .from('training_progress')
      .select('training_id, completed');

    const trainingCompletionRates: Record<string, { completed: number; total: number }> = {};
    trainingProgress?.forEach(progress => {
      if (!trainingCompletionRates[progress.training_id]) {
        trainingCompletionRates[progress.training_id] = { completed: 0, total: 0 };
      }
      trainingCompletionRates[progress.training_id].total++;
      if (progress.completed) {
        trainingCompletionRates[progress.training_id].completed++;
      }
    });

    const bottlenecks = Object.entries(trainingCompletionRates)
      .filter(([_, stats]) => (stats.completed / stats.total) < 0.3)
      .map(([trainingId, _]) => trainingId)
      .slice(0, 3);

    // === 4. FEED ACTIVITY ANALYSIS ===
    const { data: feedPosts } = await supabase
      .from('feed_posts')
      .select('type, likes_count, comments_count')
      .gte('created_at', todayStart);

    const postsToday = feedPosts?.length || 0;
    const totalEngagement = feedPosts?.reduce((sum, post) => 
      sum + (post.likes_count || 0) + (post.comments_count || 0), 0
    ) || 0;
    const engagementRate = postsToday > 0 ? totalEngagement / postsToday : 0;

    const contentTypeCounts: Record<string, number> = {};
    feedPosts?.forEach(post => {
      contentTypeCounts[post.type] = (contentTypeCounts[post.type] || 0) + 1;
    });

    const topContentTypes = Object.entries(contentTypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([type, _]) => type);

    // === 5. GENERATE AI INSIGHTS AND RECOMMENDATIONS ===
    const reportData: ReportData = {
      checklist_compliance: {
        total_units: totalUnits,
        completed_on_time: completedOnTime,
        late_units: lateUnits,
        recurring_late_units: recurringLateUnits
      },
      module_engagement: moduleEngagementData,
      training_progress: {
        total_trainings: totalTrainings || 0,
        completion_rate: completionRate,
        bottlenecks
      },
      feed_activity: {
        posts_today: postsToday,
        engagement_rate: engagementRate,
        top_content_types: topContentTypes
      },
      recommendations: []
    };

    // Generate AI-powered insights
    const prompt = `
Você é o GiraBot, assistente inteligente de gestão operacional.

Analise os seguintes dados e gere um relatório executivo conciso em português com:
1. Resumo de Performance (2-3 frases)
2. Principais Insights (3-4 pontos com emojis)
3. Recomendações Práticas (3-5 ações específicas)

DADOS:
Checklists: ${completedOnTime}/${totalUnits} lojas entregaram no prazo
Atrasos recorrentes: ${recurringLateUnits.length} unidades
Engajamento de módulos: ${moduleEngagementData.slice(0, 3).map(m => `${m.module}: ${m.interactions}`).join(', ')}
Módulos com baixo engajamento: ${lowEngagementModules.join(', ') || 'nenhum'}
Taxa de conclusão de treinamentos: ${completionRate.toFixed(1)}%
Atividade no Feed: ${postsToday} posts, ${engagementRate.toFixed(1)} engajamento médio

Formato de saída:
📊 **RESUMO**
[resumo executivo]

💡 **INSIGHTS**
• [insight 1]
• [insight 2]
• [insight 3]

🎯 **RECOMENDAÇÕES**
1. [recomendação específica]
2. [recomendação específica]
3. [recomendação específica]
`;

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
            content: 'Você é o GiraBot, um assistente de gestão que gera relatórios concisos, práticos e motivadores.'
          },
          {
            role: 'user',
            content: prompt
          }
        ],
        temperature: 0.7,
        max_tokens: 1000
      })
    });

    if (!aiResponse.ok) {
      const errorText = await aiResponse.text();
      console.error('[GiraBot Reports] AI API Error:', aiResponse.status, errorText);
      throw new Error(`AI API error: ${aiResponse.status}`);
    }

    const aiData = await aiResponse.json();
    const aiReport = aiData.choices[0].message.content;

    // Store report in database
    const { error: insertError } = await supabase
      .from('girabot_reports')
      .insert({
        report_type,
        report_data: reportData,
        ai_insights: aiReport,
        generated_at: new Date().toISOString()
      });

    if (insertError) {
      console.error('[GiraBot Reports] Error storing report:', insertError);
    }

    // Send notification to admins
    const { data: admins } = await supabase
      .from('profiles')
      .select('id')
      .eq('role', 'admin');

    if (admins && admins.length > 0) {
      const notifications = admins.map(admin => ({
        user_id: admin.id,
        type: 'girabot_report',
        title: '📊 Relatório Diário do GiraBot',
        message: `Novo relatório de operações disponível. ${completedOnTime}/${totalUnits} lojas no prazo.`,
        read: false,
        data: { report_id: reportData }
      }));

      await supabase.from('notifications').insert(notifications);
    }

    console.log('[GiraBot Reports] Report generated successfully');

    return new Response(
      JSON.stringify({
        success: true,
        report: reportData,
        ai_insights: aiReport,
        summary: {
          checklist_compliance: `${completedOnTime}/${totalUnits}`,
          recurring_issues: recurringLateUnits.length,
          low_engagement_modules: lowEngagementModules.length
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error: any) {
    console.error('[GiraBot Reports] Error:', error);
    return new Response(
      JSON.stringify({ 
        error: error.message,
        details: 'Failed to generate GiraBot report'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
