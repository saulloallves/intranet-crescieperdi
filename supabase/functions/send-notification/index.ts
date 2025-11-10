import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface NotificationRequest {
  title: string;
  message: string;
  type: string;
  userIds?: string[];
  roles?: string[];
  units?: string[];
  sendWhatsApp?: boolean;
  referenceId?: string;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // Verify admin/gestor role
    const authHeader = req.headers.get('Authorization')!;
    const token = authHeader.replace('Bearer ', '');
    const { data: { user } } = await supabaseClient.auth.getUser(token);

    if (!user) {
      throw new Error('Unauthorized');
    }

    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['admin', 'gestor_setor'].includes(profile.role)) {
      throw new Error('Unauthorized: Admin access required');
    }

    const body: NotificationRequest = await req.json();
    console.log('Notification request:', body);

    // Get target users
    let targetUsers: any[] = [];

    if (body.userIds && body.userIds.length > 0) {
      // Specific users
      const { data } = await supabaseClient
        .from('profiles')
        .select('id, full_name, email, phone, receive_whatsapp_notifications')
        .in('id', body.userIds)
        .eq('is_active', true);
      targetUsers = data || [];
    } else {
      // Filter by roles and/or units
      let query = supabaseClient
        .from('profiles')
        .select('id, full_name, email, phone, receive_whatsapp_notifications')
        .eq('is_active', true);

      if (body.roles && body.roles.length > 0) {
        query = query.in('role', body.roles);
      }

      if (body.units && body.units.length > 0) {
        query = query.in('unit_code', body.units);
      }

      const { data } = await query;
      targetUsers = data || [];
    }

    console.log(`Sending notifications to ${targetUsers.length} users`);

    // Create notifications in database
    const notifications = targetUsers.map(user => ({
      user_id: user.id,
      title: body.title,
      message: body.message,
      type: body.type,
      reference_id: body.referenceId || null,
      is_read: false,
    }));

    const { error: dbError } = await supabaseClient
      .from('notifications')
      .insert(notifications);

    if (dbError) {
      console.error('Database error:', dbError);
      throw dbError;
    }

    // Get queue settings
    const { data: settingsData } = await supabaseClient
      .from('automation_settings')
      .select('key, value')
      .in('key', ['whatsapp_queue_delay_min', 'whatsapp_queue_delay_max']);

    const settings: Record<string, number> = {};
    settingsData?.forEach((s: any) => {
      settings[s.key] = typeof s.value === 'number' ? s.value : parseInt(s.value) || 3;
    });

    const delayMin = settings.whatsapp_queue_delay_min || 3;
    const delayMax = settings.whatsapp_queue_delay_max || 5;

    // Send WhatsApp messages if requested with queue and delays
    let whatsappResults = { sent: 0, failed: 0, queued: targetUsers.length };
    if (body.sendWhatsApp) {
      const zapiToken = Deno.env.get('ZAPI_TOKEN');
      const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

      if (zapiToken && zapiInstanceId && zapiClientToken) {
        console.log('Sending WhatsApp messages with queue...');
        
        for (let i = 0; i < targetUsers.length; i++) {
          const user = targetUsers[i];
          // Use phone from profile and check if user wants WhatsApp notifications
          const phone = user.phone;
          const wantsWhatsApp = user.receive_whatsapp_notifications;
          
          if (phone && wantsWhatsApp) {
            try {
              const whatsappMessage = `*${body.title}*\n\n${body.message}`;
              
              const response = await fetch(
                `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
                {
                  method: 'POST',
                  headers: { 
                    'Content-Type': 'application/json',
                    'Client-Token': zapiClientToken,
                  },
                  body: JSON.stringify({
                    phone: `55${phone}`,
                    message: whatsappMessage,
                  }),
                }
              );

              if (response.ok) {
                whatsappResults.sent++;
                console.log(`WhatsApp sent to ${phone} (${i + 1}/${targetUsers.length})`);
              } else {
                whatsappResults.failed++;
                const errorText = await response.text();
                console.error(`WhatsApp failed for ${phone}:`, errorText);
              }
            } catch (error) {
              whatsappResults.failed++;
              console.error(`WhatsApp error for ${phone}:`, error);
            }

            // Add delay between messages (using configured delays)
            if (i < targetUsers.length - 1) {
              const delay = (delayMin * 1000) + Math.random() * ((delayMax - delayMin) * 1000);
              console.log(`Waiting ${Math.round(delay / 1000)}s before next message...`);
              await new Promise(resolve => setTimeout(resolve, delay));
            }
          }
        }
      } else {
        console.warn('Z-API credentials not configured');
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        notificationsSent: targetUsers.length,
        whatsappResults: body.sendWhatsApp ? whatsappResults : null,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in send-notification:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});