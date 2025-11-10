import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

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
    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { user_id } = await req.json();
    console.log('📊 Generating daily feed summary for user:', user_id);

    // Get user info for personalization
    const { data: profile } = await supabase
      .from('profiles')
      .select('full_name, role')
      .eq('id', user_id)
      .single();

    // Get posts from the last 24 hours
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    const { data: posts, error: postsError } = await supabase
      .from('feed_posts')
      .select('id, type, title, description, likes_count, comments_count, created_at, audience_roles')
      .gte('created_at', yesterday.toISOString())
      .order('created_at', { ascending: false });

    if (postsError) throw postsError;

    // Filter posts visible to user
    const visiblePosts = posts?.filter(post => {
      if (!post.audience_roles || post.audience_roles.length === 0) return true;
      return post.audience_roles.includes(profile?.role);
    }) || [];

    if (visiblePosts.length === 0) {
      return new Response(
        JSON.stringify({ 
          summary: `🌅 Bom dia${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 

Hoje está tranquilo no feed. Aproveite para revisar conteúdos anteriores ou focar em suas atividades do dia! 💪`,
          has_new_content: false,
          count: 0
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Generate motivational summary with AI
    let aiSummary = null;
    if (lovableApiKey) {
      try {
        const postsList = visiblePosts.map(p => 
          `• ${p.type}: "${p.title}" (${p.likes_count} curtidas)`
        ).join('\n');

        const prompt = `Você é o GiraBot, assistente motivacional da Cresci e Perdi. 

Crie um resumo DIÁRIO curto e animado dos novos conteúdos:

**Novidades de hoje:**
${postsList}

**Regras:**
- Tom motivacional, positivo e próximo (usar "você")
- Máx. 3-4 linhas
- Emojis relevantes (máx. 3)
- Destacar os 2 posts mais importantes
- Incluir call-to-action final
- Estilo comunicador de marca: "Bora", "Vamos lá", "Você consegue"

Exemplo de tom: "🎯 Opa! Hoje temos 2 novidades quentinhas pra você! O novo treinamento de Bioimpedância vai te deixar expert e a campanha do mês já começou. Bora conferir e arrasar! 💪"`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é o GiraBot, assistente animado e motivacional.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.8,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          aiSummary = aiData.choices?.[0]?.message?.content;
          console.log('✅ AI daily summary generated');
        }
      } catch (aiError) {
        console.error('Error generating AI summary:', aiError);
      }
    }

    // Fallback summary if AI fails
    const fallbackSummary = `🌅 Bom dia${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}! 

Hoje temos ${visiblePosts.length} novidade${visiblePosts.length > 1 ? 's' : ''} no feed:
${visiblePosts.slice(0, 3).map(p => `• ${p.title}`).join('\n')}

${visiblePosts.length > 3 ? `\n...e mais ${visiblePosts.length - 3}! ` : ''}Bora conferir! 💪`;

    // Calculate stats
    const stats = {
      total: visiblePosts.length,
      by_type: visiblePosts.reduce((acc, p) => {
        acc[p.type] = (acc[p.type] || 0) + 1;
        return acc;
      }, {} as Record<string, number>),
      most_engaging: visiblePosts.reduce((max, p) => {
        const engagement = (p.likes_count || 0) + (p.comments_count || 0);
        const maxEngagement = (max.likes_count || 0) + (max.comments_count || 0);
        return engagement > maxEngagement ? p : max;
      }, visiblePosts[0])
    };

    return new Response(
      JSON.stringify({ 
        summary: aiSummary || fallbackSummary,
        has_new_content: true,
        count: visiblePosts.length,
        stats,
        posts: visiblePosts.slice(0, 5).map(p => ({
          id: p.id,
          title: p.title,
          type: p.type,
        }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in feed-daily-summary:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
