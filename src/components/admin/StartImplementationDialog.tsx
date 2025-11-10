import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { Lightbulb } from 'lucide-react';

interface Idea {
  id: string;
  title: string;
  quorum?: number;
  positive_votes?: number;
  submitted_by: string;
}

interface StartImplementationDialogProps {
  idea: Idea | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

interface User {
  id: string;
  full_name: string;
  role: string;
}

export function StartImplementationDialog({ idea, open, onOpenChange, onSuccess }: StartImplementationDialogProps) {
  const { toast } = useToast();
  const [responsibleUserId, setResponsibleUserId] = useState('');
  const [deadline, setDeadline] = useState('');
  const [notes, setNotes] = useState('');
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    const { data } = await supabase
      .from('profiles')
      .select('id, full_name, role')
      .in('role', ['admin', 'gestor_setor'])
      .eq('is_active', true)
      .order('full_name');
    
    setUsers(data || []);
  };

  if (!idea) return null;

  const handleStart = async () => {
    if (!responsibleUserId || !deadline) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha o responsável e o prazo.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase
        .from('ideas')
        .update({
          status: 'em_implementacao',
          implemented_by: responsibleUserId,
          implementation_deadline: deadline,
          implementation_notes: notes || null,
        })
        .eq('id', idea.id);

      if (error) throw error;

      // Notificar autor e responsável
      await supabase.from('ideas_notifications').insert([
        {
          user_id: idea.submitted_by,
          idea_id: idea.id,
          type: 'status',
          message: `🚀 Sua ideia "${idea.title}" entrou em implementação! Previsão: ${new Date(deadline).toLocaleDateString('pt-BR')}`,
        },
        {
          user_id: responsibleUserId,
          idea_id: idea.id,
          type: 'status',
          message: `Você foi designado responsável pela implementação da ideia "${idea.title}"`,
        },
      ]);

      toast({ 
        title: '✅ Implementação iniciada!',
        description: 'As notificações foram enviadas.'
      });
      
      onSuccess();
      onOpenChange(false);
      
      // Resetar form
      setResponsibleUserId('');
      setDeadline('');
      setNotes('');
    } catch (error: any) {
      toast({
        title: 'Erro ao iniciar implementação',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Iniciar Implementação</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <Alert>
            <Lightbulb className="h-4 w-4" />
            <AlertTitle>{idea.title}</AlertTitle>
            <AlertDescription>
              Aprovada com {idea.quorum?.toFixed(1) || 0}% dos votos ({idea.positive_votes || 0} favoráveis)
            </AlertDescription>
          </Alert>
          
          <div className="space-y-2">
            <Label htmlFor="responsible">Responsável *</Label>
            <Select value={responsibleUserId} onValueChange={setResponsibleUserId}>
              <SelectTrigger id="responsible">
                <SelectValue placeholder="Selecione o responsável" />
              </SelectTrigger>
              <SelectContent>
                {users.map(user => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.role})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="deadline">Prazo de implementação *</Label>
            <Input
              id="deadline"
              type="date"
              value={deadline}
              onChange={(e) => setDeadline(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
            />
          </div>
          
          <div className="space-y-2">
            <Label htmlFor="notes">Observações</Label>
            <Textarea
              id="notes"
              placeholder="Detalhes sobre o projeto de implementação..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
          
          <div className="flex justify-end gap-2 pt-4 border-t">
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button 
              onClick={handleStart}
              disabled={loading || !responsibleUserId || !deadline}
            >
              {loading ? 'Iniciando...' : 'Iniciar Implementação'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
