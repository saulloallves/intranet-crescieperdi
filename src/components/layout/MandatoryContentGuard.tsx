import { useEffect, useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { supabase } from '@/integrations/supabase/client';
import { Loader2 } from 'lucide-react';

export function MandatoryContentGuard({ children }: { children: React.ReactNode }) {
  const { user, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const checkContent = async () => {
      if (authLoading || !user || !profile) {
        setChecking(false);
        return;
      }

      await checkMandatoryContent();
    };

    checkContent();
  }, [user, profile, authLoading, location.pathname]);

  const checkMandatoryContent = async () => {
    // Dev mode: bypass completo
    if (import.meta.env.VITE_DEV_MODE === 'true') {
      setChecking(false);
      return;
    }

    // Permitir acesso à página de conteúdos obrigatórios e auth
    if (location.pathname === '/conteudos-obrigatorios' || location.pathname === '/auth' || location.pathname === '/forgot-password') {
      setChecking(false);
      return;
    }

    try {
      // Verificar configuração de bloqueio
      const { data: blockConfig } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'mandatory_content_block_access')
        .maybeSingle();

      if (blockConfig?.value !== 'true') {
        setChecking(false);
        return;
      }

      // Buscar conteúdos ativos para o público-alvo do usuário
      const targetAudience = profile?.role === 'franqueado' ? 'franqueados' : 'colaboradores';
      const { data: contents, error: contentsError } = await supabase
        .from('mandatory_contents')
        .select('id')
        .eq('active', true)
        .or(`target_audience.eq.ambos,target_audience.eq.${targetAudience}`);

      if (contentsError) throw contentsError;

      // Verificar se completou todos
      if (contents && contents.length > 0) {
        for (const content of contents) {
          const { data: signature } = await supabase
            .from('mandatory_content_signatures')
            .select('success')
            .eq('content_id', content.id)
            .eq('user_id', user!.id)
            .eq('success', true)
            .maybeSingle();

          if (!signature) {
            // Tem conteúdo pendente, redirecionar
            navigate('/conteudos-obrigatorios', { replace: true });
            setChecking(false);
            return;
          }
        }
      }

      setChecking(false);
    } catch (error) {
      console.error('Erro ao verificar conteúdos obrigatórios:', error);
      setChecking(false);
    }
  };

  if (authLoading || checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-12 h-12 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
