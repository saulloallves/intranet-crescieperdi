import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus, Trash2, Clock, AlertCircle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Switch } from '@/components/ui/switch';
import { useEffect, useState as useStateReact } from 'react';

interface Question {
  id: string;
  text: string;
  type: 'text' | 'checkbox' | 'photo';
  required: boolean;
}

export function CreateChecklistDialog({ onSuccess }: { onSuccess: () => void }) {
  const [open, setOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    title: '',
    description: '',
    type: 'abertura',
    frequency: 'diario',
    reminder_time: '08:00',
    deadline_time: '10:00',
    alert_after_deadline: true,
    applicable_units: [] as string[],
    alert_recipients: ['gestor_setor', 'admin'] as string[],
  });

  const [units, setUnits] = useState<Array<{ code: string; name: string }>>([]);
  const [questions, setQuestions] = useState<Question[]>([
    { id: '1', text: '', type: 'text', required: true },
  ]);

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('units')
      .select('code, name')
      .eq('is_active', true)
      .order('name');
    
    if (data) {
      setUnits(data);
    }
  };

  const addQuestion = () => {
    setQuestions([
      ...questions,
      { id: Date.now().toString(), text: '', type: 'text', required: true },
    ]);
  };

  const removeQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const updateQuestion = (id: string, field: keyof Question, value: any) => {
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, [field]: value } : q))
    );
  };

  const handleCreate = async () => {
    if (!formData.title || questions.some((q) => !q.text)) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('checklists').insert([
        {
          title: formData.title,
          description: formData.description,
          type: formData.type,
          frequency: formData.frequency,
          reminder_time: formData.reminder_time,
          deadline_time: formData.deadline_time,
          alert_after_deadline: formData.alert_after_deadline,
          applicable_units: formData.applicable_units,
          alert_recipients: formData.alert_recipients,
          questions: questions.map(({ id, ...rest }) => rest),
          is_active: true,
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Checklist criado',
        description: 'O checklist foi criado com sucesso e já está ativo.',
      });

      setOpen(false);
      setFormData({
        title: '',
        description: '',
        type: 'abertura',
        frequency: 'diario',
        reminder_time: '08:00',
        deadline_time: '10:00',
        alert_after_deadline: true,
        applicable_units: [],
        alert_recipients: ['gestor_setor', 'admin'],
      });
      setQuestions([{ id: '1', text: '', type: 'text', required: true }]);
      onSuccess();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o checklist.',
        variant: 'destructive',
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Plus className="w-4 h-4 mr-2" />
          Novo Checklist
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Criar Novo Checklist</DialogTitle>
          <DialogDescription>
            Configure um novo checklist operacional
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Título</Label>
            <Input
              id="title"
              value={formData.title}
              onChange={(e) =>
                setFormData({ ...formData, title: e.target.value })
              }
              placeholder="Ex: Checklist de Abertura"
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
              placeholder="Descreva o objetivo deste checklist"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="type">Tipo</Label>
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
                  <SelectItem value="abertura">Abertura</SelectItem>
                  <SelectItem value="fechamento">Fechamento</SelectItem>
                  <SelectItem value="operacional">Operacional</SelectItem>
                  <SelectItem value="limpeza">Limpeza</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="frequency">Frequência</Label>
              <Select
                value={formData.frequency}
                onValueChange={(value) =>
                  setFormData({ ...formData, frequency: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="diario">Diário</SelectItem>
                  <SelectItem value="semanal">Semanal</SelectItem>
                  <SelectItem value="mensal">Mensal</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-4 p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <Clock className="w-4 h-4" />
              <Label className="text-base font-semibold">Configurações de Horário e Alertas</Label>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="reminder_time">Horário do Lembrete</Label>
                <Input
                  id="reminder_time"
                  type="time"
                  value={formData.reminder_time}
                  onChange={(e) =>
                    setFormData({ ...formData, reminder_time: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quando enviar lembrete aos usuários
                </p>
              </div>

              <div>
                <Label htmlFor="deadline_time">Horário Limite</Label>
                <Input
                  id="deadline_time"
                  type="time"
                  value={formData.deadline_time}
                  onChange={(e) =>
                    setFormData({ ...formData, deadline_time: e.target.value })
                  }
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Prazo máximo para envio
                </p>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="alert_after_deadline">Alertar após prazo</Label>
                <p className="text-xs text-muted-foreground">
                  Enviar notificações automáticas via WhatsApp e Push
                </p>
              </div>
              <Switch
                id="alert_after_deadline"
                checked={formData.alert_after_deadline}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, alert_after_deadline: checked })
                }
              />
            </div>

            <div>
              <Label htmlFor="applicable_units">Unidades Aplicáveis</Label>
              <Select
                value={formData.applicable_units.length > 0 ? 'custom' : 'all'}
                onValueChange={(value) => {
                  if (value === 'all') {
                    setFormData({ ...formData, applicable_units: units.map(u => u.code) });
                  } else {
                    setFormData({ ...formData, applicable_units: [] });
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione as unidades" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas as unidades ({units.length})</SelectItem>
                  <SelectItem value="custom">Selecionar manualmente</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                {formData.applicable_units.length > 0 
                  ? `${formData.applicable_units.length} unidade(s) selecionada(s)`
                  : 'Nenhuma unidade selecionada'}
              </p>
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Label>Perguntas</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addQuestion}
              >
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Pergunta
              </Button>
            </div>

            {questions.map((question, index) => (
              <div
                key={question.id}
                className="flex gap-2 items-start p-4 bg-muted rounded-lg"
              >
                <div className="flex-1 space-y-2">
                  <Input
                    placeholder={`Pergunta ${index + 1}`}
                    value={question.text}
                    onChange={(e) =>
                      updateQuestion(question.id, 'text', e.target.value)
                    }
                  />
                  <Select
                    value={question.type}
                    onValueChange={(value) =>
                      updateQuestion(question.id, 'type', value)
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="text">Texto</SelectItem>
                      <SelectItem value="checkbox">Sim/Não</SelectItem>
                      <SelectItem value="photo">Foto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {questions.length > 1 && (
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    onClick={() => removeQuestion(question.id)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                )}
              </div>
            ))}
          </div>

          <Button onClick={handleCreate} className="w-full">
            Criar Checklist
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
