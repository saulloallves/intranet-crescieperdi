import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CreateUserDialogProps {
  onSuccess: () => void;
}

export function CreateUserDialog({ onSuccess }: CreateUserDialogProps) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    email: '',
    password: '',
    full_name: '',
    role: 'colaborador' as 'admin' | 'colaborador' | 'franqueado' | 'gerente' | 'gestor_setor',
    unit_code: '',
    phone: '',
    cpf: '',
  });

  const handleCreate = async () => {
    if (!formData.email || !formData.password || !formData.full_name || !formData.cpf) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios (nome, email, CPF e senha).',
        variant: 'destructive',
      });
      return;
    }

    if (formData.cpf.length !== 11) {
      toast({
        title: 'Erro',
        description: 'CPF deve conter 11 dígitos.',
        variant: 'destructive',
      });
      return;
    }

    if (formData.password.length < 6) {
      toast({
        title: 'Erro',
        description: 'A senha deve ter pelo menos 6 caracteres.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'create',
          userData: formData,
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Usuário criado',
        description: `${formData.full_name} foi adicionado com sucesso.`,
      });

      setOpen(false);
      setFormData({
        email: '',
        password: '',
        full_name: '',
        role: 'colaborador',
        unit_code: '',
        phone: '',
        cpf: '',
      });
      onSuccess();
    } catch (error: any) {
      console.error('Error creating user:', error);
      toast({
        title: 'Erro ao criar usuário',
        description: error.message || 'Não foi possível criar o usuário.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Usuário
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Criar Novo Usuário</DialogTitle>
          <DialogDescription>
            Adicione um novo colaborador ao sistema
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="full_name">Nome Completo *</Label>
            <Input
              id="full_name"
              value={formData.full_name}
              onChange={(e) =>
                setFormData({ ...formData, full_name: e.target.value })
              }
              placeholder="João Silva"
            />
          </div>

          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input
              id="email"
              type="email"
              value={formData.email}
              onChange={(e) =>
                setFormData({ ...formData, email: e.target.value })
              }
              placeholder="joao@crescieperdi.com.br"
            />
          </div>

          <div>
            <Label htmlFor="cpf">CPF *</Label>
            <Input
              id="cpf"
              value={formData.cpf}
              onChange={(e) =>
                setFormData({ ...formData, cpf: e.target.value.replace(/\D/g, '').slice(0, 11) })
              }
              placeholder="00000000000"
              maxLength={11}
            />
            <p className="text-xs text-muted-foreground">Apenas números</p>
          </div>

          <div>
            <Label htmlFor="phone">WhatsApp (Opcional)</Label>
            <Input
              id="phone"
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
            <Label htmlFor="password">Senha Inicial *</Label>
            <Input
              id="password"
              type="password"
              value={formData.password}
              onChange={(e) =>
                setFormData({ ...formData, password: e.target.value })
              }
              placeholder="Mínimo 6 caracteres"
            />
          </div>

          <div>
            <Label htmlFor="role">Cargo/Função *</Label>
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
            <Label htmlFor="unit_code">Código da Unidade (Opcional)</Label>
            <Input
              id="unit_code"
              value={formData.unit_code}
              onChange={(e) =>
                setFormData({ ...formData, unit_code: e.target.value })
              }
              placeholder="Ex: SP001"
            />
          </div>

          <Button onClick={handleCreate} disabled={loading} className="w-full">
            {loading ? 'Criando...' : 'Criar Usuário'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
