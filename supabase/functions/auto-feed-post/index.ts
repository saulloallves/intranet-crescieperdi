import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface FeedPostPayload {
  type: 'training' | 'checklist' | 'campaign' | 'recognition' | 'idea' | 'manual' | 'announcement' | 'media';
  title: string;
  description: string;
  module_link?: string;
  media_url?: string;
  created_by?: string;
  entity_id?: string;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const payload: FeedPostPayload = await req.json();
    console.log('📮 Creating auto feed post:', payload);

    // Enriquecimento opcional com IA (se OPENAI_API_KEY estiver configurada)
    let enrichedTitle = payload.title;
    let enrichedDescription = payload.description;

    if (Deno.env.get('OPENAI_API_KEY')) {
      try {
        console.log('🎨 Attempting to enrich post with AI...');
        const enrichResponse = await fetch(`${supabaseUrl}/functions/v1/ai-enrich-feed-post`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            type: payload.type,
            title: payload.title,
            description: payload.description,
          }),
        });

        if (enrichResponse.ok) {
          const enrichedData = await enrichResponse.json();
          if (enrichedData.enriched) {
            enrichedTitle = enrichedData.title;
            enrichedDescription = enrichedData.description;
            console.log('✅ Post enriched with AI');
          }
        } else {
          console.warn('AI enrichment failed, using original content');
        }
      } catch (enrichError) {
        console.warn('AI enrichment error, using original content:', enrichError);
      }
    }

    // Validate required fields
    if (!payload.type || !payload.title || !payload.description) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: type, title, description' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create feed post
    const { data: post, error: postError } = await supabase
      .from('feed_posts')
      .insert({
        type: payload.type,
        title: enrichedTitle,
        description: enrichedDescription,
        module_link: payload.module_link,
        media_url: payload.media_url,
        created_by: payload.created_by,
        pinned: false
      })
      .select()
      .single();

    if (postError) {
      console.error('Error creating feed post:', postError);
      throw postError;
    }

    console.log('✅ Feed post created successfully:', post.id);

    // Define critical content types for WhatsApp notifications
    const criticalTypes = ['manual', 'campaign', 'announcement'];

    // Send notification to all users about new post
    const { data: profiles, error: profilesError } = await supabase
      .from('profiles')
      .select('id, phone, full_name')
      .neq('id', payload.created_by || '');

    if (!profilesError && profiles) {
      const notifications = profiles.map(profile => ({
        user_id: profile.id,
        title: `Novo conteúdo: ${enrichedTitle}`,
        message: enrichedDescription.substring(0, 100),
        type: 'info',
        link: `/feed?post=${post.id}`,
        read: false
      }));

      const { error: notifError } = await supabase
        .from('notifications')
        .insert(notifications);

      if (notifError) {
        console.error('Error creating notifications:', notifError);
      } else {
        console.log(`📬 Sent ${notifications.length} notifications`);
      }

      // Send WhatsApp for critical content types
      if (criticalTypes.includes(payload.type)) {
        console.log(`📱 Sending WhatsApp for critical content type: ${payload.type}`);
        
        // Get Z-API settings
        const { data: settings } = await supabase
          .from('settings')
          .select('setting_value')
          .eq('setting_key', 'zapi_config')
          .single();

        const zapiToken = Deno.env.get('ZAPI_TOKEN');

        if (settings?.setting_value && zapiToken) {
          const zapiConfig = settings.setting_value as { 
            instance_id: string; 
            client_token: string;
            queue_delay_ms?: number;
          };

          const queueDelay = zapiConfig.queue_delay_ms || 2000;
          let sentCount = 0;

          for (const profile of profiles) {
            if (profile.phone) {
              try {
                const message = `🔔 *Novo ${payload.type === 'manual' ? 'Manual' : payload.type === 'campaign' ? 'Campanha' : 'Comunicado'}*\n\n*${enrichedTitle}*\n\n${enrichedDescription.substring(0, 200)}...\n\nAcesse: ${post.module_link || 'app/feed'}`;

                const response = await fetch(
                  `https://api.z-api.io/instances/${zapiConfig.instance_id}/token/${zapiConfig.client_token}/send-text`,
                  {
                    method: 'POST',
                    headers: {
                      'Content-Type': 'application/json',
                      'Client-Token': zapiToken,
                    },
                    body: JSON.stringify({
                      phone: profile.phone.replace(/\D/g, ''),
                      message: message,
                    }),
                  }
                );

                if (response.ok) {
                  sentCount++;
                  console.log(`✅ WhatsApp sent to ${profile.phone}`);
                } else {
                  console.error(`❌ Failed to send WhatsApp to ${profile.phone}`);
                }

                // Queue delay between messages
                if (sentCount < profiles.length) {
                  await new Promise(resolve => setTimeout(resolve, queueDelay));
                }
              } catch (error) {
                console.error(`Error sending WhatsApp to ${profile.phone}:`, error);
              }
            }
          }

          console.log(`📱 WhatsApp sent to ${sentCount} users`);
        } else {
          console.warn('Z-API not configured, skipping WhatsApp notifications');
        }
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        post_id: post.id,
        message: 'Feed post created, notifications sent',
        whatsapp_sent: criticalTypes.includes(payload.type)
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in auto-feed-post function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
