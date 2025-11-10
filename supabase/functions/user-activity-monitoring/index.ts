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
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    );

    const { data: { user } } = await supabaseClient.auth.getUser();
    if (!user) {
      throw new Error('Unauthorized');
    }

    const { action, ...data } = await req.json();
    console.log('Activity monitoring action:', action, data);

    switch (action) {
      case 'log_activity': {
        // Registrar atividade do usuário
        const { action_type, module, metadata, result = 'success' } = data;
        
        // Obter informações da requisição
        const ip_address = req.headers.get('x-forwarded-for') || 
                          req.headers.get('cf-connecting-ip') || 
                          'unknown';
        const device = req.headers.get('user-agent') || 'unknown';

        const { error } = await supabaseClient
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action: action_type,
            module,
            ip_address,
            device,
            result,
            metadata: metadata || {},
          });

        if (error) throw error;

        console.log('Activity logged:', action_type, module);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_user_logs': {
        // Obter logs de um usuário específico
        const { user_id, start_date, end_date, limit = 100 } = data;

        // Verificar permissão (admin ou próprio usuário)
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        const isAdmin = userRoles?.role === 'admin';
        const targetUserId = user_id || user.id;

        if (!isAdmin && targetUserId !== user.id) {
          throw new Error('Forbidden: Cannot view other users logs');
        }

        let query = supabaseClient
          .from('activity_logs')
          .select('*')
          .eq('user_id', targetUserId)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (start_date) {
          query = query.gte('timestamp', start_date);
        }
        if (end_date) {
          query = query.lte('timestamp', end_date);
        }

        const { data: logs, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_module_activity': {
        // Obter atividade de um módulo específico
        const { module, start_date, end_date, limit = 100 } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        let query = supabaseClient
          .from('activity_logs')
          .select('*')
          .eq('module', module)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (start_date) {
          query = query.gte('timestamp', start_date);
        }
        if (end_date) {
          query = query.lte('timestamp', end_date);
        }

        const { data: logs, error } = await query;
        if (error) throw error;

        return new Response(JSON.stringify({ logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'generate_report': {
        // Gerar relatório de atividades
        const { start_date, end_date, user_id, module } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        let query = supabaseClient
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (start_date) query = query.gte('timestamp', start_date);
        if (end_date) query = query.lte('timestamp', end_date);
        if (user_id) query = query.eq('user_id', user_id);
        if (module) query = query.eq('module', module);

        const { data: logs, error } = await query;
        if (error) throw error;

        // Calcular estatísticas
        const stats = {
          total_activities: logs?.length || 0,
          success_count: logs?.filter(l => l.result === 'success').length || 0,
          error_count: logs?.filter(l => l.result === 'error').length || 0,
          unique_users: new Set(logs?.map(l => l.user_id)).size,
          modules: {} as Record<string, number>,
          actions: {} as Record<string, number>,
          users_activity: {} as Record<string, number>,
        };

        logs?.forEach(log => {
          // Contar por módulo
          stats.modules[log.module] = (stats.modules[log.module] || 0) + 1;
          // Contar por ação
          stats.actions[log.action] = (stats.actions[log.action] || 0) + 1;
          // Contar por usuário
          stats.users_activity[log.user_id] = (stats.users_activity[log.user_id] || 0) + 1;
        });

        return new Response(JSON.stringify({
          stats,
          logs: logs?.slice(0, 1000), // Limitar a 1000 logs no resultado
          period: { start_date, end_date },
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'detect_suspicious': {
        // Detectar atividades suspeitas
        const { hours = 24, threshold = 100 } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        const since = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

        const { data: logs, error } = await supabaseClient
          .from('activity_logs')
          .select('*')
          .gte('timestamp', since)
          .order('timestamp', { ascending: false });

        if (error) throw error;

        // Detectar atividades suspeitas
        const suspicious: Array<{ type: string; user_id: string; count?: number; ip_count?: number; severity: string }> = [];
        
        // 1. Muitas tentativas falhadas
        const failedByUser: Record<string, number> = {};
        logs?.forEach(log => {
          if (log.result === 'error') {
            failedByUser[log.user_id] = (failedByUser[log.user_id] || 0) + 1;
          }
        });

        Object.entries(failedByUser).forEach(([userId, count]) => {
          if (count >= 10) {
            suspicious.push({
              type: 'excessive_failures',
              user_id: userId,
              count,
              severity: 'high',
            });
          }
        });

        // 2. Excesso de requisições
        const requestsByUser: Record<string, number> = {};
        logs?.forEach(log => {
          requestsByUser[log.user_id] = (requestsByUser[log.user_id] || 0) + 1;
        });

        Object.entries(requestsByUser).forEach(([userId, count]) => {
          if (count >= threshold) {
            suspicious.push({
              type: 'excessive_requests',
              user_id: userId,
              count,
              severity: 'medium',
            });
          }
        });

        // 3. Múltiplos IPs para mesmo usuário
        const ipsByUser: Record<string, Set<string>> = {};
        logs?.forEach(log => {
          if (!ipsByUser[log.user_id]) {
            ipsByUser[log.user_id] = new Set();
          }
          ipsByUser[log.user_id].add(log.ip_address);
        });

        Object.entries(ipsByUser).forEach(([userId, ips]) => {
          if (ips.size >= 5) {
            suspicious.push({
              type: 'multiple_ips',
              user_id: userId,
              ip_count: ips.size,
              severity: 'high',
            });
          }
        });

        console.log('Suspicious activities detected:', suspicious.length);
        return new Response(JSON.stringify({
          suspicious,
          period_hours: hours,
          total_logs: logs?.length || 0,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'export_logs': {
        // Exportar logs para CSV
        const { start_date, end_date, user_id, module } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        let query = supabaseClient
          .from('activity_logs')
          .select('*')
          .order('timestamp', { ascending: false });

        if (start_date) query = query.gte('timestamp', start_date);
        if (end_date) query = query.lte('timestamp', end_date);
        if (user_id) query = query.eq('user_id', user_id);
        if (module) query = query.eq('module', module);

        const { data: logs, error } = await query;
        if (error) throw error;

        // Converter para CSV
        const headers = ['timestamp', 'user_id', 'action', 'module', 'result', 'ip_address', 'device'];
        const csv = [
          headers.join(','),
          ...logs!.map(log => 
            headers.map(h => JSON.stringify(log[h] || '')).join(',')
          )
        ].join('\n');

        return new Response(csv, {
          headers: {
            ...corsHeaders,
            'Content-Type': 'text/csv',
            'Content-Disposition': `attachment; filename="activity_logs_${new Date().toISOString()}.csv"`,
          },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Activity monitoring error:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: errorMessage === 'Unauthorized' ? 401 : 
                errorMessage.includes('Forbidden') ? 403 : 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
