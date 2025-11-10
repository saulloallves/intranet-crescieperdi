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

    console.log('🔄 Starting search index rebuild...');

    // Clear existing index
    await supabaseClient.from('search_index').delete().neq('id', '00000000-0000-0000-0000-000000000000');

    const allItems: any[] = [];

    // Buscar todos os conteúdos em paralelo
    const [
      { data: announcements },
      { data: trainings },
      { data: manuals },
      { data: checklists },
      { data: ideas },
      { data: campaigns },
      { data: feedPosts }
    ] = await Promise.all([
      supabaseClient.from('announcements').select('id, title, content, target_roles, target_units').eq('is_published', true),
      supabaseClient.from('trainings').select('id, title, description, content').eq('is_published', true),
      supabaseClient.from('knowledge_base').select('id, title, content, tags').eq('is_published', true),
      supabaseClient.from('checklists').select('id, title, description, applicable_units').eq('is_active', true),
      supabaseClient.from('ideas').select('id, title, description, category').in('status', ['approved', 'voting', 'implementing']),
      supabaseClient.from('campaigns').select('id, title, description, target_roles, target_units').eq('is_active', true),
      supabaseClient.from('feed_posts').select('id, type, title, description, audience_roles, audience_units').eq('pinned', true).gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
    ]);

    // Preparar todos os itens para indexação
    for (const item of announcements || []) {
      allItems.push({
        type: 'announcement',
        id: item.id,
        text: `${item.title} ${item.content || ''}`,
        metadata: {
          target_roles: item.target_roles || [],
          target_units: item.target_units || []
        }
      });
    }

    for (const item of trainings || []) {
      const text = `${item.title} ${item.description || ''} ${item.content || ''}`;
      allItems.push({
        type: 'training',
        id: item.id,
        text,
        metadata: {}
      });
    }

    for (const item of manuals || []) {
      allItems.push({
        type: 'manual',
        id: item.id,
        text: `${item.title} ${item.content || ''}`,
        metadata: { tags: item.tags || [] }
      });
    }

    for (const item of checklists || []) {
      allItems.push({
        type: 'checklist',
        id: item.id,
        text: `${item.title} ${item.description || ''}`,
        metadata: { applicable_units: item.applicable_units || [] }
      });
    }

    for (const item of ideas || []) {
      allItems.push({
        type: 'idea',
        id: item.id,
        text: `${item.title} ${item.description}`,
        metadata: { category: item.category }
      });
    }

    for (const item of campaigns || []) {
      allItems.push({
        type: 'campaign',
        id: item.id,
        text: `${item.title} ${item.description}`,
        metadata: {
          target_roles: item.target_roles || [],
          target_units: item.target_units || []
        }
      });
    }

    for (const item of feedPosts || []) {
      allItems.push({
        type: 'feed_post',
        id: item.id,
        text: `${item.title} ${item.description || ''}`,
        metadata: {
          post_type: item.type,
          audience_roles: item.audience_roles || [],
          audience_units: item.audience_units || []
        }
      });
    }

    console.log(`📚 Found ${allItems.length} items to index`);

    // Processar em batches de 10 (paralelo)
    const batches = chunk(allItems, 10);
    const indexedItems: any[] = [];
    let totalIndexed = 0;
    let totalFailed = 0;

    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`⏳ Processing batch ${i + 1}/${batches.length} (${batch.length} items)...`);

      const results = await Promise.all(
        batch.map(async (item) => {
          try {
            const embedding = await generateRealEmbedding(lovableApiKey, item.text);
            return {
              content_type: item.type,
              content_id: item.id,
              title: item.text.split(' ').slice(0, 10).join(' '),
              content: item.text,
              embedding,
              metadata: item.metadata,
              success: true
            };
          } catch (error) {
            console.error(`❌ Failed to embed ${item.type}/${item.id}:`, error);
            return { success: false };
          }
        })
      );

      const successful = results.filter(r => r.success);
      const failed = results.filter(r => !r.success);

      if (successful.length > 0) {
        indexedItems.push(...successful);
      }

      totalIndexed += successful.length;
      totalFailed += failed.length;

      console.log(`✅ Batch ${i + 1} done: ${successful.length}/${batch.length} successful`);
    }

    // Inserir todos os itens indexados de uma vez
    if (indexedItems.length > 0) {
      const { error: insertError } = await supabaseClient
        .from('search_index')
        .insert(indexedItems);

      if (insertError) {
        console.error('Insert error:', insertError);
        throw insertError;
      }
    }

    console.log(`🎉 Successfully indexed ${totalIndexed} items (${totalFailed} failed)`);

    return new Response(
      JSON.stringify({
        success: true,
        indexed: totalIndexed,
        failed: totalFailed,
        total: allItems.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('❌ Error in search-index:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});

// Gerar embedding REAL usando Lovable AI
async function generateRealEmbedding(apiKey: string, text: string): Promise<number[]> {
  const response = await fetch('https://ai.gateway.lovable.dev/v1/embeddings', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'text-embedding-3-large',
      input: text.substring(0, 8000), // Limite de tokens
      dimensions: 768
    }),
  });

  if (!response.ok) {
    throw new Error(`Embedding API error: ${response.status}`);
  }

  const data = await response.json();
  return data.data[0].embedding;
}

// Dividir array em chunks
function chunk<T>(array: T[], size: number): T[][] {
  const chunks: T[][] = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}
