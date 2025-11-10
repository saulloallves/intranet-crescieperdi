import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  unit_code: string | null;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
}

interface EditUserDialogProps {
  user: User | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

export function EditUserDialog({ user, open, onOpenChange, onSuccess }: EditUserDialogProps) {
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    full_name: '',
    role: 'colaborador' as 'admin' | 'colaborador' | 'franqueado' | 'gerente' | 'gestor_setor',
    unit_code: '',
    phone: '',
    cpf: '',
  });

  useEffect(() => {
    if (user) {
      setFormData({
        full_name: user.full_name,
        role: user.role as any,
        unit_code: user.unit_code || '',
        phone: user.phone || '',
        cpf: user.cpf || '',
      });
    }
  }, [user]);

  const handleUpdate = async () => {
    if (!user || !formData.full_name) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'update',
          userData: {
            userId: user.id,
            updates: formData,
          },
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Usuário atualizado',
        description: 'As informações foram salvas com sucesso.',
      });

      onOpenChange(false);
      onSuccess();
    } catch (error: any) {
      console.error('Error updating user:', error);
      toast({
        title: 'Erro ao atualizar',
        description: error.message || 'Não foi possível atualizar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (!user) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Editar Usuário</DialogTitle>
          <DialogDescription>
            Atualize as informações de {user.full_name}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label>E-mail (não editável)</Label>
            <Input value={user.email} disabled />
          </div>

          <div>
            <Label htmlFor="edit_full_name">Nome Completo *</Label>
            <Input
              id="edit_full_name"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
            />
          </div>

          <div>
            <Label htmlFor="edit_role">Cargo/Função *</Label>
            <Select
              value={formData.role}
              onValueChange={(value: any) =>
                setFormData({ ...formData, role: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="colaborador">Colaborador</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="franqueado">Franqueado</SelectItem>
                <SelectItem value="gestor_setor">Gestor de Setor</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="edit_cpf">CPF</Label>
            <Input
              id="edit_cpf"
              value={formData.cpf}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })
              }
              placeholder="00000000000"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground mt-1">
              Apenas números
            </p>
          </div>

          <div>
            <Label htmlFor="edit_phone">WhatsApp</Label>
            <Input
              id="edit_phone"
              value={formData.phone}
              onChange={(e) =>
                setFormData({ ...formData, phone: e.target.value })
              }
              placeholder="5511999999999"
            />
            <p className="text-xs text-muted-foreground mt-1">
              Formato: código do país + DDD + número (sem espaços)
            </p>
          </div>

          <div>
            <Label htmlFor="edit_unit_code">Código da Unidade</Label>
            <Input
              id="edit_unit_code"
              value={formData.unit_code}
              onChange={(e) =>
                setFormData({ ...formData, unit_code: e.target.value })
              }
              placeholder="Ex: SP001"
            />
          </div>

          <Button onClick={handleUpdate} disabled={loading} className="w-full">
            {loading ? 'Salvando...' : 'Salvar Alterações'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
