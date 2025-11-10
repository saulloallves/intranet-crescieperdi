import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
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
    console.log('Iniciando sincronização do Notion...');

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar configurações do Notion
    const { data: settings, error: settingsError } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['notion_api_key', 'notion_database_id']);

    if (settingsError) {
      console.error('Erro ao buscar configurações:', settingsError);
      throw settingsError;
    }

    const notionApiKey = settings?.find(s => s.key === 'notion_api_key')?.value;
    const notionDatabaseId = settings?.find(s => s.key === 'notion_database_id')?.value;

    if (!notionApiKey || !notionDatabaseId) {
      throw new Error('Configurações do Notion não encontradas. Configure NOTION_API_KEY e NOTION_DATABASE_ID.');
    }

    console.log('Buscando páginas do Notion...');

    // Buscar páginas do database do Notion
    const notionResponse = await fetch(
      `https://api.notion.com/v1/databases/${notionDatabaseId}/query`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${notionApiKey}`,
          'Notion-Version': '2022-06-28',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          page_size: 100,
        }),
      }
    );

    if (!notionResponse.ok) {
      const errorText = await notionResponse.text();
      console.error('Erro ao buscar do Notion:', errorText);
      throw new Error(`Erro na API do Notion: ${notionResponse.status}`);
    }

    const notionData = await notionResponse.json();
    console.log(`Encontradas ${notionData.results.length} páginas no Notion`);

    let syncedCount = 0;
    let errorCount = 0;

    // Processar cada página
    for (const page of notionData.results) {
      try {
        // Extrair propriedades da página
        const properties = page.properties;
        
        const title = properties.Título?.title?.[0]?.plain_text || 
                     properties.Title?.title?.[0]?.plain_text || 
                     properties.Nome?.title?.[0]?.plain_text ||
                     'Sem título';
        
        const category = properties.Categoria?.select?.name || 
                        properties.Category?.select?.name ||
                        'Geral';
        
        const tags = properties.Tags?.multi_select?.map((t: any) => t.name) || [];
        
        // Buscar o conteúdo da página
        const contentResponse = await fetch(
          `https://api.notion.com/v1/blocks/${page.id}/children`,
          {
            headers: {
              'Authorization': `Bearer ${notionApiKey}`,
              'Notion-Version': '2022-06-28',
            },
          }
        );

        let content = '';
        if (contentResponse.ok) {
          const contentData = await contentResponse.json();
          content = contentData.results
            .map((block: any) => {
              if (block.type === 'paragraph') {
                return block.paragraph?.rich_text?.map((t: any) => t.plain_text).join('') || '';
              }
              if (block.type === 'heading_1') {
                return block.heading_1?.rich_text?.map((t: any) => t.plain_text).join('') || '';
              }
              if (block.type === 'heading_2') {
                return block.heading_2?.rich_text?.map((t: any) => t.plain_text).join('') || '';
              }
              if (block.type === 'heading_3') {
                return block.heading_3?.rich_text?.map((t: any) => t.plain_text).join('') || '';
              }
              if (block.type === 'bulleted_list_item') {
                return '• ' + (block.bulleted_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '');
              }
              if (block.type === 'numbered_list_item') {
                return (block.numbered_list_item?.rich_text?.map((t: any) => t.plain_text).join('') || '');
              }
              return '';
            })
            .filter((text: string) => text.trim())
            .join('\n\n');
        }

        if (!content || content.trim().length < 10) {
          content = 'Documento sem conteúdo ou visualize no Notion para mais detalhes.';
        }

        // Verificar se já existe
        const { data: existing } = await supabaseClient
          .from('knowledge_base')
          .select('id')
          .eq('external_id', page.id)
          .single();

        const manualData = {
          title,
          content,
          category,
          tags,
          external_id: page.id,
          external_source: 'notion',
          is_published: true,
          file_url: page.url,
        };

        if (existing) {
          // Atualizar
          const { error: updateError } = await supabaseClient
            .from('knowledge_base')
            .update(manualData)
            .eq('id', existing.id);

          if (updateError) {
            console.error('Erro ao atualizar:', updateError);
            errorCount++;
          } else {
            syncedCount++;
          }
        } else {
          // Inserir
          const { error: insertError } = await supabaseClient
            .from('knowledge_base')
            .insert(manualData);

          if (insertError) {
            console.error('Erro ao inserir:', insertError);
            errorCount++;
          } else {
            syncedCount++;
          }
        }
      } catch (pageError) {
        console.error('Erro ao processar página:', pageError);
        errorCount++;
      }
    }

    console.log(`Sincronização concluída: ${syncedCount} sucesso, ${errorCount} erros`);

    // Reindexar busca após sincronização
    try {
      await supabaseClient.functions.invoke('search-index');
      console.log('Reindexação da busca iniciada');
    } catch (reindexError) {
      console.error('Erro ao reindexar:', reindexError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        synced: syncedCount,
        errors: errorCount,
        total: notionData.results.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error) {
    console.error('Erro na sincronização:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Erro desconhecido',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
