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
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

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
    console.log('Security monitoring action:', action, data);

    switch (action) {
      case 'track_login': {
        // Rastrear tentativa de login
        const { user_id, success, ip_address, device } = data;

        // Atualizar perfil com último login se bem-sucedido
        if (success && user_id) {
          await supabaseAdmin
            .from('profiles')
            .update({
              last_login: new Date().toISOString(),
              last_ip: ip_address,
            })
            .eq('id', user_id);
        }

        // Registrar no log
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            user_id: user_id || null,
            action: success ? 'LOGIN_SUCCESS' : 'LOGIN_FAILED',
            module: 'auth',
            result: success ? 'success' : 'error',
            ip_address,
            device,
            metadata: {
              timestamp: new Date().toISOString(),
            },
          });

        // Se falhou, verificar se precisa bloquear
        if (!success && user_id) {
          const since = new Date(Date.now() - 15 * 60 * 1000).toISOString(); // Últimos 15 min
          
          const { data: recentFailures } = await supabaseAdmin
            .from('activity_logs')
            .select('*')
            .eq('user_id', user_id)
            .eq('action', 'LOGIN_FAILED')
            .gte('timestamp', since);

          if (recentFailures && recentFailures.length >= 5) {
            // Bloquear usuário temporariamente
            await supabaseAdmin
              .from('profiles')
              .update({ is_active: false })
              .eq('id', user_id);

            // Criar notificação
            await supabaseAdmin
              .from('notifications')
              .insert({
                user_id,
                title: 'Conta Bloqueada',
                message: 'Sua conta foi temporariamente bloqueada devido a múltiplas tentativas de login falhadas. Entre em contato com o suporte.',
                type: 'security',
              });

            console.log('User blocked due to failed login attempts:', user_id);
          }
        }

        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'detect_suspicious_login': {
        // Detectar login suspeito
        const { user_id, ip_address, device } = data;

        const { data: profile } = await supabaseAdmin
          .from('profiles')
          .select('last_ip, last_login')
          .eq('id', user_id)
          .single();

        if (!profile) {
          return new Response(JSON.stringify({ suspicious: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        let suspicious = false;
        let reasons = [];

        // 1. IP diferente do habitual
        if (profile.last_ip && profile.last_ip !== ip_address) {
          suspicious = true;
          reasons.push('different_ip');
        }

        // 2. Login após muito tempo inativo
        if (profile.last_login) {
          const daysSinceLastLogin = (Date.now() - new Date(profile.last_login).getTime()) / (1000 * 60 * 60 * 24);
          if (daysSinceLastLogin > 90) {
            suspicious = true;
            reasons.push('long_inactivity');
          }
        }

        // 3. Múltiplos logins em IPs diferentes em curto período
        const { data: recentLogins } = await supabaseAdmin
          .from('activity_logs')
          .select('ip_address')
          .eq('user_id', user_id)
          .eq('action', 'LOGIN_SUCCESS')
          .gte('timestamp', new Date(Date.now() - 60 * 60 * 1000).toISOString()); // Última hora

        if (recentLogins) {
          const uniqueIps = new Set(recentLogins.map(l => l.ip_address));
          if (uniqueIps.size >= 3) {
            suspicious = true;
            reasons.push('multiple_ips');
          }
        }

        if (suspicious) {
          // Criar notificação de segurança
          await supabaseAdmin
            .from('notifications')
            .insert({
              user_id,
              title: 'Atividade Suspeita Detectada',
              message: 'Detectamos uma atividade incomum em sua conta. Se não foi você, altere sua senha imediatamente.',
              type: 'security',
            });

          console.log('Suspicious login detected:', user_id, reasons);
        }

        return new Response(JSON.stringify({
          suspicious,
          reasons,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_security_report': {
        // Gerar relatório de segurança
        const { start_date, end_date } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        const startDate = start_date || new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
        const endDate = end_date || new Date().toISOString();

        // Buscar eventos de segurança
        const { data: logs } = await supabaseAdmin
          .from('activity_logs')
          .select('*')
          .in('action', ['LOGIN_SUCCESS', 'LOGIN_FAILED', 'PASSWORD_RESET', 'ACCOUNT_LOCKED'])
          .gte('timestamp', startDate)
          .lte('timestamp', endDate);

        const report = {
          period: { start: startDate, end: endDate },
          total_logins: logs?.filter(l => l.action === 'LOGIN_SUCCESS').length || 0,
          failed_logins: logs?.filter(l => l.action === 'LOGIN_FAILED').length || 0,
          password_resets: logs?.filter(l => l.action === 'PASSWORD_RESET').length || 0,
          accounts_locked: logs?.filter(l => l.action === 'ACCOUNT_LOCKED').length || 0,
          unique_users: new Set(logs?.map(l => l.user_id)).size,
          unique_ips: new Set(logs?.map(l => l.ip_address)).size,
          top_failed_users: [] as any[],
          suspicious_ips: [] as any[],
        };

        // Top usuários com falhas
        const failedByUser: Record<string, number> = {};
        logs?.filter(l => l.action === 'LOGIN_FAILED').forEach(log => {
          failedByUser[log.user_id] = (failedByUser[log.user_id] || 0) + 1;
        });

        report.top_failed_users = Object.entries(failedByUser)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 10)
          .map(([user_id, count]) => ({ user_id, failed_attempts: count }));

        // IPs suspeitos (muitas tentativas falhadas)
        const failedByIp: Record<string, number> = {};
        logs?.filter(l => l.action === 'LOGIN_FAILED').forEach(log => {
          failedByIp[log.ip_address] = (failedByIp[log.ip_address] || 0) + 1;
        });

        report.suspicious_ips = Object.entries(failedByIp)
          .filter(([, count]) => count >= 5)
          .sort(([, a], [, b]) => b - a)
          .slice(0, 20)
          .map(([ip, count]) => ({ ip_address: ip, failed_attempts: count }));

        return new Response(JSON.stringify({ report }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'block_user': {
        // Bloquear usuário manualmente
        const { user_id, reason } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        // Desativar usuário
        await supabaseAdmin
          .from('profiles')
          .update({ is_active: false })
          .eq('id', user_id);

        // Registrar log
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action: 'USER_BLOCKED',
            module: 'security',
            result: 'success',
            metadata: {
              target_user_id: user_id,
              reason: reason || 'Manual block by admin',
            },
          });

        // Criar notificação
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id,
            title: 'Conta Bloqueada',
            message: `Sua conta foi bloqueada. Motivo: ${reason || 'Não especificado'}. Entre em contato com o suporte.`,
            type: 'security',
          });

        console.log('User blocked:', user_id, reason);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'unblock_user': {
        // Desbloquear usuário
        const { user_id } = data;

        // Verificar se é admin
        const { data: userRoles } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user.id)
          .single();

        if (!userRoles || userRoles.role !== 'admin') {
          throw new Error('Forbidden: Admin access required');
        }

        // Reativar usuário
        await supabaseAdmin
          .from('profiles')
          .update({ is_active: true })
          .eq('id', user_id);

        // Registrar log
        await supabaseAdmin
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action: 'USER_UNBLOCKED',
            module: 'security',
            result: 'success',
            metadata: {
              target_user_id: user_id,
            },
          });

        // Criar notificação
        await supabaseAdmin
          .from('notifications')
          .insert({
            user_id,
            title: 'Conta Desbloqueada',
            message: 'Sua conta foi desbloqueada. Você já pode acessar normalmente.',
            type: 'security',
          });

        console.log('User unblocked:', user_id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Security monitoring error:', error);
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
