import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ReportRequest {
  period?: 'daily' | 'weekly' | 'monthly';
  include_predictions?: boolean;
  send_to_admins?: boolean;
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
    const includePredictions = request.include_predictions !== false;
    
    console.log(`Generating smart ${period} report with AI insights`);

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

    // Buscar dados do período
    const { data: notifications } = await supabaseClient
      .from('notifications')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    // Buscar dados do período anterior para comparação
    const prevStartDate = new Date(startDate);
    const prevEndDate = new Date(endDate);
    const daysDiff = (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24);
    prevStartDate.setDate(prevStartDate.getDate() - daysDiff);
    prevEndDate.setDate(prevEndDate.getDate() - daysDiff);

    const { data: prevNotifications } = await supabaseClient
      .from('notifications')
      .select('*')
      .gte('created_at', prevStartDate.toISOString())
      .lte('created_at', prevEndDate.toISOString());

    // Calcular métricas atuais
    const totalSent = notifications?.length || 0;
    const totalRead = notifications?.filter(n => n.is_read).length || 0;
    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

    const prevTotalSent = prevNotifications?.length || 0;
    const prevTotalRead = prevNotifications?.filter(n => n.is_read).length || 0;
    const prevReadRate = prevTotalSent > 0 ? (prevTotalRead / prevTotalSent) * 100 : 0;

    // Calcular variações
    const sentChange = prevTotalSent > 0 ? ((totalSent - prevTotalSent) / prevTotalSent) * 100 : 0;
    const readRateChange = readRate - prevReadRate;

    // Análise por canal
    const channelPerformance = notifications?.reduce((acc, n) => {
      const channel = n.channel || 'push';
      if (!acc[channel]) {
        acc[channel] = { total: 0, read: 0, failed: 0 };
      }
      acc[channel].total++;
      if (n.is_read) acc[channel].read++;
      if (n.status === 'failed') acc[channel].failed++;
      return acc;
    }, {} as Record<string, any>);

    // Top tipos com melhor engajamento
    const typePerformance = notifications?.reduce((acc, n) => {
      if (!acc[n.type]) {
        acc[n.type] = { total: 0, read: 0 };
      }
      acc[n.type].total++;
      if (n.is_read) acc[n.type].read++;
      return acc;
    }, {} as Record<string, any>);

    const topTypes = Object.entries(typePerformance || {})
      .map(([type, data]: [string, any]) => ({
        type,
        total: data.total,
        readRate: data.total > 0 ? ((data.read / data.total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => parseFloat(b.readRate) - parseFloat(a.readRate))
      .slice(0, 5);

    // Análise por unidade
    const unitPerformance = notifications?.reduce((acc, n) => {
      const unit = n.unit_code || 'unknown';
      if (!acc[unit]) {
        acc[unit] = { total: 0, read: 0 };
      }
      acc[unit].total++;
      if (n.is_read) acc[unit].read++;
      return acc;
    }, {} as Record<string, any>);

    const topUnits = Object.entries(unitPerformance || {})
      .map(([unit, data]: [string, any]) => ({
        unit,
        total: data.total,
        readRate: data.total > 0 ? ((data.read / data.total) * 100).toFixed(1) : '0',
      }))
      .sort((a, b) => parseFloat(b.readRate) - parseFloat(a.readRate))
      .slice(0, 5);

    const worstUnits = Object.entries(unitPerformance || {})
      .map(([unit, data]: [string, any]) => ({
        unit,
        total: data.total,
        readRate: data.total > 0 ? ((data.read / data.total) * 100).toFixed(1) : '0',
      }))
      .filter(u => u.total >= 5) // Apenas unidades com volume significativo
      .sort((a, b) => parseFloat(a.readRate) - parseFloat(b.readRate))
      .slice(0, 5);

    // Gerar relatório com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiReport = null;

    if (LOVABLE_API_KEY) {
      try {
        const prompt = `Você é GiraBot, analista de comunicação interna. Gere um relatório executivo completo e detalhado em português sobre o desempenho das notificações:

PERÍODO: ${period.toUpperCase()} (${startDate.toLocaleDateString('pt-BR')} - ${endDate.toLocaleDateString('pt-BR')})

📊 RESUMO EXECUTIVO:
- Total enviado: ${totalSent} (${sentChange > 0 ? '+' : ''}${sentChange.toFixed(1)}% vs período anterior)
- Total lido: ${totalRead}
- Taxa de leitura: ${readRate.toFixed(2)}% (${readRateChange > 0 ? '+' : ''}${readRateChange.toFixed(2)}pp vs período anterior)

📱 DESEMPENHO POR CANAL:
${Object.entries(channelPerformance || {}).map(([channel, data]: [string, any]) => 
  `- ${channel}: ${data.total} enviadas, ${data.read} lidas (${((data.read / data.total) * 100).toFixed(1)}%), ${data.failed} falhas`
).join('\n')}

🎯 TOP 5 TIPOS COM MELHOR ENGAJAMENTO:
${topTypes.map((t, i) => `${i + 1}. ${t.type}: ${t.readRate}% (${t.total} notificações)`).join('\n')}

🏢 TOP 5 UNIDADES COM MELHOR ENGAJAMENTO:
${topUnits.map((u, i) => `${i + 1}. ${u.unit}: ${u.readRate}% (${u.total} notificações)`).join('\n')}

⚠️ 5 UNIDADES QUE PRECISAM DE ATENÇÃO:
${worstUnits.map((u, i) => `${i + 1}. ${u.unit}: ${u.readRate}% (${u.total} notificações)`).join('\n')}

GERE UM RELATÓRIO ESTRUTURADO COM:

## 1. ANÁLISE GERAL
- Avalie o desempenho geral do período
- Destaque tendências positivas e negativas
- Compare com período anterior

## 2. DESTAQUES DO PERÍODO
- 3-5 principais conquistas ou marcos
- Melhorias observadas
- Recordes batidos (se houver)

## 3. PROBLEMAS IDENTIFICADOS
- Liste 3-5 problemas críticos que precisam de atenção
- Priorize por impacto
- Seja específico sobre cada problema

## 4. ANÁLISE POR CANAL
- Avalie desempenho de cada canal
- Identifique canal mais efetivo
- Sugira otimizações por canal

## 5. RECOMENDAÇÕES IMEDIATAS (próximos 7 dias)
- Liste 5-7 ações específicas e práticas
- Priorize por impacto vs esforço
- Seja claro sobre o que fazer

## 6. ESTRATÉGIA DE MÉDIO PRAZO (próximo mês)
- 3-5 iniciativas estratégicas
- Como implementar
- Resultados esperados

${includePredictions ? `
## 7. PREVISÕES E PROJEÇÕES
- Tendência esperada para próximo período
- Previsão de taxa de leitura
- Fatores que podem impactar resultados
- Metas sugeridas realistas
` : ''}

## 8. UNIDADES QUE PRECISAM DE SUPORTE
- Análise das 5 unidades com pior desempenho
- Possíveis causas do baixo engajamento
- Ações específicas para cada unidade

Seja objetivo, use dados numéricos, e forneça insights acionáveis. Use formatação Markdown para melhor legibilidade.`;

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
                content: 'Você é GiraBot, analista sênior de comunicação interna com expertise em análise de dados e estratégia de engajamento. Seus relatórios são conhecidos por serem práticos, baseados em dados e acionáveis.',
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
          aiReport = aiData.choices?.[0]?.message?.content || null;
          console.log('AI report generated successfully');
        } else {
          console.warn('Failed to generate AI report:', aiResponse.status);
        }
      } catch (error) {
        console.error('Error generating AI report:', error);
      }
    }

    // Criar objeto de relatório completo
    const report = {
      metadata: {
        period,
        start_date: startDate.toISOString(),
        end_date: endDate.toISOString(),
        generated_at: new Date().toISOString(),
        includes_predictions: includePredictions,
      },
      summary: {
        current_period: {
          total_sent: totalSent,
          total_read: totalRead,
          read_rate: `${readRate.toFixed(2)}%`,
        },
        previous_period: {
          total_sent: prevTotalSent,
          total_read: prevTotalRead,
          read_rate: `${prevReadRate.toFixed(2)}%`,
        },
        changes: {
          sent_change: `${sentChange > 0 ? '+' : ''}${sentChange.toFixed(1)}%`,
          read_rate_change: `${readRateChange > 0 ? '+' : ''}${readRateChange.toFixed(2)}pp`,
        },
      },
      performance: {
        by_channel: channelPerformance,
        top_types: topTypes,
        top_units: topUnits,
        units_needing_attention: worstUnits,
      },
      ai_report: aiReport,
    };

    // Enviar para admins se solicitado
    if (request.send_to_admins) {
      const { data: admins } = await supabaseClient
        .from('profiles')
        .select('id, full_name')
        .eq('role', 'admin');

      if (admins && admins.length > 0) {
        const notificationPromises = admins.map(admin =>
          supabaseClient.from('notifications').insert({
            user_id: admin.id,
            title: `📊 Relatório ${period === 'daily' ? 'Diário' : period === 'weekly' ? 'Semanal' : 'Mensal'} de Notificações`,
            message: `Taxa de leitura: ${readRate.toFixed(2)}% (${readRateChange > 0 ? '+' : ''}${readRateChange.toFixed(2)}pp). Total: ${totalSent} notificações. Confira o relatório completo no painel.`,
            type: 'system',
            channel: 'push',
            module: 'notifications',
          })
        );

        await Promise.all(notificationPromises);
        console.log(`Report sent to ${admins.length} admins`);
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
    console.error('Error in generate-smart-reports:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
