import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

type UserRole = 'colaborador' | 'gerente' | 'franqueado' | 'gestor_setor' | 'admin';

interface Profile {
  id: string;
  full_name: string;
  email: string;
  role: UserRole;
  unit_code: string | null;
  avatar_url: string | null;
  is_active: boolean;
  phone: string | null;
  cpf: string | null;
  receive_whatsapp_notifications: boolean;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signUp: (email: string, password: string, fullName: string, additionalData?: {
    phone?: string;
    cpf?: string;
    unit_code?: string;
    role?: UserRole;
  }) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
  isAdmin: boolean;
  isGestor: boolean;
  hasRole: (role: UserRole) => boolean;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [userRoles, setUserRoles] = useState<UserRole[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  // Dev mode flag
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  // Mock user para dev mode
  const createMockUser = (role: UserRole = 'colaborador'): { user: User; profile: Profile; roles: UserRole[] } => {
    const mockUserId = 'dev-user-id';
    const mockUser = {
      id: mockUserId,
      email: 'dev@crescieperdi.com',
      created_at: new Date().toISOString(),
      app_metadata: {},
      user_metadata: {},
      aud: 'authenticated',
      role: 'authenticated',
    } as User;

    const mockProfile: Profile = {
      id: mockUserId,
      full_name: 'Usuário de Desenvolvimento',
      email: 'dev@crescieperdi.com',
      role: role,
      unit_code: '1221',
      avatar_url: null,
      is_active: true,
      phone: null,
      cpf: null,
      receive_whatsapp_notifications: false,
    };

    // Define roles baseado no role selecionado
    let roles: UserRole[] = [role];
    if (role === 'admin') {
      roles = ['admin', 'gestor_setor', 'gerente', 'franqueado', 'colaborador'];
    } else if (role === 'gestor_setor') {
      roles = ['gestor_setor', 'gerente', 'franqueado', 'colaborador'];
    } else if (role === 'gerente') {
      roles = ['gerente', 'colaborador'];
    } else if (role === 'franqueado') {
      roles = ['franqueado', 'colaborador'];
    }

    return { user: mockUser, profile: mockProfile, roles };
  };

  useEffect(() => {
    // Dev mode: criar usuário mock e não fazer auth real
    if (isDevMode) {
      const mock = createMockUser('admin');
      setUser(mock.user);
      setProfile(mock.profile);
      setUserRoles(mock.roles);
      setLoading(false);

      // Listener para mudanças de role em dev mode
      const handleRoleChange = (event: any) => {
        const newRole = event.detail.role as UserRole;
        const newMock = createMockUser(newRole);
        setProfile(newMock.profile);
        setUserRoles(newMock.roles);
        toast({
          title: 'Role alterada (Dev Mode)',
          description: `Agora você é: ${newRole}`,
        });
      };

      window.addEventListener('dev-role-change', handleRoleChange);
      return () => window.removeEventListener('dev-role-change', handleRoleChange);
    }

    // Produção: auth real com Supabase
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        if (session?.user) {
          setTimeout(async () => {
            const { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .single();
            
            if (profileData) {
              setProfile(profileData);
            }

            const { data: rolesData } = await supabase
              .from('user_roles')
              .select('role')
              .eq('user_id', session.user.id);
            
            if (rolesData) {
              setUserRoles(rolesData.map(r => r.role as UserRole));
            }
          }, 0);
        } else {
          setProfile(null);
          setUserRoles([]);
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      
      if (session?.user) {
        Promise.all([
          supabase
            .from('profiles')
            .select('*')
            .eq('id', session.user.id)
            .single(),
          supabase
            .from('user_roles')
            .select('role')
            .eq('user_id', session.user.id)
        ]).then(([profileResult, rolesResult]) => {
          if (profileResult.data) setProfile(profileResult.data);
          if (rolesResult.data) {
            setUserRoles(rolesResult.data.map(r => r.role as UserRole));
          }
          setLoading(false);
        });
      } else {
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [isDevMode]);

  const signIn = async (email: string, password: string) => {
    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        toast({
          title: 'Erro ao fazer login',
          description: error.message,
          variant: 'destructive',
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signUp = async (email: string, password: string, fullName: string, additionalData?: {
    phone?: string;
    cpf?: string;
    unit_code?: string;
    role?: UserRole;
  }) => {
    try {
      const redirectUrl = `${window.location.origin}/`;
      
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: fullName,
            phone: additionalData?.phone,
            cpf: additionalData?.cpf,
            unit_code: additionalData?.unit_code,
            role: additionalData?.role || 'colaborador',
          }
        }
      });

      if (error) {
        toast({
          title: 'Erro ao criar conta',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Conta criada!',
          description: 'Verifique seu email para confirmar o cadastro.',
        });
      }

      return { error };
    } catch (error: any) {
      return { error };
    }
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
    setProfile(null);
    setUserRoles([]);
    toast({
      title: 'Logout realizado',
      description: 'Até logo!',
    });
  };

  const hasRole = (role: UserRole) => userRoles.includes(role);
  const isAdmin = hasRole('admin');
  const isGestor = hasRole('gestor_setor') || hasRole('admin');

  return (
    <AuthContext.Provider
      value={{
        user,
        session,
        profile,
        loading,
        signIn,
        signUp,
        signOut,
        isAdmin,
        isGestor,
        hasRole,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
