import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface AnalysisRequest {
  period_days?: number;
  unit_code?: string;
  notification_type?: string;
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

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);

      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          throw new Error('Apenas administradores podem acessar análises');
        }
      }
    }

    const request: AnalysisRequest = req.method === 'POST' ? await req.json() : {};
    const periodDays = request.period_days || 30;
    
    console.log(`Analyzing notification engagement for last ${periodDays} days`);

    // Calcular período
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - periodDays);

    // Buscar notificações
    let query = supabaseClient
      .from('notifications')
      .select('*, profiles(unit_code, role)')
      .gte('created_at', startDate.toISOString());

    if (request.unit_code) {
      query = query.eq('unit_code', request.unit_code);
    }
    if (request.notification_type) {
      query = query.eq('type', request.notification_type);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    // Calcular métricas
    const totalSent = notifications?.length || 0;
    const totalRead = notifications?.filter(n => n.is_read).length || 0;
    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

    // Análise por horário
    const hourlyEngagement = notifications?.reduce((acc, n) => {
      const hour = new Date(n.created_at).getHours();
      if (!acc[hour]) {
        acc[hour] = { sent: 0, read: 0 };
      }
      acc[hour].sent++;
      if (n.is_read) acc[hour].read++;
      return acc;
    }, {} as Record<number, { sent: number; read: number }>);

    // Análise por dia da semana
    const weekdayEngagement = notifications?.reduce((acc, n) => {
      const day = new Date(n.created_at).getDay();
      if (!acc[day]) {
        acc[day] = { sent: 0, read: 0 };
      }
      acc[day].sent++;
      if (n.is_read) acc[day].read++;
      return acc;
    }, {} as Record<number, { sent: number; read: number }>);

    // Análise por tipo
    const typeEngagement = notifications?.reduce((acc, n) => {
      if (!acc[n.type]) {
        acc[n.type] = { sent: 0, read: 0, readRate: 0 };
      }
      acc[n.type].sent++;
      if (n.is_read) acc[n.type].read++;
      acc[n.type].readRate = (acc[n.type].read / acc[n.type].sent) * 100;
      return acc;
    }, {} as Record<string, { sent: number; read: number; readRate: number }>);

    // Análise por unidade
    const unitEngagement = notifications?.reduce((acc, n) => {
      const unit = n.unit_code || 'unknown';
      if (!acc[unit]) {
        acc[unit] = { sent: 0, read: 0, readRate: 0 };
      }
      acc[unit].sent++;
      if (n.is_read) acc[unit].read++;
      acc[unit].readRate = (acc[unit].read / acc[unit].sent) * 100;
      return acc;
    }, {} as Record<string, { sent: number; read: number; readRate: number }>);

    // Tempo médio de leitura
    const readNotifications = notifications?.filter(n => n.read_at && n.sent_at) || [];
    const totalReadTime = readNotifications.reduce((sum, n) => {
      const sent = new Date(n.sent_at).getTime();
      const read = new Date(n.read_at).getTime();
      return sum + (read - sent);
    }, 0);
    const avgReadTimeMinutes = readNotifications.length > 0 
      ? Math.round(totalReadTime / readNotifications.length / 60000) 
      : 0;

    // Preparar dados para IA
    const analysisData = {
      period: `${periodDays} dias`,
      summary: {
        total_sent: totalSent,
        total_read: totalRead,
        read_rate: readRate.toFixed(2) + '%',
        avg_read_time_minutes: avgReadTimeMinutes,
      },
      hourly_engagement: Object.entries(hourlyEngagement || {})
        .map(([hour, data]) => {
          const typedData = data as { sent: number; read: number };
          return {
            hour: `${hour}h`,
            read_rate: typedData.sent > 0 ? ((typedData.read / typedData.sent) * 100).toFixed(1) + '%' : '0%',
            volume: typedData.sent,
          };
        })
        .sort((a, b) => {
          const rateA = parseFloat(a.read_rate);
          const rateB = parseFloat(b.read_rate);
          return rateB - rateA;
        })
        .slice(0, 5),
      weekday_engagement: Object.entries(weekdayEngagement || {})
        .map(([day, data]) => {
          const typedData = data as { sent: number; read: number };
          const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
          return {
            day: dayNames[parseInt(day)],
            read_rate: typedData.sent > 0 ? ((typedData.read / typedData.sent) * 100).toFixed(1) + '%' : '0%',
            volume: typedData.sent,
          };
        })
        .sort((a, b) => {
          const rateA = parseFloat(a.read_rate);
          const rateB = parseFloat(b.read_rate);
          return rateB - rateA;
        }),
      type_engagement: Object.entries(typeEngagement || {})
        .map(([type, data]) => {
          const typedData = data as { sent: number; read: number; readRate: number };
          return {
            type,
            read_rate: typedData.readRate.toFixed(1) + '%',
            volume: typedData.sent,
          };
        })
        .sort((a, b) => {
          const rateA = parseFloat(a.read_rate);
          const rateB = parseFloat(b.read_rate);
          return rateB - rateA;
        }),
      unit_engagement: Object.entries(unitEngagement || {})
        .map(([unit, data]) => {
          const typedData = data as { sent: number; read: number; readRate: number };
          return {
            unit,
            read_rate: typedData.readRate.toFixed(1) + '%',
            volume: typedData.sent,
          };
        })
        .sort((a, b) => {
          const rateA = parseFloat(a.read_rate);
          const rateB = parseFloat(b.read_rate);
          return rateB - rateA;
        })
        .slice(0, 10),
    };

    // Solicitar análise da IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiInsights = null;

    if (LOVABLE_API_KEY) {
      try {
        const prompt = `Você é GiraBot, especialista em análise de comunicação interna. Analise os dados de engajamento de notificações e forneça insights acionáveis em português:

DADOS DE ENGAJAMENTO (${analysisData.period}):

RESUMO GERAL:
- Total enviado: ${analysisData.summary.total_sent}
- Total lido: ${analysisData.summary.total_read}
- Taxa de leitura: ${analysisData.summary.read_rate}
- Tempo médio de leitura: ${analysisData.summary.avg_read_time_minutes} minutos

TOP 5 HORÁRIOS COM MELHOR ENGAJAMENTO:
${analysisData.hourly_engagement.map(h => `- ${h.hour}: ${h.read_rate} (${h.volume} notificações)`).join('\n')}

ENGAJAMENTO POR DIA DA SEMANA:
${analysisData.weekday_engagement.map(d => `- ${d.day}: ${d.read_rate} (${d.volume} notificações)`).join('\n')}

ENGAJAMENTO POR TIPO DE NOTIFICAÇÃO:
${analysisData.type_engagement.map(t => `- ${t.type}: ${t.read_rate} (${t.volume} notificações)`).join('\n')}

TOP 10 UNIDADES POR ENGAJAMENTO:
${analysisData.unit_engagement.map(u => `- ${u.unit}: ${u.read_rate} (${u.volume} notificações)`).join('\n')}

FORNEÇA:
1. **Principais Padrões Identificados**: Liste 3-5 padrões claros observados nos dados
2. **Problemas Críticos**: Identifique problemas que precisam de atenção imediata
3. **Recomendações Práticas**: 5-7 ações específicas para melhorar o engajamento
4. **Melhores Horários de Envio**: Sugira janelas de horário ideais baseado nos dados
5. **Estratégias por Tipo**: Como otimizar cada tipo de notificação
6. **Unidades com Baixo Engajamento**: Sugestões para melhorar unidades com taxa abaixo de 50%

Seja específico, use números dos dados e forneça ações práticas.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              {
                role: 'system',
                content: 'Você é GiraBot, especialista em análise de dados de comunicação interna. Forneça insights práticos e acionáveis em português do Brasil.',
              },
              {
                role: 'user',
                content: prompt,
              },
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content || null;
          console.log('AI insights generated successfully');
        } else {
          console.warn('Failed to generate AI insights:', aiResponse.status);
        }
      } catch (error) {
        console.error('Error generating AI insights:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: analysisData.period,
        summary: analysisData.summary,
        detailed_metrics: {
          hourly: analysisData.hourly_engagement,
          weekday: analysisData.weekday_engagement,
          by_type: analysisData.type_engagement,
          by_unit: analysisData.unit_engagement,
        },
        ai_insights: aiInsights,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in analyze-notification-engagement:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
