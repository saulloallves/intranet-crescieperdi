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

    console.log('📊 Gerando relatório semanal do Mural...');

    // Data de 7 dias atrás
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const weekAgoISO = weekAgo.toISOString();

    // 1. Buscar estatísticas de posts
    const { data: posts, error: postsError } = await supabase
      .from('mural_posts')
      .select('id, status, category_id, approval_source, created_at, mural_categories(name)')
      .gte('created_at', weekAgoISO);

    if (postsError) throw postsError;

    // 2. Buscar estatísticas de respostas
    const { data: responses, error: responsesError } = await supabase
      .from('mural_responses')
      .select('id, status, approval_source, created_at')
      .gte('created_at', weekAgoISO);

    if (responsesError) throw responsesError;

    // 3. Calcular métricas
    const totalPosts = posts?.length || 0;
    const totalResponses = responses?.length || 0;
    const approvedPosts = posts?.filter(p => p.status === 'approved').length || 0;
    const aiApprovedPosts = posts?.filter(p => p.approval_source === 'ai').length || 0;
    const aiApprovalRate = totalPosts > 0 ? Math.round((aiApprovedPosts / totalPosts) * 100) : 0;

    // 4. Categorias mais ativas
    const categoryStats: Record<string, number> = {};
    posts?.forEach(post => {
      const categoryName = (post.mural_categories as any)?.name || 'Sem categoria';
      categoryStats[categoryName] = (categoryStats[categoryName] || 0) + 1;
    });

    const topCategories = Object.entries(categoryStats)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([name, count]) => ({ name, count, percentage: Math.round((count / totalPosts) * 100) }));

    // 5. Gerar relatório com IA
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
    let aiInsights = '';

    if (LOVABLE_API_KEY) {
      try {
        const aiPrompt = `Você é o GiraBot, analista do Mural Cresci e Perdi.

Dados da última semana:
- ${totalPosts} pedidos de ajuda publicados
- ${totalResponses} respostas recebidas
- ${approvedPosts} posts aprovados (${aiApprovalRate}% aprovação automática pela IA)
- Categorias mais ativas: ${topCategories.map(c => `${c.name} (${c.percentage}%)`).join(', ')}

Gere um resumo executivo de 3-4 linhas destacando:
1. Principal insight sobre engajamento
2. Categoria com maior demanda
3. Qualidade da moderação automática
4. Recomendação para melhorias

Seja objetivo e direto.`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${LOVABLE_API_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um analista de dados de engajamento interno.' },
              { role: 'user', content: aiPrompt }
            ],
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiInsights = aiData.choices?.[0]?.message?.content?.trim() || '';
        }
      } catch (aiError) {
        console.error('Erro ao gerar insights IA:', aiError);
      }
    }

    // 6. Montar relatório final
    const report = {
      period: {
        start: weekAgoISO,
        end: new Date().toISOString(),
      },
      summary: {
        total_posts: totalPosts,
        total_responses: totalResponses,
        approved_posts: approvedPosts,
        ai_approval_rate: aiApprovalRate,
        average_responses_per_post: totalPosts > 0 ? (totalResponses / totalPosts).toFixed(1) : 0,
      },
      top_categories: topCategories,
      ai_insights: aiInsights,
      generated_at: new Date().toISOString(),
    };

    console.log('✅ Relatório gerado:', report);

    // 7. Notificar admins com o relatório
    const { data: admins } = await supabase
      .from('profiles')
      .select('id, full_name')
      .in('role', ['admin', 'gestor_setor'])
      .eq('is_active', true);

    const reportMessage = `📊 **Relatório Semanal - Mural Cresci e Perdi**

Esta semana: ${totalPosts} pedidos de ajuda, ${totalResponses} respostas.

Categorias mais ativas: ${topCategories.map(c => `${c.name} (${c.percentage}%)`).join(', ')}.

${aiApprovalRate}% das postagens aprovadas automaticamente pela IA.

${aiInsights}`;

    if (admins) {
      for (const admin of admins) {
        await supabase.from('notifications').insert({
          user_id: admin.id,
          title: '📊 Relatório Semanal do Mural',
          message: reportMessage,
          type: 'mural_report',
          is_read: false,
        });
      }
      console.log(`✅ Relatório enviado para ${admins.length} administradores`);
    }

    // 8. Opcionalmente criar post no feed
    const { data: feedConfig } = await supabase
      .from('automation_settings')
      .select('value')
      .eq('key', 'mural_feed_integration')
      .single();

    if (feedConfig?.value !== 'false') {
      await supabase.from('feed_posts').insert({
        type: 'mural_report',
        title: '📊 Relatório Semanal do Mural',
        description: reportMessage.substring(0, 500),
        module_link: '/admin?tab=mural',
        pinned: false,
      });
      console.log('✅ Relatório publicado no feed');
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        report
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in mural-weekly-report:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
