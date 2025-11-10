import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export function CreateCampaignDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'vendas',
    start_date: '',
    end_date: '',
    goal_value: 0,
    goal_unit: 'peças',
  });

  const handleCreate = async () => {
    if (!formData.title || !formData.start_date || !formData.end_date) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('campaigns').insert([
        {
          title: formData.title,
          description: formData.description,
          type: formData.type,
          start_date: formData.start_date,
          end_date: formData.end_date,
          goal_value: formData.goal_value,
          goal_unit: formData.goal_unit,
          is_active: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Campanha criada',
        description: 'A campanha foi criada e já está ativa.',
      });

      setOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'vendas',
        start_date: '',
        end_date: '',
        goal_value: 0,
        goal_unit: 'peças',
      });
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar a campanha.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Nova Campanha
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Criar Nova Campanha</DialogTitle>
          <DialogDescription>
            Configure uma nova meta ou desafio corporativo
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título da Campanha</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ex: Meta de Vendas - Janeiro 2025"
            />
          </div>

          <div>
            <Label htmlFor="type">Tipo de Campanha</Label>
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
                <SelectItem value="vendas">Vendas</SelectItem>
                <SelectItem value="avaliacao">Avaliação de Peças</SelectItem>
                <SelectItem value="engajamento">Engajamento</SelectItem>
                <SelectItem value="produtividade">Produtividade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Descrição</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Descreva os objetivos e regras da campanha..."
              rows={4}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="start_date">Data de Início</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="end_date">Data de Término</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="goal_value">Meta (Valor)</Label>
              <Input
                id="goal_value"
                type="number"
                value={formData.goal_value}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    goal_value: parseFloat(e.target.value),
                  })
                }
                placeholder="1000"
              />
            </div>
            <div>
              <Label htmlFor="goal_unit">Unidade</Label>
              <Select
                value={formData.goal_unit}
                onValueChange={(value) =>
                  setFormData({ ...formData, goal_unit: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="peças">Peças</SelectItem>
                  <SelectItem value="reais">Reais (R$)</SelectItem>
                  <SelectItem value="pontos">Pontos</SelectItem>
                  <SelectItem value="avaliacoes">Avaliações</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <Button onClick={handleCreate} className="w-full">
            Criar Campanha
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
