import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Award } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateRecognitionDialog } from './CreateRecognitionDialog';

interface Recognition {
  id: string;
  title: string;
  description: string;
  type: string;
  user_id: string;
  month: string;
  year: number;
  is_published: boolean;
  likes_count: number;
  created_at: string;
}

export function AdminReconhecimento() {
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchRecognitions();
  }, []);

  const fetchRecognitions = async () => {
    try {
      const { data, error } = await supabase
        .from('recognitions')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setRecognitions(data || []);
    } catch (error) {
      console.error('Erro ao buscar reconhecimentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este reconhecimento?')) return;

    try {
      const { error } = await supabase.from('recognitions').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Reconhecimento excluído',
        description: 'O reconhecimento foi removido com sucesso.',
      });
      fetchRecognitions();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o reconhecimento.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando reconhecimentos...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Gerenciar Reconhecimentos</h2>
          <p className="text-muted-foreground">Destacar performance e cultura exemplar</p>
        </div>
        <CreateRecognitionDialog onSuccess={fetchRecognitions} />
      </div>

      <div className="grid gap-4">
        {recognitions.map((recognition) => (
          <Card key={recognition.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Award className="w-5 h-5" />
                    <CardTitle>{recognition.title}</CardTitle>
                    <Badge variant="outline">{recognition.type}</Badge>
                    <Badge variant={recognition.is_published ? 'default' : 'secondary'}>
                      {recognition.is_published ? 'Publicado' : 'Pendente'}
                    </Badge>
                  </div>
                  <CardDescription>{recognition.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(recognition.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{recognition.month}/{recognition.year}</span>
                <span>• {recognition.likes_count} curtidas</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
