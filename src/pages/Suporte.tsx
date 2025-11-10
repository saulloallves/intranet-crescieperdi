import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { supabase } from '@/integrations/supabase/client';

export default function Suporte() {
  const [typebotUrl, setTypebotUrl] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchTypebotUrl();
  }, []);

  const fetchTypebotUrl = async () => {
    try {
      const { data } = await supabase
        .from('settings')
        .select('value')
        .eq('key', 'typebot_support_url')
        .single();

      if (data && data.value) {
        setTypebotUrl(data.value as string);
      }
    } catch (error) {
      console.error('Error fetching typebot URL:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="h-[calc(100vh-8rem)]">
        {typebotUrl ? (
          <iframe
            src={typebotUrl}
            className="w-full h-full border-0"
            title="Suporte via Typebot"
            allow="microphone; camera"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <p className="text-muted-foreground">
              URL do Typebot de suporte não configurada
            </p>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
