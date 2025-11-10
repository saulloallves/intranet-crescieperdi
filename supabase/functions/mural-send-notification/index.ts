import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.76.1";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_id: string;
  title: string;
  message: string;
  type: string;
  reference_id?: string;
  send_whatsapp?: boolean;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { user_id, title, message, type, reference_id, send_whatsapp }: NotificationRequest = await req.json();
    
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log(`📬 Enviando notificação para usuário ${user_id}`);

    // Criar notificação no banco
    const { error: notifError } = await supabase
      .from('notifications')
      .insert({
        user_id,
        title,
        message,
        type,
        reference_id,
        is_read: false
      });

    if (notifError) {
      throw notifError;
    }

    console.log('✅ Notificação criada no banco');

    // Enviar WhatsApp se solicitado
    if (send_whatsapp) {
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('phone, receive_whatsapp_notifications')
          .eq('id', user_id)
          .single();

        if (profile?.receive_whatsapp_notifications && profile?.phone) {
          const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
          const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
          
          if (ZAPI_TOKEN && ZAPI_INSTANCE_ID) {
            const phone = profile.phone.replace(/\D/g, '');
            
            const whatsappMessage = `*${title}*\n\n${message}\n\n_Crescendo Conectado_`;
            
            const response = await fetch(
              `https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: phone,
                  message: whatsappMessage
                })
              }
            );

            if (response.ok) {
              console.log('✅ Mensagem WhatsApp enviada');
            } else {
              console.error('❌ Erro ao enviar WhatsApp:', await response.text());
            }
          }
        }
      } catch (whatsappError) {
        console.error('Erro ao enviar WhatsApp:', whatsappError);
        // Não falhar a função se WhatsApp falhar
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Notificação enviada com sucesso'
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error in mural-send-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
