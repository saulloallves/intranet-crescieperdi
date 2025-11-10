import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('📊 Generating weekly feed summary...');

    // Get posts from the last 7 days
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const { data: posts, error: postsError } = await supabase
      .from('feed_posts')
      .select('id, type, title, likes_count, comments_count, created_at')
      .gte('created_at', sevenDaysAgo.toISOString())
      .order('created_at', { ascending: false });

    if (postsError) {
      console.error('Error fetching posts:', postsError);
      throw postsError;
    }

    if (!posts || posts.length === 0) {
      return new Response(
        JSON.stringify({ 
          summary: '📭 Nenhum conteúdo publicado na última semana.',
          stats: { total: 0, by_type: {}, engagement: 0, top_post: null }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate statistics
    const statsByType: Record<string, number> = {};
    let totalLikes = 0;
    let totalComments = 0;

    posts.forEach(post => {
      statsByType[post.type] = (statsByType[post.type] || 0) + 1;
      totalLikes += post.likes_count || 0;
      totalComments += post.comments_count || 0;
    });

    // Find most engaging post
    const topPost = posts.reduce((max, post) => {
      const currentEngagement = (post.likes_count || 0) + (post.comments_count || 0);
      const maxEngagement = (max.likes_count || 0) + (max.comments_count || 0);
      return currentEngagement > maxEngagement ? post : max;
    }, posts[0]);

    const engagementRate = Math.round(((totalLikes + totalComments) / posts.length));

    const stats = {
      total: posts.length,
      by_type: statsByType,
      engagement: engagementRate,
      top_post: {
        title: topPost.title,
        likes: topPost.likes_count || 0,
        comments: topPost.comments_count || 0,
      }
    };

    // Generate AI summary if Lovable AI is available
    let aiSummary = null;
    if (lovableApiKey) {
      try {
        console.log('🤖 Generating AI insights...');
        
        const prompt = `Analise o resumo semanal do feed corporativo e gere insights acionáveis:

📊 **Estatísticas:**
- Total de publicações: ${posts.length}
- Tipos publicados: ${Object.entries(statsByType).map(([type, count]) => `${type}: ${count}`).join(', ')}
- Engajamento médio: ${engagementRate} interações/post
- Post mais popular: "${topPost.title}" (${topPost.likes_count} curtidas, ${topPost.comments_count} comentários)

**Tarefas:**
1. Identifique padrões de engajamento (quais tipos de conteúdo performam melhor)
2. Sugira melhorias na estratégia de conteúdo
3. Destaque oportunidades de aumentar o alcance
4. Recomende ações para a próxima semana

Formato: Texto conciso, 3-4 parágrafos, tom profissional mas acessível.`;

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
                content: 'Você é um analista de engajamento de conteúdo corporativo. Gere insights práticos e acionáveis.' 
              },
              { role: 'user', content: prompt }
            ],
            temperature: 0.7,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content;
          console.log('✅ AI insights generated');
        } else {
          console.warn('AI request failed:', await aiResponse.text());
        }
      } catch (aiError) {
        console.error('Error generating AI insights:', aiError);
      }
    }

    // Format summary text
    const typeLabels: Record<string, string> = {
      training: 'treinamentos',
      checklist: 'rotinas',
      manual: 'manuais',
      campaign: 'campanhas',
      recognition: 'reconhecimentos',
      idea: 'ideias',
      media: 'mídias',
      survey: 'pesquisas',
      announcement: 'comunicados',
    };

    const typesSummary = Object.entries(statsByType)
      .map(([type, count]) => `• ${count} ${typeLabels[type] || type}`)
      .join('\n');

    const textSummary = `📆 **Resumo Semanal — Feed Cresci e Perdi**

📊 **Estatísticas:**
• ${posts.length} novos conteúdos publicados
${typesSummary}
• Engajamento geral: ${engagementRate} interações/post

🏆 **Post mais engajado:**
"${topPost.title}"
${topPost.likes_count} curtidas • ${topPost.comments_count} comentários

💡 **Totais:**
${totalLikes} curtidas • ${totalComments} comentários`;

    return new Response(
      JSON.stringify({ 
        summary: textSummary,
        ai_insights: aiSummary,
        stats,
        period: {
          start: sevenDaysAgo.toISOString(),
          end: new Date().toISOString(),
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in feed-weekly-summary:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
