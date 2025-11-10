import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

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

    console.log('[Cron] Verificando votações expiradas...');

    // Buscar ideias em votação com prazo expirado
    const { data: expiredIdeas, error } = await supabase
      .from('ideas')
      .select('*')
      .eq('status', 'em_votacao')
      .lt('vote_end', new Date().toISOString());

    if (error) throw error;

    console.log(`[Cron] ${expiredIdeas?.length || 0} votações expiradas encontradas`);

    if (!expiredIdeas || expiredIdeas.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: 'Nenhuma votação expirada' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Obter configuração de quórum mínimo
    const { data: quorumConfig } = await supabase
      .from('settings')
      .select('value')
      .eq('key', 'ideas_voting_quorum')
      .single();

    const minQuorum = quorumConfig?.value?.percentage || 80;

    // Processar cada ideia
    for (const idea of expiredIdeas) {
      const approvalRate = idea.total_votes > 0 
        ? (idea.positive_votes / idea.total_votes) * 100 
        : 0;

      const newStatus = approvalRate >= minQuorum ? 'aprovada' : 'recusada';

      // Atualizar ideia
      await supabase
        .from('ideas')
        .update({
          status: newStatus,
          quorum: approvalRate.toFixed(2),
          resolved_at: new Date().toISOString(),
        })
        .eq('id', idea.id);

      // Criar notificação para o autor
      await supabase
        .from('ideas_notifications')
        .insert({
          user_id: idea.submitted_by,
          idea_id: idea.id,
          type: 'status',
          message: newStatus === 'aprovada'
            ? `🎉 Sua ideia "${idea.title}" foi aprovada pela comunidade com ${approvalRate.toFixed(1)}% de aprovação!`
            : `Sua ideia "${idea.title}" não atingiu o quórum mínimo (${approvalRate.toFixed(1)}% de ${minQuorum}% necessário).`,
        });

      console.log(`[Cron] Ideia ${idea.code}: ${newStatus} (${approvalRate.toFixed(1)}%)`);

      // Se aprovada, verificar se deve publicar no feed
      if (newStatus === 'aprovada') {
        const { data: feedConfig } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ideas_auto_publish_to_feed')
          .single();

        if (feedConfig?.value?.enabled) {
          const mediaUrl = Array.isArray(idea.media_urls) && idea.media_urls.length > 0 
            ? idea.media_urls[0] 
            : null;

          await supabase.from('feed_posts').insert({
            type: 'idea',
            title: `💡 Ideia Aprovada pela Comunidade`,
            description: `"${idea.title}" foi aprovada com ${approvalRate.toFixed(1)}% dos votos!\n\n${idea.description}`,
            reference_id: idea.id,
            created_by: idea.submitted_by,
            media_url: mediaUrl,
            audience_roles: [],
            audience_units: [],
          });

          console.log(`[Cron] Post criado no feed para ideia ${idea.code}`);
        }

        // Enviar notificação WhatsApp se configurado
        const { data: whatsappConfig } = await supabase
          .from('settings')
          .select('value')
          .eq('key', 'ideas_whatsapp_notifications')
          .single();

        if (whatsappConfig?.value?.enabled) {
          // Buscar perfil do autor para obter telefone
          const { data: profile } = await supabase
            .from('profiles')
            .select('phone, full_name, receive_whatsapp_notifications')
            .eq('id', idea.submitted_by)
            .single();

          if (profile?.phone && profile?.receive_whatsapp_notifications) {
            await supabase.functions.invoke('send-notification', {
              body: {
                type: 'whatsapp',
                phone: profile.phone,
                message: `🎉 *Parabéns, ${profile.full_name}!*\n\nSua ideia *"${idea.title}"* foi aprovada pela comunidade com *${approvalRate.toFixed(1)}% de aprovação*!\n\nEm breve você receberá atualizações sobre a implementação.\n\n_Cresci e Perdi - Rede de Inovação_`,
              }
            });
            console.log(`[Cron] Notificação WhatsApp enviada para ${profile.full_name}`);
          }
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        processed: expiredIdeas.length,
        details: expiredIdeas.map(i => ({ code: i.code, status: i.status }))
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: any) {
    console.error('[Cron Error]', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
