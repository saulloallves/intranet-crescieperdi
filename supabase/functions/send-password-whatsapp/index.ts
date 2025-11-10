import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
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

    const { email, newPassword } = await req.json();
    console.log('Password recovery request for:', email);

    // Get user by email
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('id, full_name, phone, receive_whatsapp_notifications')
      .eq('email', email)
      .eq('is_active', true)
      .single();

    if (!profile) {
      throw new Error('Usuário não encontrado');
    }

    // Check if WhatsApp notifications are enabled
    const { data: settings } = await supabaseClient
      .from('automation_settings')
      .select('value')
      .eq('key', 'password_recovery_whatsapp')
      .single();

    const whatsappEnabled = settings?.value === true || settings?.value === 'true';

    if (!whatsappEnabled || !profile.receive_whatsapp_notifications || !profile.phone) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          message: 'Notificações WhatsApp não configuradas para este usuário'
        }),
        {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          status: 200,
        }
      );
    }

    // Update password
    const { error: updateError } = await supabaseClient.auth.admin.updateUserById(
      profile.id,
      { password: newPassword }
    );

    if (updateError) {
      console.error('Error updating password:', updateError);
      throw updateError;
    }

    // Send WhatsApp message
    const zapiToken = Deno.env.get('ZAPI_TOKEN');
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

    if (zapiToken && zapiInstanceId && zapiClientToken) {
      const message = `Olá ${profile.full_name}!\n\nSua nova senha de acesso ao sistema Cresci e Perdi é:\n\n*${newPassword}*\n\nPor favor, faça login e altere sua senha assim que possível.\n\nAcesse: ${Deno.env.get('SUPABASE_URL')?.replace('.supabase.co', '.lovableproject.com') || 'https://crescieperdi.com.br'}`;

      try {
        const response = await fetch(
          `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Client-Token': zapiClientToken,
            },
            body: JSON.stringify({
              phone: profile.phone,
              message: message,
            }),
          }
        );

        if (response.ok) {
          console.log(`Password sent via WhatsApp to ${profile.phone}`);
        } else {
          console.error(`Failed to send WhatsApp:`, await response.text());
        }
      } catch (error) {
        console.error(`WhatsApp error:`, error);
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Senha atualizada e enviada via WhatsApp',
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-password-whatsapp:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
