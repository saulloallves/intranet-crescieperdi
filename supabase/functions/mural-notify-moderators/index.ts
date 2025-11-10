import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotifyModeratorsRequest {
  content_type: 'post' | 'response';
  content_id: string;
  reason: string;
  category_id?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { content_type, content_id, reason, category_id }: NotifyModeratorsRequest = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📢 Notificando moderadores: ${content_type} ${content_id}`);

    // Buscar configuração de curadores (moderadores específicos por categoria)
    let targetModerators: string[] = [];

    if (category_id) {
      const { data: categoryData } = await supabase
        .from('mural_categories')
        .select('curator_id')
        .eq('id', category_id)
        .single();

      if (categoryData?.curator_id) {
        targetModerators.push(categoryData.curator_id);
      }
    }

    // Buscar configuração de roles de curadores globais
    const { data: settingsData } = await supabase
      .from('automation_settings')
      .select('value')
      .eq('key', 'mural_curator_roles')
      .single();

    const curatorRoles = settingsData?.value || ['admin', 'gestor_setor'];

    // Buscar todos os usuários com roles de curador
    const { data: moderators } = await supabase
      .from('profiles')
      .select('id, full_name, phone, receive_whatsapp_notifications')
      .in('role', curatorRoles)
      .eq('is_active', true);

    if (moderators) {
      targetModerators = [...new Set([...targetModerators, ...moderators.map(m => m.id)])];
    }

    console.log(`📋 ${targetModerators.length} moderadores encontrados`);

    // Criar notificações para cada moderador
    const contentLabel = content_type === 'post' ? 'post' : 'resposta';
    const title = `🔍 Nova ${contentLabel} para revisar`;
    const message = `Uma ${contentLabel} no Mural Cresci e Perdi precisa de moderação manual: ${reason}`;

    for (const moderatorId of targetModerators) {
      // Criar notificação no banco
      await supabase.from('notifications').insert({
        user_id: moderatorId,
        title,
        message,
        type: 'mural_moderation',
        reference_id: content_id,
        is_read: false
      });

      // Tentar enviar WhatsApp se habilitado
      const moderator = moderators?.find(m => m.id === moderatorId);
      if (moderator?.receive_whatsapp_notifications && moderator?.phone) {
        try {
          await supabase.functions.invoke('mural-send-notification', {
            body: {
              user_id: moderatorId,
              title,
              message,
              type: 'mural_moderation',
              reference_id: content_id,
              send_whatsapp: true
            }
          });
        } catch (whatsappError) {
          console.error('Erro ao enviar WhatsApp:', whatsappError);
          // Não falhar se WhatsApp falhar
        }
      }
    }

    console.log(`✅ ${targetModerators.length} moderadores notificados`);

    return new Response(
      JSON.stringify({ 
        success: true,
        moderators_notified: targetModerators.length
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in mural-notify-moderators:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
