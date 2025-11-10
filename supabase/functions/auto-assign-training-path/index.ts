import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.7.1';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface OnboardingRequest {
  user_id: string;
  role: string;
  full_name?: string;
  phone?: string;
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

    const body: OnboardingRequest = await req.json();
    console.log('Auto-assign training path request:', body);

    const { user_id, role, full_name, phone } = body;

    if (!user_id || !role) {
      throw new Error('user_id and role are required');
    }

    // Get onboarding settings
    const { data: settings } = await supabaseClient
      .from('settings')
      .select('key, value')
      .in('key', ['onboarding_auto_assign', 'default_training_by_role']);

    const settingsMap: Record<string, any> = {};
    settings?.forEach((s: any) => {
      try {
        settingsMap[s.key] = typeof s.value === 'string' ? JSON.parse(s.value) : s.value;
      } catch {
        settingsMap[s.key] = s.value;
      }
    });

    const autoAssignEnabled = settingsMap.onboarding_auto_assign === true;
    const roleTrainingMap = settingsMap.default_training_by_role || {};

    console.log('Auto-assign enabled:', autoAssignEnabled);
    console.log('Role training map:', roleTrainingMap);

    if (!autoAssignEnabled) {
      console.log('Auto-assign is disabled');
      return new Response(
        JSON.stringify({ success: false, message: 'Auto-assign disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Get training path for this role
    const trainingPathId = roleTrainingMap[role];
    
    if (!trainingPathId) {
      console.log(`No training path configured for role: ${role}`);
      return new Response(
        JSON.stringify({ success: false, message: `No training path for role: ${role}` }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if training path exists
    const { data: trainingPath } = await supabaseClient
      .from('training_paths')
      .select('id, name')
      .eq('id', trainingPathId)
      .single();

    if (!trainingPath) {
      console.error(`Training path not found: ${trainingPathId}`);
      return new Response(
        JSON.stringify({ success: false, message: 'Training path not found' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Check if user already has this training path assigned
    const { data: existingAssignment } = await supabaseClient
      .from('user_training_paths')
      .select('id')
      .eq('user_id', user_id)
      .eq('path_id', trainingPathId)
      .single();

    if (existingAssignment) {
      console.log('User already has this training path assigned');
      return new Response(
        JSON.stringify({ success: false, message: 'Training already assigned' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      );
    }

    // Assign training path to user
    const { error: assignError } = await supabaseClient
      .from('user_training_paths')
      .insert({
        user_id,
        path_id: trainingPathId,
        started_at: new Date().toISOString(),
        progress_percentage: 0,
      });

    if (assignError) {
      console.error('Error assigning training path:', assignError);
      throw assignError;
    }

    console.log(`Training path ${trainingPath.name} assigned to user ${user_id}`);

    // Send in-app notification
    const { error: notifError } = await supabaseClient
      .from('notifications')
      .insert({
        user_id,
        title: '🎓 Bem-vinda à Cresci e Perdi!',
        message: 'Sua jornada de treinamento está disponível. Acesse agora e comece sua formação 🌟',
        type: 'training',
        reference_id: trainingPathId,
        is_read: false,
      });

    if (notifError) {
      console.error('Error creating notification:', notifError);
    }

    // Send WhatsApp notification if phone available
    const { data: profile } = await supabaseClient
      .from('profiles')
      .select('phone, receive_whatsapp_notifications')
      .eq('id', user_id)
      .single();

    if (profile?.phone && profile?.receive_whatsapp_notifications) {
      const zapiToken = Deno.env.get('ZAPI_TOKEN');
      const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
      const zapiClientToken = Deno.env.get('ZAPI_CLIENT_TOKEN');

      if (zapiToken && zapiInstanceId && zapiClientToken) {
        try {
          const whatsappMessage = `*🎓 Bem-vinda à Cresci e Perdi!*\n\nSua jornada de treinamento está disponível. Acesse agora e comece sua formação 🌟\n\n📚 Trilha: ${trainingPath.name}`;
          
          await fetch(
            `https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`,
            {
              method: 'POST',
              headers: { 
                'Content-Type': 'application/json',
                'Client-Token': zapiClientToken,
              },
              body: JSON.stringify({
                phone: `55${profile.phone}`,
                message: whatsappMessage,
              }),
            }
          );
          
          console.log('WhatsApp notification sent');
        } catch (error) {
          console.error('Error sending WhatsApp:', error);
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Training path assigned successfully',
        trainingPath: trainingPath.name,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      }
    );
  } catch (error: any) {
    console.error('Error in auto-assign-training-path:', error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      }
    );
  }
});
