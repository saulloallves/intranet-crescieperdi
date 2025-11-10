import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Eye, EyeOff, FileText } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateManualDialog } from './CreateManualDialog';

interface Manual {
  id: string;
  title: string;
  content: string;
  category: string;
  file_url: string;
  file_type: string;
  is_published: boolean;
  views_count: number;
  created_at: string;
}

export function AdminManuais() {
  const [manuals, setManuals] = useState<Manual[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchManuals();
  }, []);

  const fetchManuals = async () => {
    try {
      const { data, error } = await supabase
        .from('knowledge_base')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setManuals(data || []);
    } catch (error) {
      console.error('Erro ao buscar manuais:', error);
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('knowledge_base')
        .update({ is_published: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Manual ${!currentStatus ? 'publicado' : 'despublicado'} com sucesso.`,
      });
      fetchManuals();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este manual?')) return;

    try {
      const { error } = await supabase.from('knowledge_base').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Manual excluído',
        description: 'O manual foi removido com sucesso.',
      });
      fetchManuals();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o manual.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando manuais...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Gerenciar Manuais</h2>
          <p className="text-muted-foreground">Base de conhecimento institucional</p>
        </div>
        <CreateManualDialog onSuccess={fetchManuals} />
      </div>

      <div className="grid gap-4">
        {manuals.map((manual) => (
          <Card key={manual.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <FileText className="w-5 h-5" />
                    <CardTitle>{manual.title}</CardTitle>
                    <Badge variant={manual.is_published ? 'default' : 'secondary'}>
                      {manual.is_published ? 'Publicado' : 'Rascunho'}
                    </Badge>
                    <Badge variant="outline">{manual.category}</Badge>
                  </div>
                  <CardDescription>{manual.content.substring(0, 150)}...</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => togglePublish(manual.id, manual.is_published)}
                  >
                    {manual.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(manual.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>{manual.views_count} visualizações</span>
                {manual.file_type && <span>• Tipo: {manual.file_type}</span>}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
