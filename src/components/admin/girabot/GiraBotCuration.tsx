import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Plus,
  Edit,
  Trash2,
  Check,
  X,
  BookOpen,
  MessageSquare,
  RefreshCw,
  TrendingUp
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface FAQ {
  id: string;
  question: string;
  answer: string;
  category: string;
  module: string | null;
  priority: number;
  is_active: boolean;
  usage_count: number;
  created_at: string;
  updated_at: string;
}

const CATEGORIES = [
  'Geral',
  'Feed',
  'Treinamentos',
  'Mural',
  'Ideias',
  'Checklists',
  'Campanhas',
  'Reconhecimento'
];

const MODULES = [
  'feed',
  'treinamentos',
  'mural',
  'ideias',
  'checklists',
  'campanhas',
  'reconhecimento'
];

export function GiraBotCuration() {
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingFaq, setEditingFaq] = useState<FAQ | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const { profile } = useAuth();

  const [formData, setFormData] = useState({
    question: '',
    answer: '',
    category: 'Geral',
    module: '',
    priority: 0,
    is_active: true
  });

  useEffect(() => {
    fetchFAQs();
  }, [filterCategory]);

  const fetchFAQs = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('girabot_faqs')
        .select('*')
        .order('priority', { ascending: false })
        .order('usage_count', { ascending: false });

      if (filterCategory !== 'all') {
        query = query.eq('category', filterCategory);
      }

      const { data, error } = await query;

      if (error) throw error;
      setFaqs(data || []);
    } catch (error: any) {
      console.error('Error fetching FAQs:', error);
      toast({
        title: 'Erro ao carregar FAQs',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      if (editingFaq) {
        const { error } = await supabase
          .from('girabot_faqs')
          .update({
            ...formData,
            module: formData.module || null
          })
          .eq('id', editingFaq.id);

        if (error) throw error;

        toast({
          title: 'FAQ atualizado com sucesso',
          description: 'As alterações foram salvas.'
        });
      } else {
        const { error } = await supabase
          .from('girabot_faqs')
          .insert({
            ...formData,
            module: formData.module || null,
            created_by: profile?.id
          });

        if (error) throw error;

        toast({
          title: 'FAQ criado com sucesso',
          description: 'O novo FAQ foi adicionado à base de conhecimento.'
        });
      }

      setIsDialogOpen(false);
      resetForm();
      fetchFAQs();
    } catch (error: any) {
      console.error('Error saving FAQ:', error);
      toast({
        title: 'Erro ao salvar FAQ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleToggleActive = async (faq: FAQ) => {
    try {
      const { error } = await supabase
        .from('girabot_faqs')
        .update({ is_active: !faq.is_active })
        .eq('id', faq.id);

      if (error) throw error;

      toast({
        title: faq.is_active ? 'FAQ desativado' : 'FAQ ativado',
        description: `O FAQ foi ${faq.is_active ? 'desativado' : 'ativado'} com sucesso.`
      });

      fetchFAQs();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar FAQ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este FAQ?')) return;

    try {
      const { error } = await supabase
        .from('girabot_faqs')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'FAQ excluído',
        description: 'O FAQ foi removido da base de conhecimento.'
      });

      fetchFAQs();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir FAQ',
        description: error.message,
        variant: 'destructive'
      });
    }
  };

  const resetForm = () => {
    setFormData({
      question: '',
      answer: '',
      category: 'Geral',
      module: '',
      priority: 0,
      is_active: true
    });
    setEditingFaq(null);
  };

  const openEditDialog = (faq: FAQ) => {
    setEditingFaq(faq);
    setFormData({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      module: faq.module || '',
      priority: faq.priority,
      is_active: faq.is_active
    });
    setIsDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-2xl font-bold">Curadoria de Conteúdo</h3>
          <p className="text-muted-foreground">Gerencie a base de conhecimento do GiraBot</p>
        </div>
        <div className="flex gap-2">
          <Select value={filterCategory} onValueChange={setFilterCategory}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Filtrar categoria" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas Categorias</SelectItem>
              {CATEGORIES.map(cat => (
                <SelectItem key={cat} value={cat}>{cat}</SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="w-4 h-4 mr-2" />
                Novo FAQ
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>
                  {editingFaq ? 'Editar FAQ' : 'Novo FAQ'}
                </DialogTitle>
                <DialogDescription>
                  {editingFaq
                    ? 'Atualize as informações do FAQ'
                    : 'Adicione um novo FAQ à base de conhecimento'}
                </DialogDescription>
              </DialogHeader>

              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="question">Pergunta</Label>
                  <Input
                    id="question"
                    value={formData.question}
                    onChange={(e) => setFormData({ ...formData, question: e.target.value })}
                    placeholder="Como usar o módulo de Feed?"
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="answer">Resposta</Label>
                  <Textarea
                    id="answer"
                    value={formData.answer}
                    onChange={(e) => setFormData({ ...formData, answer: e.target.value })}
                    placeholder="O Feed é um módulo que permite..."
                    rows={6}
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="category">Categoria</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(value) => setFormData({ ...formData, category: value })}
                    >
                      <SelectTrigger id="category">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIES.map(cat => (
                          <SelectItem key={cat} value={cat}>{cat}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="module">Módulo (opcional)</Label>
                    <Select
                      value={formData.module}
                      onValueChange={(value) => setFormData({ ...formData, module: value })}
                    >
                      <SelectTrigger id="module">
                        <SelectValue placeholder="Nenhum" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhum</SelectItem>
                        {MODULES.map(mod => (
                          <SelectItem key={mod} value={mod}>{mod}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="priority">Prioridade</Label>
                    <Input
                      id="priority"
                      type="number"
                      value={formData.priority}
                      onChange={(e) => setFormData({ ...formData, priority: parseInt(e.target.value) || 0 })}
                      min="0"
                      max="10"
                    />
                  </div>

                  <div className="flex items-center justify-between pt-8">
                    <Label htmlFor="is_active">Ativo</Label>
                    <Switch
                      id="is_active"
                      checked={formData.is_active}
                      onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                    />
                  </div>
                </div>

                <div className="flex justify-end gap-2 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      setIsDialogOpen(false);
                      resetForm();
                    }}
                  >
                    Cancelar
                  </Button>
                  <Button type="submit">
                    <Check className="w-4 h-4 mr-2" />
                    Salvar
                  </Button>
                </div>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* FAQ Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total de FAQs</CardDescription>
              <BookOpen className="w-4 h-4 text-blue-500" />
            </div>
            <CardTitle className="text-3xl text-blue-500">{faqs.length}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>FAQs Ativos</CardDescription>
              <Check className="w-4 h-4 text-green-500" />
            </div>
            <CardTitle className="text-3xl text-green-500">
              {faqs.filter(f => f.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Usos Totais</CardDescription>
              <TrendingUp className="w-4 h-4 text-purple-500" />
            </div>
            <CardTitle className="text-3xl text-purple-500">
              {faqs.reduce((sum, f) => sum + f.usage_count, 0)}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* FAQ List */}
      <div className="grid gap-4">
        {faqs.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum FAQ encontrado. Crie o primeiro FAQ para começar.
              </p>
            </CardContent>
          </Card>
        ) : (
          faqs.map((faq) => (
            <Card key={faq.id} className={!faq.is_active ? 'opacity-60' : ''}>
              <CardHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge>{faq.category}</Badge>
                      {faq.module && <Badge variant="outline">{faq.module}</Badge>}
                      {faq.priority > 0 && (
                        <Badge variant="secondary">Prioridade: {faq.priority}</Badge>
                      )}
                      <Badge variant={faq.is_active ? 'default' : 'secondary'}>
                        {faq.is_active ? 'Ativo' : 'Inativo'}
                      </Badge>
                      <Badge variant="outline">
                        <TrendingUp className="w-3 h-3 mr-1" />
                        {faq.usage_count} usos
                      </Badge>
                    </div>
                    <CardTitle className="text-lg">{faq.question}</CardTitle>
                    <CardDescription className="text-sm whitespace-pre-wrap">
                      {faq.answer}
                    </CardDescription>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleToggleActive(faq)}
                      title={faq.is_active ? 'Desativar' : 'Ativar'}
                    >
                      {faq.is_active ? (
                        <X className="w-4 h-4" />
                      ) : (
                        <Check className="w-4 h-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => openEditDialog(faq)}
                    >
                      <Edit className="w-4 h-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDelete(faq.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
