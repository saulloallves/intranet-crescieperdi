import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Image } from 'lucide-react';

export default function Midias() {
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
        .eq('key', 'typebot_midias_url')
        .single();

      if (data && data.value) {
        const url = typeof data.value === 'string' ? data.value : JSON.stringify(data.value);
        setTypebotUrl(url.replace(/^"|"$/g, ''));
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
            title="Módulo de Mídias"
            allow="microphone; camera"
          />
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6">
            <Card className="max-w-md w-full">
              <CardContent className="pt-6 text-center">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-indigo-500 to-indigo-600 mx-auto mb-4 flex items-center justify-center">
                  <Image className="w-8 h-8 text-white" />
                </div>
                <h3 className="text-xl font-bold mb-2">Módulo de Mídias</h3>
                <p className="text-muted-foreground mb-4">
                  O módulo de solicitação de mídias ainda não foi configurado.
                </p>
                <p className="text-sm text-muted-foreground">
                  Entre em contato com o administrador para configurar o link do Typebot de Mídias.
                </p>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </AppLayout>
  );
}
