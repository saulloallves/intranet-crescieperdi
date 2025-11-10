import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.0";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Authenticate the caller
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized: No authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Verify admin role
    const { data: roles } = await supabaseClient
      .from('user_roles')
      .select('role')
      .eq('user_id', user.id)
      .eq('role', 'admin')
      .single();

    if (!roles) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: Admin access required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Create admin client for privileged operations
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    );

    const { action, userData } = await req.json();
    console.log('Admin action:', action, 'for user:', userData?.email);

    switch (action) {
      case 'create': {
        // Validar CPF (simples validação de formato)
        if (userData.cpf && !/^\d{11}$/.test(userData.cpf.replace(/\D/g, ''))) {
          throw new Error('CPF inválido');
        }

        // Create user in auth.users
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
          email: userData.email,
          password: userData.password,
          email_confirm: true,
          user_metadata: {
            full_name: userData.full_name,
          }
        });

        if (authError) {
          console.error('Error creating auth user:', authError);
          throw authError;
        }

        console.log('User created in auth.users:', authData.user.id);

        // Profile will be created automatically by trigger
        // Wait a bit for the trigger to execute
        await new Promise(resolve => setTimeout(resolve, 1000));

        // Update profile with additional data
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            unit_code: userData.unit_code || null,
            unit_codes: userData.unit_codes || [],
            avatar_url: userData.avatar_url || null,
            role: userData.role || 'colaborador',
            phone: userData.phone || null,
            cpf: userData.cpf || null,
            receive_whatsapp_notifications: userData.receive_whatsapp_notifications || false,
          })
          .eq('id', authData.user.id);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw profileError;
        }

        // Add role to user_roles table
        if (userData.role) {
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: authData.user.id,
              role: userData.role,
            });

          if (roleError) {
            console.error('Error adding role:', roleError);
          }
        }

        // Enviar notificação via WhatsApp se habilitado
        if (userData.phone && userData.receive_whatsapp_notifications) {
          const ZAPI_TOKEN = Deno.env.get('ZAPI_TOKEN');
          const ZAPI_INSTANCE_ID = Deno.env.get('ZAPI_INSTANCE_ID');
          
          if (ZAPI_TOKEN && ZAPI_INSTANCE_ID) {
            try {
              await fetch(`https://api.z-api.io/instances/${ZAPI_INSTANCE_ID}/token/${ZAPI_TOKEN}/send-text`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  phone: userData.phone.replace(/\D/g, ''),
                  message: `Olá ${userData.full_name}! Sua conta foi criada com sucesso.\n\nEmail: ${userData.email}\nSenha: ${userData.password}\n\nAcesse: ${Deno.env.get('SUPABASE_URL')}`
                })
              });
            } catch (e) {
              console.error('Error sending WhatsApp notification:', e);
            }
          }
        }

        return new Response(
          JSON.stringify({ success: true, user: authData.user }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'update': {
        const { userId, updates } = userData;

        // Validar CPF se fornecido
        if (updates.cpf && !/^\d{11}$/.test(updates.cpf.replace(/\D/g, ''))) {
          throw new Error('CPF inválido');
        }

        // Update auth metadata if full_name changed
        if (updates.full_name) {
          const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
              user_metadata: { full_name: updates.full_name }
            }
          );

          if (authError) {
            console.error('Error updating auth metadata:', authError);
            throw authError;
          }
        }

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({
            full_name: updates.full_name,
            unit_code: updates.unit_code,
            unit_codes: updates.unit_codes,
            avatar_url: updates.avatar_url,
            role: updates.role,
            phone: updates.phone,
            cpf: updates.cpf,
            receive_whatsapp_notifications: updates.receive_whatsapp_notifications,
          })
          .eq('id', userId);

        if (profileError) {
          console.error('Error updating profile:', profileError);
          throw profileError;
        }

        // Update role in user_roles if changed
        if (updates.role) {
          // First, delete existing role
          await supabaseAdmin
            .from('user_roles')
            .delete()
            .eq('user_id', userId);

          // Then insert new role
          const { error: roleError } = await supabaseAdmin
            .from('user_roles')
            .insert({
              user_id: userId,
              role: updates.role,
            });

          if (roleError) {
            console.error('Error updating role:', roleError);
          }
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'resetPassword': {
        const { userId, newPassword } = userData;

        const { error } = await supabaseAdmin.auth.admin.updateUserById(
          userId,
          { password: newPassword }
        );

        if (error) {
          console.error('Error resetting password:', error);
          throw error;
        }

        console.log('Password reset for user:', userId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'toggleActive': {
        const { userId, isActive } = userData;

        // Update profile
        const { error: profileError } = await supabaseAdmin
          .from('profiles')
          .update({ is_active: isActive })
          .eq('id', userId);

        if (profileError) {
          console.error('Error toggling active status:', profileError);
          throw profileError;
        }

        // If deactivating, also sign out the user
        if (!isActive) {
          await supabaseAdmin.auth.admin.signOut(userId);
        }

        console.log('User active status toggled:', userId, isActive);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'delete': {
        const { userId } = userData;

        // Delete from auth (this will cascade to profiles due to foreign key)
        const { error } = await supabaseAdmin.auth.admin.deleteUser(userId);

        if (error) {
          console.error('Error deleting user:', error);
          throw error;
        }

        console.log('User deleted:', userId);

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        throw new Error('Invalid action');
    }

  } catch (error) {
    console.error('Error in admin-users function:', error);
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return new Response(
      JSON.stringify({ error: errorMessage }),
      { 
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
