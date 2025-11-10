import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OptimizeRequest {
  unit_code?: string;
  notification_type?: string;
  days_to_analyze?: number;
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

    const request: OptimizeRequest = req.method === 'POST' ? await req.json() : {};
    const daysToAnalyze = request.days_to_analyze || 30;
    
    console.log('Optimizing send times based on historical data');

    // Calcular período de análise
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - daysToAnalyze);

    // Buscar notificações históricas
    let query = supabaseClient
      .from('notifications')
      .select('*')
      .gte('created_at', startDate.toISOString());

    if (request.unit_code) {
      query = query.eq('unit_code', request.unit_code);
    }
    if (request.notification_type) {
      query = query.eq('type', request.notification_type);
    }

    const { data: notifications, error } = await query;

    if (error) throw error;

    if (!notifications || notifications.length < 10) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Dados insuficientes para otimização. Necessário pelo menos 10 notificações.',
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Análise detalhada por horário e dia da semana
    const timeSlotAnalysis: Record<string, { sent: number; read: number; avgReadTime: number }> = {};

    notifications.forEach(n => {
      const createdAt = new Date(n.created_at);
      const hour = createdAt.getHours();
      const dayOfWeek = createdAt.getDay(); // 0 = Domingo, 6 = Sábado
      const key = `${dayOfWeek}-${hour}`;

      if (!timeSlotAnalysis[key]) {
        timeSlotAnalysis[key] = { sent: 0, read: 0, avgReadTime: 0 };
      }

      timeSlotAnalysis[key].sent++;
      if (n.is_read) {
        timeSlotAnalysis[key].read++;
        
        // Calcular tempo de leitura
        if (n.read_at && n.sent_at) {
          const sent = new Date(n.sent_at).getTime();
          const read = new Date(n.read_at).getTime();
          const readTime = (read - sent) / 60000; // minutos
          timeSlotAnalysis[key].avgReadTime += readTime;
        }
      }
    });

    // Calcular taxa de leitura e tempo médio para cada slot
    const timeSlotMetrics = Object.entries(timeSlotAnalysis).map(([key, data]) => {
      const [dayOfWeek, hour] = key.split('-').map(Number);
      const readRate = data.sent > 0 ? (data.read / data.sent) * 100 : 0;
      const avgReadTime = data.read > 0 ? data.avgReadTime / data.read : 0;
      
      // Score combinado: peso maior para taxa de leitura
      const score = (readRate * 0.7) + (Math.min(avgReadTime, 60) * 0.3);

      return {
        dayOfWeek,
        hour,
        sent: data.sent,
        read: data.read,
        readRate,
        avgReadTime,
        score,
      };
    });

    // Ordenar por score e pegar os top 10
    const topTimeSlots = timeSlotMetrics
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    // Agrupar recomendações por dia da semana
    const dayNames = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado'];
    const recommendationsByDay = topTimeSlots.reduce((acc, slot) => {
      const day = dayNames[slot.dayOfWeek];
      if (!acc[day]) {
        acc[day] = [];
      }
      acc[day].push({
        hour: `${slot.hour}:00`,
        readRate: slot.readRate.toFixed(1) + '%',
        avgReadTime: Math.round(slot.avgReadTime),
        volume: slot.sent,
        score: slot.score.toFixed(1),
      });
      return acc;
    }, {} as Record<string, any[]>);

    // Identificar melhores janelas de horário
    const bestHours = topTimeSlots
      .map(s => s.hour)
      .filter((h, i, arr) => arr.indexOf(h) === i)
      .slice(0, 5);

    const bestDays = topTimeSlots
      .map(s => s.dayOfWeek)
      .filter((d, i, arr) => arr.indexOf(d) === i)
      .slice(0, 3)
      .map(d => dayNames[d]);

    // Solicitar recomendações da IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiRecommendations = null;

    if (LOVABLE_API_KEY) {
      try {
        const prompt = `Você é GiraBot, especialista em otimização de comunicação interna. Analise os dados de engajamento por horário e forneça recomendações em português:

ANÁLISE DE ${daysToAnalyze} DIAS:
- Total de notificações analisadas: ${notifications.length}
${request.unit_code ? `- Unidade: ${request.unit_code}` : '- Todas as unidades'}
${request.notification_type ? `- Tipo: ${request.notification_type}` : '- Todos os tipos'}

TOP 10 MELHORES HORÁRIOS:
${topTimeSlots.map((s, i) => `${i + 1}. ${dayNames[s.dayOfWeek]} às ${s.hour}h - Taxa: ${s.readRate.toFixed(1)}% - Tempo médio: ${Math.round(s.avgReadTime)}min - Volume: ${s.sent}`).join('\n')}

RECOMENDAÇÕES POR DIA DA SEMANA:
${Object.entries(recommendationsByDay).map(([day, slots]) => 
  `${day}:\n${slots.map(s => `  - ${s.hour}: ${s.readRate} taxa, ${s.avgReadTime}min leitura`).join('\n')}`
).join('\n\n')}

FORNEÇA:
1. **Janelas de Envio Ideais**: Defina 3-4 janelas de horário específicas (ex: 9h-10h) e explique o porquê
2. **Horários a Evitar**: Identifique períodos com baixo engajamento
3. **Estratégia por Dia da Semana**: Como distribuir envios ao longo da semana
4. **Recomendações por Tipo de Conteúdo**: Se diferentes tipos devem ser enviados em horários diferentes
5. **Frequência Ideal**: Quantas notificações por dia/semana são ideais para evitar sobrecarga
6. **Considerações Especiais**: Fatores como feriados, finais de semana, início/fim de mês

Seja específico e prático, baseando-se nos dados fornecidos.`;

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
                content: 'Você é GiraBot, especialista em otimização de horários de comunicação. Forneça recomendações práticas baseadas em dados.',
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
          aiRecommendations = aiData.choices?.[0]?.message?.content || null;
          console.log('AI recommendations generated successfully');
        } else {
          console.warn('Failed to generate AI recommendations:', aiResponse.status);
        }
      } catch (error) {
        console.error('Error generating AI recommendations:', error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        analysis_period: `${daysToAnalyze} dias`,
        sample_size: notifications.length,
        filters: {
          unit_code: request.unit_code || 'all',
          notification_type: request.notification_type || 'all',
        },
        optimal_send_times: {
          best_hours: bestHours.map(h => `${h}:00`),
          best_days: bestDays,
          top_time_slots: topTimeSlots.slice(0, 5).map(s => ({
            day: dayNames[s.dayOfWeek],
            hour: `${s.hour}:00`,
            read_rate: s.readRate.toFixed(1) + '%',
            avg_read_time_minutes: Math.round(s.avgReadTime),
            volume: s.sent,
          })),
        },
        recommendations_by_day: recommendationsByDay,
        ai_recommendations: aiRecommendations,
        generated_at: new Date().toISOString(),
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in optimize-send-times:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
