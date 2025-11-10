import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, GraduationCap, Clock, Target } from 'lucide-react';

interface TrainingPath {
  id: string;
  name: string;
  description: string;
  target_role: string;
  icon: string;
  color: string;
  is_active: boolean;
  order_index: number;
  estimated_duration_hours: number;
  created_at: string;
}

const ROLES = [
  { value: 'avaliadora', label: 'Avaliadora', icon: '👩‍⚕️' },
  { value: 'gerente', label: 'Gerente', icon: '👔' },
  { value: 'social_midia', label: 'Social Mídia', icon: '📱' },
  { value: 'operador_caixa', label: 'Operador de Caixa', icon: '💰' },
  { value: 'franqueado', label: 'Franqueado', icon: '🏢' },
  { value: 'suporte', label: 'Suporte', icon: '🎧' },
];

export function TrainingPathManager() {
  const [paths, setPaths] = useState<TrainingPath[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPath, setEditingPath] = useState<TrainingPath | null>(null);
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    name: '',
    description: '',
    target_role: 'colaborador',
    icon: '🎓',
    color: '#3b82f6',
    is_active: true,
    estimated_duration_hours: 40,
  });

  useEffect(() => {
    fetchPaths();
  }, []);

  const fetchPaths = async () => {
    try {
      const { data, error } = await supabase
        .from('training_paths' as any)
        .select('*')
        .order('order_index', { ascending: true });

      if (error) throw error;
      setPaths((data as any) || []);
    } catch (error) {
      console.error('Error fetching paths:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async () => {
    try {
      if (editingPath) {
        const { error } = await supabase
          .from('training_paths' as any)
          .update(formData)
          .eq('id', editingPath.id);

        if (error) throw error;
        toast({ title: 'Trilha atualizada com sucesso!' });
      } else {
        const { error } = await supabase
          .from('training_paths' as any)
          .insert([formData]);

        if (error) throw error;
        toast({ title: 'Trilha criada com sucesso!' });
      }

      setDialogOpen(false);
      resetForm();
      fetchPaths();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleEdit = (path: TrainingPath) => {
    setEditingPath(path);
    setFormData({
      name: path.name,
      description: path.description,
      target_role: path.target_role,
      icon: path.icon,
      color: path.color,
      is_active: path.is_active,
      estimated_duration_hours: path.estimated_duration_hours,
    });
    setDialogOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta trilha?')) return;

    try {
      const { error } = await supabase
        .from('training_paths' as any)
        .delete()
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Trilha excluída com sucesso!' });
      fetchPaths();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const toggleActive = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('training_paths' as any)
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;
      toast({ title: 'Status atualizado!' });
      fetchPaths();
    } catch (error: any) {
      toast({
        title: 'Erro',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setEditingPath(null);
    setFormData({
      name: '',
      description: '',
      target_role: 'colaborador',
      icon: '🎓',
      color: '#3b82f6',
      is_active: true,
      estimated_duration_hours: 40,
    });
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-xl font-semibold">Trilhas de Treinamento</h3>
          <p className="text-sm text-muted-foreground">Jornadas personalizadas por cargo</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetForm();
        }}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Nova Trilha
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingPath ? 'Editar' : 'Criar'} Trilha</DialogTitle>
              <DialogDescription>
                Configure uma jornada de aprendizado personalizada
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label htmlFor="name">Nome da Trilha</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Trilha de Avaliadora"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva os objetivos desta trilha"
                  rows={3}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="target_role">Cargo</Label>
                  <Select value={formData.target_role} onValueChange={(value) => setFormData({ ...formData, target_role: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map((role) => (
                        <SelectItem key={role.value} value={role.value}>
                          {role.icon} {role.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duração Estimada (horas)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.estimated_duration_hours}
                    onChange={(e) => setFormData({ ...formData, estimated_duration_hours: parseInt(e.target.value) || 0 })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="icon">Ícone (Emoji)</Label>
                  <Input
                    id="icon"
                    value={formData.icon}
                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                    placeholder="🎓"
                    maxLength={2}
                  />
                </div>
                <div>
                  <Label htmlFor="color">Cor</Label>
                  <Input
                    id="color"
                    type="color"
                    value={formData.color}
                    onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                  />
                </div>
              </div>
              <div className="flex items-center space-x-2">
                <Switch
                  id="active"
                  checked={formData.is_active}
                  onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                />
                <Label htmlFor="active">Trilha ativa (visível para usuários)</Label>
              </div>
              <Button onClick={handleSubmit} className="w-full">
                {editingPath ? 'Atualizar' : 'Criar'} Trilha
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {paths.map((path) => (
          <Card key={path.id} className={!path.is_active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{path.icon}</span>
                    <Badge
                      variant={path.is_active ? 'default' : 'secondary'}
                      style={{ backgroundColor: path.is_active ? path.color : undefined }}
                    >
                      {path.target_role}
                    </Badge>
                  </div>
                  <CardTitle className="text-lg">{path.name}</CardTitle>
                  <CardDescription className="mt-1">{path.description}</CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground mb-4">
                <div className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  <span>{path.estimated_duration_hours}h</span>
                </div>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleEdit(path)}
                  className="flex-1"
                >
                  <Edit className="w-4 h-4 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => toggleActive(path.id, path.is_active)}
                >
                  <Target className="w-4 h-4" />
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDelete(path.id)}
                >
                  <Trash2 className="w-4 h-4" />
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {paths.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <GraduationCap className="w-12 h-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground text-center">
              Nenhuma trilha criada ainda.<br />
              Clique em "Nova Trilha" para começar.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
