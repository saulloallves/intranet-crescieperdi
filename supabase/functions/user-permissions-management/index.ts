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
    console.log('Permission management action:', action, data);

    switch (action) {
      case 'list': {
        // Listar todas as permissões
        const { data: permissions, error } = await supabaseClient
          .from('permissions')
          .select('*')
          .order('role', { ascending: true })
          .order('module', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ permissions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_by_role': {
        // Obter permissões de um role específico
        const { role } = data;
        const { data: permissions, error } = await supabaseClient
          .from('permissions')
          .select('*')
          .eq('role', role)
          .order('module', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ permissions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_by_module': {
        // Obter permissões de um módulo específico
        const { module } = data;
        const { data: permissions, error } = await supabaseClient
          .from('permissions')
          .select('*')
          .eq('module', module)
          .order('role', { ascending: true });

        if (error) throw error;

        return new Response(JSON.stringify({ permissions }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'create': {
        // Criar nova permissão
        const { role, module, access_level } = data;
        
        const { data: permission, error } = await supabaseClient
          .from('permissions')
          .insert({ role, module, access_level })
          .select()
          .single();

        if (error) throw error;

        console.log('Permission created:', permission);
        return new Response(JSON.stringify({ permission }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'update': {
        // Atualizar permissão existente
        const { id, access_level } = data;
        
        const { data: permission, error } = await supabaseClient
          .from('permissions')
          .update({ access_level })
          .eq('id', id)
          .select()
          .single();

        if (error) throw error;

        console.log('Permission updated:', permission);
        return new Response(JSON.stringify({ permission }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'delete': {
        // Deletar permissão
        const { id } = data;
        
        const { error } = await supabaseClient
          .from('permissions')
          .delete()
          .eq('id', id);

        if (error) throw error;

        console.log('Permission deleted:', id);
        return new Response(JSON.stringify({ success: true }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'bulk_update': {
        // Atualização em massa de permissões
        const { updates } = data; // Array de { id, access_level }
        
        const promises = updates.map((update: any) =>
          supabaseClient
            .from('permissions')
            .update({ access_level: update.access_level })
            .eq('id', update.id)
        );

        await Promise.all(promises);

        console.log('Bulk update completed:', updates.length, 'permissions');
        return new Response(JSON.stringify({ success: true, count: updates.length }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'get_matrix': {
        // Obter matriz completa de permissões (role x module)
        const { data: permissions, error } = await supabaseClient
          .from('permissions')
          .select('*')
          .order('role', { ascending: true })
          .order('module', { ascending: true });

        if (error) throw error;

        // Organizar em matriz
        const matrix: Record<string, Record<string, string>> = {};
        const roles = new Set<string>();
        const modules = new Set<string>();

        permissions?.forEach((perm) => {
          roles.add(perm.role);
          modules.add(perm.module);
          if (!matrix[perm.role]) {
            matrix[perm.role] = {};
          }
          matrix[perm.role][perm.module] = perm.access_level;
        });

        return new Response(JSON.stringify({
          matrix,
          roles: Array.from(roles),
          modules: Array.from(modules),
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      case 'check_access': {
        // Verificar se um usuário tem acesso a um módulo
        const { user_id, module, required_level } = data;

        const { data: profile } = await supabaseClient
          .from('profiles')
          .select('role')
          .eq('id', user_id)
          .single();

        if (!profile) {
          return new Response(JSON.stringify({ has_access: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        const { data: permission } = await supabaseClient
          .from('permissions')
          .select('access_level')
          .eq('role', profile.role)
          .eq('module', module)
          .single();

        if (!permission) {
          return new Response(JSON.stringify({ has_access: false }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Hierarquia: admin > write > read > none
        const levels: Record<string, number> = {
          none: 0,
          read: 1,
          write: 2,
          admin: 3,
        };

        const has_access = levels[permission.access_level] >= levels[required_level];

        return new Response(JSON.stringify({
          has_access,
          current_level: permission.access_level,
          required_level,
        }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }

      default:
        throw new Error(`Unknown action: ${action}`);
    }
  } catch (error) {
    console.error('Permission management error:', error);
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
