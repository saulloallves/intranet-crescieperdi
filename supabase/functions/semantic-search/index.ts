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

  const startTime = Date.now();

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    );

    const lovableApiKey = Deno.env.get('LOVABLE_API_KEY');
    if (!lovableApiKey) {
      throw new Error('LOVABLE_API_KEY not configured');
    }

    const { query, filters, limit = 10 } = await req.json();

    if (!query || query.length < 2) {
      throw new Error('Query is required and must be at least 2 characters');
    }

    console.log('🔍 Search query:', query, 'filters:', filters);

    // Gerar embedding REAL da query usando Lovable AI
    const embeddingResponse = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${lovableApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'text-embedding-3-large',
        input: query,
        dimensions: 768
      })
    });

    if (!embeddingResponse.ok) {
      console.error('Embedding API error:', embeddingResponse.status);
      throw new Error('Failed to generate query embedding');
    }

    const embeddingData = await embeddingResponse.json();
    const queryEmbedding = embeddingData.data[0].embedding;

    console.log('✅ Generated query embedding');

    // Busca vetorial usando RPC
    const { data: vectorResults, error: vectorError } = await supabaseClient
      .rpc('match_search_embeddings', {
        query_embedding: queryEmbedding,
        match_threshold: 0.6,
        match_count: limit * 2,
        filter_types: filters?.contentTypes || null
      });

    if (vectorError) {
      console.error('Vector search error:', vectorError);
    }

    console.log(`📊 Vector search found ${vectorResults?.length || 0} results`);

    // Busca full-text (backup/complementar)
    let textSearchQuery = supabaseClient
      .from('search_index')
      .select('id, content_type, content_id, title, content, metadata, created_at')
      .textSearch('content', query, { type: 'websearch', config: 'portuguese' })
      .limit(limit);

    if (filters?.contentTypes && filters.contentTypes.length > 0) {
      textSearchQuery = textSearchQuery.in('content_type', filters.contentTypes);
    }

    const { data: textResults } = await textSearchQuery;

    console.log(`📝 Text search found ${textResults?.length || 0} results`);

    // Combinar e remover duplicatas
    const combinedResults = mergeResultsByRelevance(
      vectorResults || [],
      textResults || [],
      limit
    );

    const noResults = combinedResults.length === 0;

    // Calcular latência
    const latency = Date.now() - startTime;

    // Log da busca
    const authHeader = req.headers.get('Authorization');
    let userId = null;
    
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);
      userId = user?.id || null;
    }

    await supabaseClient
      .from('search_logs')
      .insert({
        user_id: userId,
        query,
        results_count: combinedResults.length,
        filters,
        latency_ms: latency,
        no_results: noResults
      });

    // Criar ou atualizar sugestão se não houver resultados
    if (noResults && query.length >= 3) {
      await createOrUpdateContentSuggestion(supabaseClient, query);
    }

    // Gerar sugestões inteligentes
    const suggestions = noResults 
      ? await generateSmartSuggestions(query, lovableApiKey)
      : generateBasicSuggestions(query, combinedResults);

    console.log(`✅ Search completed in ${latency}ms`);

    return new Response(
      JSON.stringify({
        results: combinedResults,
        suggestions,
        count: combinedResults.length,
        latency_ms: latency,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error in semantic-search:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Combinar resultados vetoriais e textuais
function mergeResultsByRelevance(
  vectorResults: any[],
  textResults: any[],
  limit: number
): any[] {
  const seenIds = new Set<string>();
  const merged: any[] = [];

  // Priorizar resultados vetoriais (mais relevantes semanticamente)
  for (const result of vectorResults) {
    const key = `${result.content_type}-${result.content_id}`;
    if (!seenIds.has(key)) {
      merged.push({ 
        ...result, 
        source: 'vector',
        relevance_score: result.similarity || 0.8
      });
      seenIds.add(key);
    }
  }

  // Adicionar resultados textuais únicos
  for (const result of textResults) {
    const key = `${result.content_type}-${result.content_id}`;
    if (!seenIds.has(key) && merged.length < limit) {
      merged.push({ 
        ...result, 
        source: 'text',
        relevance_score: 0.6
      });
      seenIds.add(key);
    }
  }

  return merged
    .sort((a, b) => (b.relevance_score || 0) - (a.relevance_score || 0))
    .slice(0, limit);
}

// Criar ou atualizar sugestão de conteúdo
async function createOrUpdateContentSuggestion(
  supabase: any,
  term: string
) {
  try {
    // Verificar se já existe
    const { data: existing } = await supabase
      .from('content_suggestions')
      .select('*')
      .ilike('term', term)
      .maybeSingle();

    if (existing) {
      // Atualizar contagem
      await supabase
        .from('content_suggestions')
        .update({
          search_count: existing.search_count + 1,
          last_searched_at: new Date().toISOString(),
          priority_score: existing.search_count + 1
        })
        .eq('id', existing.id);
      
      console.log(`📈 Updated suggestion count for: ${term}`);
    } else {
      // Criar nova
      await supabase
        .from('content_suggestions')
        .insert({
          term,
          search_count: 1,
          status: 'pending',
          priority_score: 1
        });
      
      console.log(`💡 Created new suggestion: ${term}`);
    }
  } catch (error) {
    console.error('Error managing suggestion:', error);
  }
}

// Gerar sugestões inteligentes com IA quando não há resultados
async function generateSmartSuggestions(
  query: string,
  apiKey: string
): Promise<string[]> {
  try {
    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash-lite',
        messages: [{
          role: 'user',
          content: `Reformule esta busca de 3 formas diferentes, corrigindo possíveis erros de digitação: "${query}". Retorne apenas as 3 sugestões, uma por linha, sem numeração.`
        }]
      })
    });

    if (aiResponse.ok) {
      const data = await aiResponse.json();
      const suggestions = data.choices[0].message.content
        .split('\n')
        .filter((s: string) => s.trim().length > 0)
        .slice(0, 3);
      return suggestions;
    }
  } catch (error) {
    console.error('Error generating AI suggestions:', error);
  }

  return [
    `${query} manual`,
    `${query} treinamento`,
    `como ${query}`
  ];
}

// Gerar sugestões básicas quando há resultados
function generateBasicSuggestions(query: string, results: any[]): string[] {
  const suggestions: Set<string> = new Set();
  
  const keywords = query.toLowerCase().split(' ').filter(w => w.length > 3);
  const contentTypes = [...new Set(results.map(r => r.content_type))];
  
  contentTypes.forEach(type => {
    const keyword = keywords[0] || 'procedimentos';
    if (type === 'training') {
      suggestions.add(`treinamento sobre ${keyword}`);
    } else if (type === 'announcement') {
      suggestions.add(`comunicado sobre ${keyword}`);
    } else if (type === 'manual') {
      suggestions.add(`manual de ${keyword}`);
    }
  });

  return Array.from(suggestions).slice(0, 5);
}
