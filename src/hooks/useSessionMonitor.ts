import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

/**
 * Hook para monitorar o estado da sessão do Supabase
 * e avisar quando o token expirar ou houver problemas
 */
export function useSessionMonitor() {
  useEffect(() => {
    // Listener para mudanças na autenticação
    const { data: authListener } = supabase.auth.onAuthStateChange((event, session) => {
      console.log('🔐 Auth event:', event, session?.expires_at);

      switch (event) {
        case 'SIGNED_OUT':
          console.log('❌ Usuário deslogado');
          toast.error('Sessão encerrada. Faça login novamente.');
          break;
        
        case 'TOKEN_REFRESHED':
          console.log('✅ Token renovado automaticamente');
          const expiresAt = session?.expires_at 
            ? new Date(session.expires_at * 1000).toLocaleTimeString() 
            : 'desconhecido';
          console.log('🕐 Novo token expira em:', expiresAt);
          break;
        
        case 'SIGNED_IN':
          console.log('✅ Usuário logado');
          break;
        
        case 'USER_UPDATED':
          console.log('👤 Dados do usuário atualizados');
          break;
      }
    });

    // Verificar sessão ao montar
    const checkSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession();
      
      if (error) {
        console.error('❌ Erro ao verificar sessão:', error);
        return;
      }

      if (!session) {
        console.log('⚠️ Nenhuma sessão ativa');
        return;
      }

      // Calcular tempo restante
      const expiresAt = new Date(session.expires_at! * 1000);
      const now = new Date();
      const minutesLeft = Math.floor((expiresAt.getTime() - now.getTime()) / 1000 / 60);

      console.log('🔐 Sessão ativa');
      console.log('⏰ Token expira em:', expiresAt.toLocaleString());
      console.log('⌛ Tempo restante:', minutesLeft, 'minutos');

      // Avisar se o token está perto de expirar (< 5 minutos)
      if (minutesLeft < 5 && minutesLeft > 0) {
        toast.warning(`Sua sessão expira em ${minutesLeft} minutos. Salve seu trabalho!`);
      }
    };

    checkSession();

    // Cleanup
    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, []);
}

