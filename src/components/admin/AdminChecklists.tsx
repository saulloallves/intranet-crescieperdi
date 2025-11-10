import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, ToggleLeft, ToggleRight, Clock, AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateChecklistDialog } from './CreateChecklistDialog';

interface Checklist {
  id: string;
  title: string;
  description: string;
  type: string;
  frequency: string;
  is_active: boolean;
  questions: any;
  created_at: string;
  reminder_time?: string;
  deadline_time?: string;
  alert_after_deadline?: boolean;
  applicable_units?: string[];
}

export function AdminChecklists() {
  const [checklists, setChecklists] = useState<Checklist[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchChecklists();
  }, []);

  const fetchChecklists = async () => {
    try {
      const { data, error } = await supabase
        .from('checklists')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setChecklists(data || []);
    } catch (error) {
      console.error('Erro ao buscar checklists:', error);
    } finally {
      setLoading(false);
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('checklists')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Checklist ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });
      fetchChecklists();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este checklist?')) return;

    try {
      const { error } = await supabase.from('checklists').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Checklist excluído',
        description: 'O checklist foi removido com sucesso.',
      });
      fetchChecklists();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o checklist.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando checklists...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Gerenciar Checklists</h2>
          <p className="text-muted-foreground">Processos operacionais padronizados</p>
        </div>
        <CreateChecklistDialog onSuccess={fetchChecklists} />
      </div>

      <div className="grid gap-4">
        {checklists.map((checklist) => (
          <Card key={checklist.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle>{checklist.title}</CardTitle>
                    <Badge variant={checklist.is_active ? 'default' : 'secondary'}>
                      {checklist.is_active ? 'Ativo' : 'Inativo'}
                    </Badge>
                    <Badge variant="outline">{checklist.type}</Badge>
                  </div>
                  <CardDescription>{checklist.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => toggleActive(checklist.id, checklist.is_active)}
                  >
                    {checklist.is_active ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(checklist.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Frequência: {checklist.frequency}</span>
                  <span>• {Array.isArray(checklist.questions) ? checklist.questions.length : 0} perguntas</span>
                  {checklist.applicable_units && checklist.applicable_units.length > 0 && (
                    <span>• {checklist.applicable_units.length} unidade(s)</span>
                  )}
                </div>
                
                {(checklist.reminder_time || checklist.deadline_time) && (
                  <div className="flex items-center gap-4 p-3 bg-muted rounded-lg">
                    <Clock className="w-4 h-4 text-primary" />
                    <div className="flex items-center gap-4 text-sm">
                      {checklist.reminder_time && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Lembrete:</span>
                          <span className="font-medium">{checklist.reminder_time}h</span>
                        </div>
                      )}
                      {checklist.deadline_time && (
                        <div className="flex items-center gap-1">
                          <span className="text-muted-foreground">Prazo:</span>
                          <span className="font-medium">{checklist.deadline_time}h</span>
                        </div>
                      )}
                      {checklist.alert_after_deadline && (
                        <Badge variant="destructive" className="flex items-center gap-1">
                          <AlertTriangle className="w-3 h-3" />
                          Alertas ativos
                        </Badge>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
