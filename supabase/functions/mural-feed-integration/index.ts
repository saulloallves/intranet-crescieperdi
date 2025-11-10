import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedIntegrationRequest {
  post_id: string;
  approval_source: 'auto' | 'admin' | 'ai';
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { post_id, approval_source }: FeedIntegrationRequest = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📢 Integrando post ${post_id} do Mural ao Feed (aprovação: ${approval_source})`);

    // Buscar post do mural com dados da categoria
    const { data: muralPost, error: fetchError } = await supabase
      .from('mural_posts')
      .select(`
        *,
        category:mural_categories!mural_posts_category_id_fkey(name, key)
      `)
      .eq('id', post_id)
      .single();

    if (fetchError || !muralPost) {
      throw new Error(`Post não encontrado: ${fetchError?.message}`);
    }

    // Verificar se post já foi integrado ao feed
    const { data: existingFeedPost } = await supabase
      .from('feed_posts')
      .select('id')
      .eq('type', 'mural')
      .eq('module_link', `/mural/${post_id}`)
      .single();

    if (existingFeedPost) {
      console.log('⚠️ Post já integrado ao Feed anteriormente');
      return new Response(
        JSON.stringify({ 
          success: true,
          message: 'Post já estava no Feed',
          feed_post_id: existingFeedPost.id
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Contar respostas aprovadas
    const { count: responsesCount } = await supabase
      .from('mural_responses')
      .select('*', { count: 'exact', head: true })
      .eq('post_id', post_id)
      .eq('status', 'approved');

    // Criar título dinâmico baseado na origem da aprovação
    let titlePrefix = '💬';
    if (approval_source === 'ai') titlePrefix = '🤖';
    if (approval_source === 'admin') titlePrefix = '✅';
    
    const responseText = responsesCount && responsesCount > 0 
      ? ` - ${responsesCount} ${responsesCount === 1 ? 'resposta' : 'respostas'}`
      : '';

    const categoryName = muralPost.category?.name || 'Mural';
    const feedTitle = `${titlePrefix} ${categoryName}${responseText}`;
    const feedDescription = muralPost.content_clean || muralPost.content;

    // Criar post no Feed
    const { data: feedPost, error: insertError } = await supabase
      .from('feed_posts')
      .insert({
        type: 'mural',
        title: feedTitle,
        description: feedDescription,
        module_link: `/mural/${post_id}`,
        created_by: muralPost.author_id,
        pinned: false,
        likes_count: 0,
        comments_count: 0
      })
      .select()
      .single();

    if (insertError) {
      throw new Error(`Erro ao criar post no Feed: ${insertError.message}`);
    }

    console.log(`✅ Post integrado ao Feed com sucesso! Feed ID: ${feedPost.id}`);

    // Registrar integração no mural_post (criar campo metadata se necessário)
    await supabase
      .from('mural_posts')
      .update({ 
        metadata: {
          ...(muralPost.metadata || {}),
          feed_post_id: feedPost.id,
          feed_integrated_at: new Date().toISOString(),
          feed_integration_source: approval_source
        }
      })
      .eq('id', post_id);

    // Criar notificação para o autor se foi aprovado por IA
    if (approval_source === 'ai' && muralPost.author_id) {
      try {
        await supabase.from('notifications').insert({
          user_id: muralPost.author_id,
          title: '🧠 Sua postagem foi aprovada pela IA',
          message: 'Seu pedido no Mural Cresci e Perdi foi aprovado automaticamente e está visível para todos.',
          type: 'mural_approved',
          reference_id: post_id,
          is_read: false
        });
        console.log('✅ Notificação criada para o autor');
      } catch (notifError) {
        console.error('Erro ao criar notificação:', notifError);
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        feed_post_id: feedPost.id,
        message: 'Post integrado ao Feed com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in mural-feed-integration:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: error.message
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
