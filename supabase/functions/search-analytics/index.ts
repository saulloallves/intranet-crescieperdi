import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { period = 'weekly', startDate, endDate } = await req.json();

    const start = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const end = endDate || new Date().toISOString();

    console.log(`📊 Generating analytics for ${period}: ${start} to ${end}`);

    // Buscar todos os logs do período
    const { data: logs, error: logsError } = await supabaseClient
      .from('search_logs')
      .select('*')
      .gte('created_at', start)
      .lte('created_at', end);

    if (logsError) throw logsError;

    if (!logs || logs.length === 0) {
      return new Response(
        JSON.stringify({
          message: 'No search data for this period',
          topQueries: [],
          noResultQueries: [],
          successRate: 0,
          totalSearches: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Agregar top queries
    const queryCount = new Map<string, number>();
    logs.forEach(log => {
      const count = queryCount.get(log.query) || 0;
      queryCount.set(log.query, count + 1);
    });

    const topQueries = Array.from(queryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Queries sem resultado
    const noResultLogs = logs.filter(l => l.no_results);
    const noResultQueryCount = new Map<string, number>();
    noResultLogs.forEach(log => {
      const count = noResultQueryCount.get(log.query) || 0;
      noResultQueryCount.set(log.query, count + 1);
    });

    const noResultQueries = Array.from(noResultQueryCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 20)
      .map(([query, count]) => ({ query, count }));

    // Taxa de sucesso
    const successfulSearches = logs.filter(l => l.results_count > 0).length;
    const successRate = (successfulSearches / logs.length) * 100;

    // Latência média
    const totalLatency = logs.reduce((sum, l) => sum + (l.latency_ms || 0), 0);
    const avgLatency = Math.round(totalLatency / logs.length);

    // Distribuição por tipo de conteúdo (aproximada via source_table)
    const contentDistribution: any = {};
    logs.forEach(log => {
      if (log.source_table) {
        contentDistribution[log.source_table] = (contentDistribution[log.source_table] || 0) + 1;
      }
    });

    // Gerar insights com IA
    const insights = await generateInsightsWithAI(lovableApiKey, {
      topQueries: topQueries.slice(0, 5),
      noResultQueries: noResultQueries.slice(0, 5),
      successRate,
      totalSearches: logs.length,
      avgLatency
    });

    // Salvar em search_trends
    await supabaseClient.from('search_trends').insert({
      period,
      period_start: start,
      period_end: end,
      top_queries: topQueries,
      no_result_queries: noResultQueries,
      avg_latency_ms: avgLatency,
      total_searches: logs.length,
      success_rate: successRate
    });

    console.log(`✅ Analytics generated for ${logs.length} searches`);

    return new Response(
      JSON.stringify({
        topQueries,
        noResultQueries,
        successRate: Math.round(successRate * 100) / 100,
        avgLatency,
        totalSearches: logs.length,
        contentDistribution,
        insights,
        period: {
          type: period,
          start,
          end
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in search-analytics:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateInsightsWithAI(
  apiKey: string,
  data: any
): Promise<string> {
  try {
    const prompt = `Analise os seguintes dados de busca e gere insights acionáveis:

📈 DADOS:
- Total de buscas: ${data.totalSearches}
- Taxa de sucesso: ${data.successRate.toFixed(1)}%
- Latência média: ${data.avgLatency}ms

🔝 TOP 5 BUSCAS:
${data.topQueries.map((q: any, i: number) => `${i + 1}. "${q.query}" - ${q.count} vezes`).join('\n')}

❌ TOP 5 BUSCAS SEM RESULTADO:
${data.noResultQueries.map((q: any, i: number) => `${i + 1}. "${q.query}" - ${q.count} vezes`).join('\n')}

Gere um relatório executivo com:
1. Principais tendências identificadas
2. Lacunas de conteúdo mais críticas
3. Recomendações práticas para melhorar a base de conhecimento
4. Prioridades de criação de conteúdo

Seja objetivo e acionável (máx. 250 palavras).`;

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{ role: 'user', content: prompt }]
      })
    });

    if (response.ok) {
      const aiData = await response.json();
      return aiData.choices[0].message.content;
    }
  } catch (error) {
    console.error('Error generating AI insights:', error);
  }

  return 'Insights de IA não disponíveis no momento.';
}
