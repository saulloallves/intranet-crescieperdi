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
    console.log('🕐 Running weekly search report...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    // Gerar analytics da semana
    const analyticsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/search-analytics`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        period: 'weekly',
        startDate: oneWeekAgo.toISOString(),
        endDate: new Date().toISOString()
      })
    });

    const analytics = analyticsResponse.ok ? await analyticsResponse.json() : null;

    // Gerar sugestões de conteúdo
    const suggestionsResponse = await fetch(`${Deno.env.get('SUPABASE_URL')}/functions/v1/search-suggest-content`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        'Content-Type': 'application/json'
      }
    });

    const suggestions = suggestionsResponse.ok ? await suggestionsResponse.json() : null;

    // Gerar relatório HTML formatado
    const reportContent = generateReportHTML(analytics, suggestions);

    // Buscar todos os admins
    const { data: admins } = await supabaseClient
      .from('profiles')
      .select('id, email, full_name')
      .in('role', ['admin', 'gestor_setor']);

    if (!admins || admins.length === 0) {
      console.log('⚠️ No admins found to send report');
      return new Response(
        JSON.stringify({ message: 'No admins to notify' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Enviar notificação para cada admin
    const notifications = admins.map((admin: any) => ({
      user_id: admin.id,
      title: '📊 Relatório Semanal de Busca',
      message: `Confira as tendências de busca e lacunas de conteúdo identificadas esta semana. ${analytics?.totalSearches || 0} buscas analisadas.`,
      type: 'report',
      reference_id: null
    }));

    await supabaseClient.from('notifications').insert(notifications);

    console.log(`✅ Weekly report sent to ${admins.length} admins`);

    return new Response(
      JSON.stringify({
        success: true,
        report: 'Sent to admins',
        adminsNotified: admins.length,
        analytics: analytics ? {
          totalSearches: analytics.totalSearches,
          successRate: analytics.successRate,
          topQueries: analytics.topQueries?.slice(0, 5)
        } : null
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in search-weekly-report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateReportHTML(analytics: any, suggestions: any): string {
  if (!analytics) {
    return '<p>Dados de analytics não disponíveis.</p>';
  }

  return `
<h2>📊 Relatório Semanal de Busca</h2>

<h3>Resumo Geral</h3>
<ul>
  <li><strong>Total de buscas:</strong> ${analytics.totalSearches || 0}</li>
  <li><strong>Taxa de sucesso:</strong> ${analytics.successRate?.toFixed(1) || 0}%</li>
  <li><strong>Latência média:</strong> ${analytics.avgLatency || 0}ms</li>
</ul>

<h3>🔝 Top 5 Buscas</h3>
<ol>
  ${analytics.topQueries?.slice(0, 5).map((q: any) => 
    `<li>"${q.query}" - ${q.count} vezes</li>`
  ).join('') || '<li>Nenhuma busca registrada</li>'}
</ol>

<h3>❌ Lacunas de Conteúdo (sem resultado)</h3>
<ol>
  ${analytics.noResultQueries?.slice(0, 5).map((q: any) => 
    `<li>"${q.query}" - ${q.count} vezes</li>`
  ).join('') || '<li>Nenhuma lacuna identificada</li>'}
</ol>

<h3>🤖 Insights da IA</h3>
<p>${analytics.insights || 'Insights não disponíveis'}</p>

<h3>💡 Sugestões de Conteúdo</h3>
${suggestions?.recommendations?.length > 0 
  ? `<p><strong>${suggestions.recommendations.length} recomendações geradas</strong></p>
     <p>Acesse o painel administrativo para ver os detalhes completos.</p>`
  : '<p>Nenhuma nova sugestão esta semana.</p>'
}
`;
}
