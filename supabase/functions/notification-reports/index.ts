import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  period?: 'daily' | 'weekly' | 'monthly';
  send_notification?: boolean;
  generate_insights?: boolean;
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

    const request: ReportRequest = req.method === 'POST' ? await req.json() : {};
    const period = request.period || 'weekly';
    const generateInsights = request.generate_insights !== false;

    console.log(`Generating ${period} notification report`);

    // Calcular período
    const endDate = new Date();
    const startDate = new Date();
    
    switch (period) {
      case 'daily':
        startDate.setDate(startDate.getDate() - 1);
        break;
      case 'weekly':
        startDate.setDate(startDate.getDate() - 7);
        break;
      case 'monthly':
        startDate.setMonth(startDate.getMonth() - 1);
        break;
    }

    // Buscar estatísticas do período
    const { data: notifications } = await supabaseClient
      .from('notifications')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    const totalSent = notifications?.length || 0;
    const totalRead = notifications?.filter(n => n.is_read).length || 0;
    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

    // Análise por canal
    const channelStats = notifications?.reduce((acc, n) => {
      const channel = n.channel || 'push';
      if (!acc[channel]) {
        acc[channel] = { total: 0, success: 0, failed: 0 };
      }
      acc[channel].total++;
      if (n.status === 'sent' || n.status === 'delivered') acc[channel].success++;
      if (n.status === 'failed') acc[channel].failed++;
      return acc;
    }, {} as Record<string, any>);

    // Análise por tipo
    const typeStats = notifications?.reduce((acc, n) => {
      if (!acc[n.type]) {
        acc[n.type] = { total: 0, read: 0 };
      }
      acc[n.type].total++;
      if (n.is_read) acc[n.type].read++;
      return acc;
    }, {} as Record<string, any>);

    // Top módulos
    const moduleStats = notifications?.reduce((acc, n) => {
      if (n.module) {
        acc[n.module] = (acc[n.module] || 0) + 1;
      }
      return acc;
    }, {} as Record<string, number>);

    const topModules = Object.entries(moduleStats || {})
      .sort(([, a], [, b]) => (b as number) - (a as number))
      .slice(0, 5)
      .map(([module, count]) => ({ module, count }));

    let aiInsights = null;

    // Gerar insights com IA se solicitado
    if (generateInsights) {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        try {
          const prompt = `Analise estes dados de notificações e forneça insights acionáveis em português:

Período: ${period} (${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')})

Resumo:
- Total enviado: ${totalSent}
- Total lido: ${totalRead}
- Taxa de leitura: ${readRate.toFixed(2)}%

Por Canal:
${JSON.stringify(channelStats, null, 2)}

Por Tipo:
${JSON.stringify(typeStats, null, 2)}

Top 5 Módulos:
${JSON.stringify(topModules, null, 2)}

Forneça:
1. Principais observações sobre engajamento
2. Recomendações para melhorar taxa de leitura
3. Melhores canais e horários
4. Insights sobre tipos de conteúdo mais efetivos`;

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
                  content: 'Você é GiraBot, um assistente especializado em análise de comunicação interna. Forneça insights práticos e acionáveis.',
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
    }

    // Criar relatório formatado
    const report = {
      period: {
        type: period,
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        label: `${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')}`,
      },
      summary: {
        total_sent: totalSent,
        total_read: totalRead,
        read_rate: `${readRate.toFixed(2)}%`,
        unread_count: totalSent - totalRead,
      },
      channels: channelStats,
      types: typeStats,
      top_modules: topModules,
      ai_insights: aiInsights,
      generated_at: new Date().toISOString(),
    };

    // Enviar notificação aos admins se solicitado
    if (request.send_notification) {
      const { data: admins } = await supabaseClient
        .from('profiles')
        .select('id')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notifications = admins.map(admin => ({
          user_id: admin.id,
          title: `📊 Relatório de Notificações - ${period}`,
          message: `Taxa de leitura: ${readRate.toFixed(2)}%. Total enviado: ${totalSent}. Confira o relatório completo no painel administrativo.`,
          type: 'system',
          channel: 'push',
          module: 'notifications',
        }));

        await supabaseClient
          .from('notifications')
          .insert(notifications);

        console.log(`Report notification sent to ${admins.length} admins`);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        report,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in notification-reports:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
