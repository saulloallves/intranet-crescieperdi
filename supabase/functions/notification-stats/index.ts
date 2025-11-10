import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface StatsRequest {
  period?: 'daily' | 'weekly' | 'monthly';
  start_date?: string;
  end_date?: string;
  type?: string;
  module?: string;
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

    const authHeader = req.headers.get('Authorization');
    if (authHeader) {
      const token = authHeader.replace('Bearer ', '');
      const { data: { user } } = await supabaseClient.auth.getUser(token);

      if (user) {
        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();

        if (!profile || profile.role !== 'admin') {
          throw new Error('Apenas administradores podem acessar estatísticas');
        }
      }
    }

    const request: StatsRequest = req.method === 'POST' ? await req.json() : {};
    const period = request.period || 'weekly';
    
    // Calcular datas baseado no período
    const endDate = new Date(request.end_date || new Date());
    const startDate = new Date(request.start_date || endDate);
    
    if (!request.start_date) {
      switch (period) {
        case 'daily':
          startDate.setDate(startDate.getDate() - 1);
          break;
        case 'weekly':
          startDate.setDate(startDate.getDate() - 7);
          break;
        case 'monthly':
          startDate.setMonth(startDate.getMonth() - 1);
          break;
      }
    }

    console.log(`Calculating stats from ${startDate.toISOString()} to ${endDate.toISOString()}`);

    // Query base
    let query = supabaseClient
      .from('notifications')
      .select('*')
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString());

    if (request.type) {
      query = query.eq('type', request.type);
    }
    if (request.module) {
      query = query.eq('module', request.module);
    }

    const { data: notifications, error } = await query;

    if (error) {
      throw error;
    }

    // Calcular estatísticas
    const totalSent = notifications?.length || 0;
    const totalRead = notifications?.filter(n => n.is_read).length || 0;
    const readRate = totalSent > 0 ? (totalRead / totalSent) * 100 : 0;

    // Calcular tempo médio de leitura
    const readNotifications = notifications?.filter(n => n.read_at && n.sent_at) || [];
    const totalDelay = readNotifications.reduce((sum, n) => {
      const sent = new Date(n.sent_at).getTime();
      const read = new Date(n.read_at).getTime();
      return sum + (read - sent);
    }, 0);
    const averageDelay = readNotifications.length > 0 
      ? Math.round(totalDelay / readNotifications.length / 60000) // minutos
      : 0;

    // Estatísticas por tipo
    const statsByType = notifications?.reduce((acc, n) => {
      if (!acc[n.type]) {
        acc[n.type] = { total: 0, read: 0 };
      }
      acc[n.type].total++;
      if (n.is_read) {
        acc[n.type].read++;
      }
      return acc;
    }, {} as Record<string, { total: number; read: number }>);

    // Estatísticas por canal
    const statsByChannel = notifications?.reduce((acc, n) => {
      const channel = n.channel || 'push';
      if (!acc[channel]) {
        acc[channel] = { 
          total: 0, 
          sent: 0, 
          delivered: 0, 
          failed: 0 
        };
      }
      acc[channel].total++;
      if (n.status === 'sent') acc[channel].sent++;
      if (n.status === 'delivered') acc[channel].delivered++;
      if (n.status === 'failed') acc[channel].failed++;
      return acc;
    }, {} as Record<string, { total: number; sent: number; delivered: number; failed: number }>);

    // Salvar estatísticas agregadas
    const statsRecord = {
      type: request.type || 'all',
      module: request.module || null,
      total_sent: totalSent,
      total_read: totalRead,
      read_rate: readRate.toFixed(2),
      average_delay: averageDelay,
      period_start: startDate.toISOString(),
      period_end: endDate.toISOString(),
    };

    const { error: insertError } = await supabaseClient
      .from('notification_stats')
      .insert(statsRecord);

    if (insertError) {
      console.error('Error saving stats:', insertError);
    }

    return new Response(
      JSON.stringify({
        success: true,
        period: {
          type: period,
          start: startDate.toISOString(),
          end: endDate.toISOString(),
        },
        summary: {
          total_sent: totalSent,
          total_read: totalRead,
          read_rate: `${readRate.toFixed(2)}%`,
          average_delay_minutes: averageDelay,
        },
        by_type: statsByType,
        by_channel: statsByChannel,
        recent_notifications: notifications?.slice(0, 10) || [],
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );

  } catch (error) {
    console.error('Error in notification-stats:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});
