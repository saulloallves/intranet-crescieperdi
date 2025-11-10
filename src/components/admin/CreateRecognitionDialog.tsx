import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface User {
  id: string;
  full_name: string;
  email: string;
}

export function CreateRecognitionDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();
  const { user } = useAuth();
  const [users, setUsers] = useState<User[]>([]);

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'destaque_mes',
    user_id: '',
    month: new Date().toLocaleString('pt-BR', { month: 'long' }),
    year: new Date().getFullYear(),
  });

  useEffect(() => {
    if (open) {
      fetchUsers();
    }
  }, [open]);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('id, full_name, email')
        .eq('is_active', true)
        .order('full_name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Erro ao buscar usuários:', error);
    }
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.description || !formData.user_id) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('recognitions').insert([
        {
          title: formData.title,
          description: formData.description,
          type: formData.type,
          user_id: formData.user_id,
          created_by: user?.id,
          month: formData.month,
          year: formData.year,
          is_published: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Reconhecimento criado',
        description: 'O reconhecimento foi publicado com sucesso.',
      });

      setOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'destaque_mes',
        user_id: '',
        month: new Date().toLocaleString('pt-BR', { month: 'long' }),
        year: new Date().getFullYear(),
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o reconhecimento.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Reconhecimento
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar Reconhecimento</DialogTitle>
          <DialogDescription>
            Destaque a performance e comportamento exemplar
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="user_id">Colaborador</Label>
            <Select
              value={formData.user_id}
              onValueChange={(value) =>
                setFormData({ ...formData, user_id: value })
              }
            >
              <SelectTrigger>
                <SelectValue placeholder="Selecione um colaborador" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user.id} value={user.id}>
                    {user.full_name} ({user.email})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="type">Tipo de Reconhecimento</Label>
            <Select
              value={formData.type}
              onValueChange={(value) =>
                setFormData({ ...formData, type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="destaque_mes">Destaque do Mês</SelectItem>
                <SelectItem value="melhor_vendedor">
                  Melhor Vendedor
                </SelectItem>
                <SelectItem value="excelencia_atendimento">
                  Excelência em Atendimento
                </SelectItem>
                <SelectItem value="colaborador_nota_10">
                  Colaborador Nota 10
                </SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ex: Colaboradora do Mês - Janeiro 2025"
            />
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descreva os motivos do reconhecimento..."
              rows={6}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="month">Mês</Label>
              <Input
                id="month"
                value={formData.month}
                onChange={(e) =>
                  setFormData({ ...formData, month: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="year">Ano</Label>
              <Input
                id="year"
                type="number"
                value={formData.year}
                onChange={(e) =>
                  setFormData({ ...formData, year: parseInt(e.target.value) })
                }
              />
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full">
            Publicar Reconhecimento
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
