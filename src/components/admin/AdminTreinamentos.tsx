import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Checkbox } from '@/components/ui/checkbox';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Eye, EyeOff, BarChart3 } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { TrainingDashboard } from '@/components/training/TrainingDashboard';

interface Training {
  id: string;
  title: string;
  description: string;
  content: string;
  video_url: string;
  category: string;
  duration_minutes: number;
  is_published: boolean;
  target_roles: string[];
  created_at: string;
}

export function AdminTreinamentos() {
  const [trainings, setTrainings] = useState<Training[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { toast } = useToast();

  const [formData, setFormData] = useState<{
    title: string;
    description: string;
    content: string;
    video_url: string;
    category: string;
    duration_minutes: number;
    certificate_enabled: boolean;
    min_score: number;
    target_roles: Array<'admin' | 'colaborador' | 'franqueado' | 'gerente' | 'gestor_setor'>;
  }>({
    title: '',
    description: '',
    content: '',
    video_url: '',
    category: 'operacional',
    duration_minutes: 30,
    certificate_enabled: false,
    min_score: 70,
    target_roles: [],
  });

  useEffect(() => {
    fetchTrainings();
    fetchCategories();
  }, []);

  const fetchTrainings = async () => {
    try {
      const { data, error } = await supabase
        .from('trainings')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTrainings(data || []);
    } catch (error) {
      console.error('Erro ao buscar treinamentos:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('training_categories')
        .select('*')
        .eq('is_active', true)
        .order('order_index', { ascending: true });

      if (error) throw error;
      setCategories(data || []);
    } catch (error) {
      console.error('Erro ao buscar categorias:', error);
    }
  };

  const getCategoryInfo = (slug: string) => {
    return categories.find(cat => cat.slug === slug);
  };

  const handleCreate = async () => {
    if (!formData.title || !formData.description) {
      toast({
        title: 'Erro',
        description: 'Preencha todos os campos obrigatórios.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { error } = await supabase.from('trainings').insert([
        {
          title: formData.title,
          description: formData.description,
          content: formData.content,
          video_url: formData.video_url,
          category: formData.category,
          duration_minutes: formData.duration_minutes,
          certificate_enabled: formData.certificate_enabled,
          min_score: formData.min_score,
          target_roles: formData.target_roles.length > 0 ? formData.target_roles : null,
          is_published: false,
          modules: [],
        },
      ]);

      if (error) throw error;

      toast({
        title: 'Treinamento criado',
        description: 'O treinamento foi criado com sucesso e estará visível quando publicado.',
      });

      setDialogOpen(false);
      setFormData({
        title: '',
        description: '',
        content: '',
        video_url: '',
        category: 'operacional',
        duration_minutes: 30,
        certificate_enabled: false,
        min_score: 70,
        target_roles: [],
      });
      fetchTrainings();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível criar o treinamento.',
        variant: 'destructive',
      });
    }
  };

  const togglePublish = async (id: string, currentStatus: boolean) => {
    try {
      const { error } = await supabase
        .from('trainings')
        .update({ is_published: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Treinamento ${!currentStatus ? 'publicado' : 'despublicado'} com sucesso.`,
      });
      fetchTrainings();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este treinamento?')) return;

    try {
      const { error } = await supabase.from('trainings').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Treinamento excluído',
        description: 'O treinamento foi removido com sucesso.',
      });
      fetchTrainings();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir o treinamento.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando treinamentos...</div>;
  }

  return (
    <Tabs defaultValue="list" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="list">Treinamentos</TabsTrigger>
        <TabsTrigger value="dashboard">
          <BarChart3 className="w-4 h-4 mr-2" />
          Dashboard
        </TabsTrigger>
      </TabsList>

      <TabsContent value="list" className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold mb-2">Gerenciar Treinamentos</h2>
            <p className="text-muted-foreground">Universidade Cresci e Perdi</p>
          </div>
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Novo Treinamento
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>Criar Novo Treinamento</DialogTitle>
                <DialogDescription>Adicione um novo curso à plataforma</DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                {/* ... keep existing code ... */}
              <div>
                <Label htmlFor="title">Título</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="Nome do treinamento"
                />
              </div>
              <div>
                <Label htmlFor="description">Descrição</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Descreva o conteúdo do treinamento"
                />
              </div>
              <div>
                <Label htmlFor="video_url">URL do Vídeo</Label>
                <Input
                  id="video_url"
                  value={formData.video_url}
                  onChange={(e) => setFormData({ ...formData, video_url: e.target.value })}
                  placeholder="https://youtube.com/watch?v=..."
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((cat) => (
                        <SelectItem key={cat.id} value={cat.slug}>
                          {cat.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="duration">Duração (min)</Label>
                  <Input
                    id="duration"
                    type="number"
                    value={formData.duration_minutes}
                    onChange={(e) => setFormData({ ...formData, duration_minutes: parseInt(e.target.value) })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="min_score">Nota Mínima (%)</Label>
                  <Input
                    id="min_score"
                    type="number"
                    min="0"
                    max="100"
                    value={formData.min_score}
                    onChange={(e) => setFormData({ ...formData, min_score: parseInt(e.target.value) })}
                  />
                </div>
                <div className="flex items-center space-x-2 pt-8">
                  <Checkbox
                    id="certificate"
                    checked={formData.certificate_enabled}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, certificate_enabled: checked as boolean })
                    }
                  />
                  <label
                    htmlFor="certificate"
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    Gerar certificado automático
                  </label>
                </div>
              </div>
              <div className="space-y-3">
                <Label>Cargos/Funções (deixe vazio para todos)</Label>
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="role-colaborador"
                      checked={formData.target_roles.includes('colaborador')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, target_roles: [...formData.target_roles, 'colaborador'] });
                        } else {
                          setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== 'colaborador') });
                        }
                      }}
                    />
                    <label htmlFor="role-colaborador" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Colaborador
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="role-gerente"
                      checked={formData.target_roles.includes('gerente')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, target_roles: [...formData.target_roles, 'gerente'] });
                        } else {
                          setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== 'gerente') });
                        }
                      }}
                    />
                    <label htmlFor="role-gerente" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Gerente
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="role-franqueado"
                      checked={formData.target_roles.includes('franqueado')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, target_roles: [...formData.target_roles, 'franqueado'] });
                        } else {
                          setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== 'franqueado') });
                        }
                      }}
                    />
                    <label htmlFor="role-franqueado" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Franqueado
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="role-gestor"
                      checked={formData.target_roles.includes('gestor_setor')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, target_roles: [...formData.target_roles, 'gestor_setor'] });
                        } else {
                          setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== 'gestor_setor') });
                        }
                      }}
                    />
                    <label htmlFor="role-gestor" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Gestor de Setor
                    </label>
                  </div>
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="role-admin"
                      checked={formData.target_roles.includes('admin')}
                      onCheckedChange={(checked) => {
                        if (checked) {
                          setFormData({ ...formData, target_roles: [...formData.target_roles, 'admin'] });
                        } else {
                          setFormData({ ...formData, target_roles: formData.target_roles.filter(r => r !== 'admin') });
                        }
                      }}
                    />
                    <label htmlFor="role-admin" className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70">
                      Administrador
                    </label>
                  </div>
                </div>
              </div>
              <Button onClick={handleCreate} className="w-full">
                Criar Treinamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {trainings.map((training) => (
          <Card key={training.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle>{training.title}</CardTitle>
                    <Badge variant={training.is_published ? 'default' : 'secondary'}>
                      {training.is_published ? 'Publicado' : 'Rascunho'}
                    </Badge>
                    {(() => {
                      const categoryInfo = getCategoryInfo(training.category);
                      return categoryInfo ? (
                        <Badge 
                          variant="outline"
                          style={{
                            backgroundColor: `${categoryInfo.color}20`,
                            borderColor: categoryInfo.color,
                            color: categoryInfo.color,
                          }}
                        >
                          {categoryInfo.name}
                        </Badge>
                      ) : (
                        <Badge variant="outline">{training.category}</Badge>
                      );
                    })()}
                    {training.target_roles && training.target_roles.length > 0 && (
                      <Badge variant="outline" className="bg-primary/10">
                        {training.target_roles.length} cargo(s)
                      </Badge>
                    )}
                  </div>
                  <CardDescription>{training.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => togglePublish(training.id, training.is_published)}
                  >
                    {training.is_published ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </Button>
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(training.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <span>Duração: {training.duration_minutes} min</span>
                  {training.video_url && <span>• Vídeo disponível</span>}
                </div>
                {training.target_roles && training.target_roles.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {training.target_roles.map((role: string) => (
                      <Badge key={role} variant="secondary" className="text-xs">
                        {role === 'colaborador' && 'Colaborador'}
                        {role === 'gerente' && 'Gerente'}
                        {role === 'franqueado' && 'Franqueado'}
                        {role === 'gestor_setor' && 'Gestor de Setor'}
                        {role === 'admin' && 'Admin'}
                      </Badge>
                    ))}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
      </TabsContent>

      <TabsContent value="dashboard">
        <TrainingDashboard />
      </TabsContent>
    </Tabs>
  );
}
