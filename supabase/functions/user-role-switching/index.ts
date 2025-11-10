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

    // Verificar se é admin
    const { data: userRoles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .single();

    if (!userRoles || userRoles.role !== 'admin') {
      throw new Error('Forbidden: Admin access required');
    }

    const { action, ...data } = await req.json();
    console.log('Role switching action:', action, data);

    switch (action) {
      case 'change_role': {
        // Mudar role de um usuário
        const { user_id, new_role, reason } = data;

        // Validar role
        const valid_roles = ['admin', 'gestor_setor', 'franqueado', 'colaborador'];
        if (!valid_roles.includes(new_role)) {
          throw new Error(`Invalid role: ${new_role}`);
        }

        // Buscar role atual
        const { data: currentRole } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user_id)
          .single();

        if (!currentRole) {
          throw new Error('User not found');
        }

        const old_role = currentRole.role;

        // Atualizar role na tabela user_roles
        const { error: roleError } = await supabaseAdmin
          .from('user_roles')
          .update({ role: new_role })
          .eq('user_id', user_id);

        if (roleError) throw roleError;

        // Atualizar role na tabela profiles
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ role: new_role })
          .eq('id', user_id);

        if (profileError) throw profileError;

        // Registrar no log de atividades
        await supabaseClient
          .from('activity_logs')
          .insert({
            user_id: user.id,
            action: 'ROLE_CHANGE',
            module: 'users',
            result: 'success',
            metadata: {
              target_user_id: user_id,
              old_role,
              new_role,
              reason: reason || 'No reason provided',
            },
          });

        // Criar notificação para o usuário
        await supabaseClient
          .from('notifications')
          .insert({
            user_id: user_id,
            title: 'Alteração de Perfil',
            message: `Seu perfil foi alterado de ${old_role} para ${new_role}.`,
            type: 'system',
          });

        console.log('Role changed:', user_id, old_role, '->', new_role);
        return new Response(JSON.stringify({
          success: true,
          old_role,
          new_role,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'add_additional_role': {
        // Adicionar role adicional (para usuários com múltiplas funções)
        const { user_id, additional_role } = data;

        // Verificar se já existe
        const { data: existing } = await supabaseClient
          .from('user_roles')
          .select('*')
          .eq('user_id', user_id)
          .eq('role', additional_role)
          .single();

        if (existing) {
          throw new Error('User already has this role');
        }

        // Adicionar nova entrada
        const { error } = await supabaseAdmin
          .from('user_roles')
          .insert({
            user_id,
            role: additional_role,
          });

        if (error) throw error;

        console.log('Additional role added:', user_id, additional_role);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'remove_additional_role': {
        // Remover role adicional
        const { user_id, role_to_remove } = data;

        // Contar quantas roles o usuário tem
        const { data: roles, error: countError } = await supabaseClient
          .from('user_roles')
          .select('role')
          .eq('user_id', user_id);

        if (countError) throw countError;

        if (roles && roles.length <= 1) {
          throw new Error('Cannot remove last role from user');
        }

        // Remover role
        const { error } = await supabaseAdmin
          .from('user_roles')
          .delete()
          .eq('user_id', user_id)
          .eq('role', role_to_remove);

        if (error) throw error;

        console.log('Role removed:', user_id, role_to_remove);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_role_history': {
        // Obter histórico de mudanças de role
        const { user_id, limit = 50 } = data;

        const { data: logs, error } = await supabaseClient
          .from('activity_logs')
          .select('*')
          .eq('action', 'ROLE_CHANGE')
          .eq('metadata->>target_user_id', user_id)
          .order('timestamp', { ascending: false })
          .limit(limit);

        if (error) throw error;

        return new Response(JSON.stringify({ history: logs }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'list_users_by_role': {
        // Listar usuários por role
        const { role } = data;

        const { data: userIds, error: roleError } = await supabaseClient
          .from('user_roles')
          .select('user_id')
          .eq('role', role);

        if (roleError) throw roleError;

        if (!userIds || userIds.length === 0) {
          return new Response(JSON.stringify({ users: [] }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const ids = userIds.map(r => r.user_id);

        const { data: users, error: usersError } = await supabaseClient
          .from('profiles')
          .select('id, full_name, email, role, unit_code, is_active')
          .in('id', ids);

        if (usersError) throw usersError;

        return new Response(JSON.stringify({ users }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'validate_permissions': {
        // Validar permissões de um usuário após mudança de role
        const { user_id } = data;

        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user_id)
          .single();

        if (!profile) {
          throw new Error('User not found');
        }

        const { data: permissions, error } = await supabaseClient
          .from('permissions')
          .select('*')
          .eq('role', profile.role);

        if (error) throw error;

        return new Response(JSON.stringify({
          user_id,
          role: profile.role,
          permissions,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'bulk_role_change': {
        // Mudança em massa de roles
        const { changes, reason } = data; // Array de { user_id, new_role }

        const results = [];

        for (const change of changes) {
          try {
            // Buscar role atual
            const { data: currentRole } = await supabaseClient
              .from('user_roles')
              .select('role')
              .eq('user_id', change.user_id)
              .single();

            const old_role = currentRole?.role;

            // Atualizar role
            await supabaseAdmin
              .from('user_roles')
              .update({ role: change.new_role })
              .eq('user_id', change.user_id);

            await supabaseAdmin
              .from('profiles')
              .update({ role: change.new_role })
              .eq('id', change.user_id);

            // Registrar log
            await supabaseClient
              .from('activity_logs')
              .insert({
                user_id: user.id,
                action: 'BULK_ROLE_CHANGE',
                module: 'users',
                result: 'success',
                metadata: {
                  target_user_id: change.user_id,
                  old_role,
                  new_role: change.new_role,
                  reason: reason || 'Bulk update',
                },
              });

            results.push({
              user_id: change.user_id,
              success: true,
              old_role,
              new_role: change.new_role,
            });
          } catch (error) {
            results.push({
              user_id: change.user_id,
              success: false,
              error: error instanceof Error ? error.message : 'Unknown error',
            });
          }
        }

        console.log('Bulk role change completed:', results.length);
        return new Response(JSON.stringify({ results }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Role switching error:', error);
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
