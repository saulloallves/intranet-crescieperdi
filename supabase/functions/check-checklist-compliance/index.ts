import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    const zapiInstanceId = Deno.env.get('ZAPI_INSTANCE_ID');
    const zapiToken = Deno.env.get('ZAPI_TOKEN');

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current time
    const now = new Date();
    const currentTime = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
    const todayStart = new Date(now.setHours(0, 0, 0, 0)).toISOString();
    const todayEnd = new Date(now.setHours(23, 59, 59, 999)).toISOString();

    // Get automation settings
    const { data: settings } = await supabase
      .from('automation_settings')
      .select('*');

    const settingsMap = settings?.reduce((acc, s) => {
      acc[s.key] = s.value;
      return acc;
    }, {} as Record<string, any>) || {};

    const pushEnabled = settingsMap.push_enabled ?? true;
    const zapiEnabled = settingsMap.enable_zapi_alerts ?? false;

    // Get active checklists with time configurations
    const { data: checklists } = await supabase
      .from('checklists')
      .select('*')
      .eq('is_active', true)
      .not('deadline_time', 'is', null);

    if (!checklists || checklists.length === 0) {
      return new Response(
        JSON.stringify({ message: 'No active checklists with deadlines' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const alertsSent = [];

    for (const checklist of checklists) {
      // Skip if no deadline or not past deadline
      if (!checklist.deadline_time) continue;
      if (currentTime < checklist.deadline_time) continue;

      // Get responses for today
      const { data: responses } = await supabase
        .from('checklist_responses')
        .select('unit_code, submitted_at')
        .eq('checklist_id', checklist.id)
        .gte('submitted_at', todayStart)
        .lte('submitted_at', todayEnd);

      const submittedUnits = responses?.map(r => r.unit_code) || [];
      const applicableUnits = checklist.applicable_units || [];
      const missingUnits = applicableUnits.filter((u: string) => !submittedUnits.includes(u));

      if (missingUnits.length === 0) continue;

      // Check if alert already sent today
      const { data: existingAlerts } = await supabase
        .from('checklist_alerts')
        .select('unit_code')
        .eq('checklist_id', checklist.id)
        .gte('sent_at', todayStart)
        .in('unit_code', missingUnits);

      const alreadyAlerted = existingAlerts?.map(a => a.unit_code) || [];
      const unitsToAlert = missingUnits.filter((u: string) => !alreadyAlerted.includes(u));

      if (unitsToAlert.length === 0) continue;

      // Get unit and user information
      const { data: units } = await supabase
        .from('units')
        .select('code, name')
        .in('code', unitsToAlert);

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, phone, unit_code')
        .in('unit_code', unitsToAlert)
        .eq('is_active', true);

      for (const unit of units || []) {
        const unitProfiles = profiles?.filter(p => p.unit_code === unit.code) || [];
        const sentVia: string[] = [];

        // Send push notification
        if (pushEnabled) {
          for (const profile of unitProfiles) {
            await supabase.from('notifications').insert({
              user_id: profile.id,
              title: 'Checklist Pendente',
              message: `O checklist "${checklist.title}" ainda não foi enviado pela unidade ${unit.name}. Prazo: ${checklist.deadline_time}h`,
              type: 'alert',
            });
          }
          sentVia.push('push');
        }

        // Send WhatsApp via Z-API
        if (zapiEnabled && zapiInstanceId && zapiToken) {
          for (const profile of unitProfiles) {
            if (!profile.phone) continue;

            const message = `🚨 *Atenção!*\n\nO checklist de *${checklist.title}* ainda não foi enviado pela unidade *${unit.name}*.\n\nPor favor, realize o preenchimento até as ${checklist.deadline_time}h para evitar alertas automáticos.\n\n📍 Código da unidade: ${unit.code}\n📅 Data: ${new Date().toLocaleDateString('pt-BR')}`;

            try {
              await fetch(`https://api.z-api.io/instances/${zapiInstanceId}/token/${zapiToken}/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: profile.phone.replace(/\D/g, ''),
                  message,
                }),
              });
              sentVia.push('whatsapp');
            } catch (error) {
              console.error('Error sending WhatsApp:', error);
            }
          }
        }

        // Log alert
        if (sentVia.length > 0) {
          await supabase.from('checklist_alerts').insert({
            checklist_id: checklist.id,
            unit_code: unit.code,
            sent_via: sentVia,
          });

          alertsSent.push({
            checklist: checklist.title,
            unit: unit.name,
            sentVia,
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: 'Compliance check completed',
        alertsSent: alertsSent.length,
        details: alertsSent,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in check-checklist-compliance:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
