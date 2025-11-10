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

    const { content_type, content_id, title, content, metadata } = await req.json();

    if (!content_type || !content_id || !title) {
      throw new Error('content_type, content_id, and title are required');
    }

    console.log(`📝 Indexing single item: ${content_type}/${content_id}`);

    // Gerar embedding
    const text = `${title} ${content || ''}`;
    const embedding = await generateRealEmbedding(lovableApiKey, text);

    // Upsert (inserir ou atualizar)
    const { error } = await supabaseClient
      .from('search_index')
      .upsert({
        content_type,
        content_id,
        title: title.substring(0, 200),
        content: text,
        embedding,
        metadata: metadata || {},
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'content_id,content_type'
      });

    if (error) throw error;

    console.log(`✅ Successfully indexed ${content_type}/${content_id}`);

    return new Response(
      JSON.stringify({ success: true }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in search-index-single:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

async function generateRealEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text.substring(0, 8000),
      dimensions: 768
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}
