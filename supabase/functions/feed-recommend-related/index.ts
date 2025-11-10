import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Content relationship mapping
const RELATED_TYPES: Record<string, string[]> = {
  'training': ['manual', 'checklist', 'media'],
  'checklist': ['training', 'manual'],
  'manual': ['training', 'checklist', 'media'],
  'campaign': ['recognition', 'training'],
  'recognition': ['campaign'],
  'idea': ['manual', 'training'],
  'media': ['training', 'manual'],
  'survey': ['announcement'],
  'announcement': ['training', 'campaign', 'manual'],
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

    const { post_id, user_id } = await req.json();
    console.log('🔗 Finding related posts for:', post_id);

    // Get the source post
    const { data: sourcePost, error: sourceError } = await supabase
      .from('feed_posts')
      .select('*')
      .eq('id', post_id)
      .single();

    if (sourceError || !sourcePost) {
      throw new Error('Post not found');
    }

    // Get user profile for filtering
    const { data: profile } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .maybeSingle();

    // Find related content types
    const relatedTypes = RELATED_TYPES[sourcePost.type] || [];

    // Query for related posts
    const { data: relatedPosts } = await supabase
      .from('feed_posts')
      .select('*')
      .in('type', relatedTypes)
      .neq('id', post_id)
      .order('created_at', { ascending: false })
      .limit(20);

    // Filter by user role
    const visiblePosts = relatedPosts?.filter(post => {
      if (!post.target_roles || post.target_roles.length === 0) return true;
      return post.target_roles.includes(profile?.role);
    }) || [];

    if (visiblePosts.length === 0) {
      return new Response(
        JSON.stringify({ 
          recommendations: [],
          message: 'Nenhum conteúdo relacionado encontrado no momento.'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Use AI to rank and explain relationships (if available)
    let aiRanking = null;
    if (lovableApiKey) {
      try {
        const postsList = visiblePosts.slice(0, 10).map(p => 
          `ID: ${p.id}, Tipo: ${p.type}, Título: "${p.title}", Descrição: "${p.description.substring(0, 100)}"`
        ).join('\n');

        const prompt = `Post original: "${sourcePost.title}" (${sourcePost.type})

Posts relacionados disponíveis:
${postsList}

Analise e retorne JSON com os 3 posts mais relevantes, ordenados por relevância:

{
  "recommendations": [
    {
      "post_id": "uuid",
      "relevance_score": 0-100,
      "reason": "Explicação curta e motivacional do porque é relevante (máx. 50 chars)"
    }
  ]
}

Critérios:
- Priorize complementaridade (manual relacionado a treinamento, checklist relacionado a procedimento)
- Considere sequência lógica de aprendizado
- Razões devem ser motivacionais: "Completa seu conhecimento", "Próximo passo", "Vai te ajudar"`;

        const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${lovableApiKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'google/gemini-2.5-flash',
            messages: [
              { role: 'system', content: 'Você é um sistema de recomendação inteligente. Retorne apenas JSON válido.' },
              { role: 'user', content: prompt }
            ],
            temperature: 0.3,
          }),
        });

        if (aiResponse.ok) {
          const aiData = await aiResponse.json();
          const content = aiData.choices?.[0]?.message?.content;
          try {
            aiRanking = JSON.parse(content);
            console.log('✅ AI ranking generated');
          } catch {
            console.warn('Failed to parse AI response as JSON');
          }
        }
      } catch (aiError) {
        console.error('Error generating AI ranking:', aiError);
      }
    }

    // Build final recommendations
    let recommendations;
    if (aiRanking?.recommendations) {
      recommendations = aiRanking.recommendations.map((rec: any) => {
        const post = visiblePosts.find(p => p.id === rec.post_id);
        return post ? { ...post, reason: rec.reason, relevance_score: rec.relevance_score } : null;
      }).filter(Boolean).slice(0, 3);
    } else {
      // Fallback: simple type-based recommendations
      const typeReasons: Record<string, string> = {
        'training': '📚 Aprofunde seu conhecimento',
        'manual': '📖 Guia prático relacionado',
        'checklist': '✅ Procedimento complementar',
        'campaign': '🎯 Meta relacionada',
        'media': '🎬 Material de apoio',
      };

      recommendations = visiblePosts.slice(0, 3).map(post => ({
        ...post,
        reason: typeReasons[post.type] || '💡 Pode te interessar',
        relevance_score: 75
      }));
    }

    return new Response(
      JSON.stringify({ 
        recommendations,
        source_post: {
          id: sourcePost.id,
          title: sourcePost.title,
          type: sourcePost.type,
        }
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in feed-recommend-related:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
