import "https://deno.land/x/xhr@0.1.0/mod.ts";
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

    console.log('🔍 Analyzing feed engagement...');

    // Buscar posts com alto engajamento nos últimos 7 dias
    const { data: topPosts, error: postsError } = await supabase
      .from('feed_engagement_stats')
      .select('*')
      .order('weighted_engagement_score', { ascending: false })
      .limit(10);

    if (postsError) {
      console.error('Error fetching engagement stats:', postsError);
      throw postsError;
    }

    console.log(`📊 Found ${topPosts?.length || 0} top posts`);

    // Se não houver LOVABLE_API_KEY, retornar apenas as estatísticas
    if (!lovableApiKey) {
      console.warn('LOVABLE_API_KEY not configured, returning stats only');
      return new Response(
        JSON.stringify({
          top_posts: topPosts,
          recommendations: [],
          ai_analysis: null,
          message: 'AI analysis disabled - configure LOVABLE_API_KEY to enable'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Preparar dados para análise da IA
    const postsContext = topPosts.map(p => ({
      title: p.title,
      type: p.type,
      reactions: p.total_reactions,
      comments: p.comments_count,
      score: p.engagement_score,
      hours_ago: Math.round(p.hours_since_posted)
    }));

    const prompt = `
Você é um especialista em cultura organizacional e engajamento interno.

Analise os posts com maior engajamento nos últimos 7 dias:

${JSON.stringify(postsContext, null, 2)}

TAREFA:
1. Identifique os 3 posts com melhor engajamento que merecem destaque na aba de Cultura/Reconhecimento
2. Explique por que cada post teve sucesso
3. Sugira ações para manter o engajamento alto
4. Recomende tipos de conteúdo similares para criar

Retorne em formato JSON:
{
  "featured_posts": [
    {
      "title": "título do post",
      "reason": "motivo do destaque (máx 80 caracteres)",
      "action": "ação recomendada (máx 100 caracteres)"
    }
  ],
  "insights": "análise geral do engajamento (máx 200 caracteres)",
  "content_suggestions": ["sugestão 1", "sugestão 2", "sugestão 3"]
}
`;

    console.log('🤖 Calling AI for engagement analysis...');

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: 'Você é um especialista em cultura organizacional. Sempre retorne JSON válido.'
          },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('AI Gateway error:', response.status, errorText);
      
      // Retornar dados mesmo sem IA
      return new Response(
        JSON.stringify({
          top_posts: topPosts,
          recommendations: [],
          ai_analysis: null,
          error: 'AI analysis failed'
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const data = await response.json();
    const aiContent = data.choices[0].message.content;
    
    let analysis;
    try {
      // Tentar extrair JSON do conteúdo
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        analysis = JSON.parse(jsonMatch[0]);
      } else {
        analysis = JSON.parse(aiContent);
      }
    } catch (parseError) {
      console.error('Failed to parse AI response:', aiContent);
      analysis = {
        featured_posts: [],
        insights: 'Análise indisponível',
        content_suggestions: []
      };
    }

    console.log('✅ Engagement analysis completed');

    return new Response(
      JSON.stringify({
        top_posts: topPosts,
        recommendations: analysis.featured_posts || [],
        insights: analysis.insights || '',
        content_suggestions: analysis.content_suggestions || [],
        analyzed_at: new Date().toISOString()
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in analyze-feed-engagement function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
