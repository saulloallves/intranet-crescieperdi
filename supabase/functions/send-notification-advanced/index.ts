import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  user_ids?: string[];
  roles?: string[];
  units?: string[];
  template_id?: string;
  title?: string;
  message?: string;
  type: string;
  channel: 'push' | 'whatsapp' | 'email';
  module?: string;
  reference_id?: string;
  variables?: Record<string, string>;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    // Verificar se é admin ou gestor
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'gestor_setor'].includes(profile.role)) {
      throw new Error('Permission denied');
    }

    const request: NotificationRequest = await req.json();
    console.log('Processing notification request:', request);

    // Buscar usuários alvo
    let targetUsers: any[] = [];
    
    if (request.user_ids && request.user_ids.length > 0) {
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, full_name, email, phone, unit_code')
        .in('id', request.user_ids);
      targetUsers = data || [];
    } else {
      let query = supabaseClient
        .from('profiles')
        .select('id, full_name, email, phone, unit_code');

      if (request.roles && request.roles.length > 0) {
        query = query.in('role', request.roles);
      }
      if (request.units && request.units.length > 0) {
        query = query.in('unit_code', request.units);
      }

      const { data } = await query;
      targetUsers = data || [];
    }

    console.log(`Found ${targetUsers.length} target users`);

    // Processar template se fornecido
    let finalTitle = request.title || '';
    let finalMessage = request.message || '';

    if (request.template_id) {
      const { data: template } = await supabaseClient
        .from('notification_templates')
        .select('*')
        .eq('id', request.template_id)
        .single();

      if (template) {
        finalTitle = template.title;
        finalMessage = template.message_template;

        // Processar variáveis
        if (request.variables) {
          for (const [key, value] of Object.entries(request.variables)) {
            finalTitle = finalTitle.replace(new RegExp(`{{${key}}}`, 'g'), value);
            finalMessage = finalMessage.replace(new RegExp(`{{${key}}}`, 'g'), value);
          }
        }
      }
    }

    // Buscar configurações
    const { data: settings } = await supabaseClient
      .from('notification_settings')
      .select('*');

    const settingsMap = new Map(settings?.map(s => [s.key, s.value]) || []);
    const maxBatch = Number(settingsMap.get('max_batch_send')) || 50;

    // Criar notificações no banco
    const notifications = targetUsers.map(user => {
      // Personalizar mensagem com dados do usuário
      let personalizedTitle = finalTitle.replace('{{nome}}', user.full_name || '');
      let personalizedMessage = finalMessage.replace('{{nome}}', user.full_name || '');
      personalizedMessage = personalizedMessage.replace('{{unidade}}', user.unit_code || '');

      return {
        user_id: user.id,
        title: personalizedTitle,
        message: personalizedMessage,
        type: request.type,
        channel: request.channel,
        module: request.module,
        reference_id: request.reference_id,
        unit_code: user.unit_code,
        status: 'pending',
      };
    });

    const { data: createdNotifications, error: insertError } = await supabaseClient
      .from('notifications')
      .insert(notifications)
      .select();

    if (insertError) {
      console.error('Error creating notifications:', insertError);
      throw insertError;
    }

    console.log(`Created ${createdNotifications?.length} notifications`);

    // Enviar via WhatsApp se solicitado
    const whatsappResults: any[] = [];
    if (request.channel === 'whatsapp') {
      const zapiToken = Deno.env.get('ZAPI_TOKEN');
      const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

      if (zapiToken && zapiInstanceId && zapiClientToken) {
        const zapiUrl = `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}`;
        
        // Enviar em lotes
        for (let i = 0; i < targetUsers.length; i += maxBatch) {
          const batch = targetUsers.slice(i, i + maxBatch);
          
          for (const user of batch) {
            if (!user.phone) continue;

            const notification = createdNotifications?.find(n => n.user_id === user.id);
            if (!notification) continue;

            try {
              const phone = user.phone.replace(/\D/g, '');
              const whatsappMessage = `*${notification.title}*\n\n${notification.message}`;

              const response = await fetch(`${zapiUrl}/send-text`, {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Client-Token': zapiClientToken,
                },
                body: JSON.stringify({
                  phone: phone,
                  message: whatsappMessage,
                }),
              });

              const result = await response.json();
              
              // Atualizar status da notificação
              await supabaseClient
                .from('notifications')
                .update({
                  status: response.ok ? 'sent' : 'failed',
                  sent_at: new Date().toISOString(),
                  delivery_report: result,
                })
                .eq('id', notification.id);

              whatsappResults.push({
                user_id: user.id,
                success: response.ok,
                result,
              });

              console.log(`WhatsApp sent to ${user.full_name}: ${response.ok}`);
            } catch (error) {
              console.error(`Failed to send WhatsApp to ${user.full_name}:`, error);
              const errorMessage = error instanceof Error ? error.message : 'Unknown error';
              
              await supabaseClient
                .from('notifications')
                .update({
                  status: 'failed',
                  delivery_report: { error: errorMessage },
                })
                .eq('id', notification.id);

              whatsappResults.push({
                user_id: user.id,
                success: false,
                error: errorMessage,
              });
            }

            // Delay entre envios
            await new Promise(resolve => setTimeout(resolve, 1000));
          }
        }
      } else {
        console.warn('Z-API credentials not configured');
      }
    } else {
      // Para push e email, marcar como enviado imediatamente
      await supabaseClient
        .from('notifications')
        .update({
          status: 'sent',
          sent_at: new Date().toISOString(),
        })
        .in('id', createdNotifications?.map(n => n.id) || []);
    }

    return new Response(
      JSON.stringify({
        success: true,
        total_users: targetUsers.length,
        notifications_created: createdNotifications?.length || 0,
        whatsapp_sent: whatsappResults.length,
        whatsapp_success: whatsappResults.filter(r => r.success).length,
        whatsapp_results: whatsappResults,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in send-notification-advanced:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
