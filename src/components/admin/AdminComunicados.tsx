import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Plus, Trash2, Edit, Eye, Send } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Announcement {
  id: string;
  title: string;
  content: string;
  is_published: boolean;
  views_count: number;
  likes_count: number;
  created_at: string;
}

export function AdminComunicados() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [targetRole, setTargetRole] = useState('all');

  useEffect(() => {
    fetchAnnouncements();
  }, []);

  const fetchAnnouncements = async () => {
    try {
      const { data, error } = await supabase
        .from('announcements')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setAnnouncements(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar comunicados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!title.trim() || !content.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e conteúdo são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    type UserRole = 'admin' | 'colaborador' | 'franqueado' | 'gerente' | 'gestor_setor';

    try {
      const { error } = await supabase.from('announcements').insert([{
        title: title.trim(),
        content: content.trim(),
        author_id: user?.id,
        target_roles: targetRole === 'all' ? null : [targetRole as UserRole],
        is_published: true,
        published_at: new Date().toISOString(),
      }]);

      if (error) throw error;

      toast({
        title: 'Sucesso!',
        description: 'Comunicado criado e publicado',
      });

      setTitle('');
      setContent('');
      setTargetRole('all');
      setDialogOpen(false);
      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao criar comunicado',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este comunicado?')) return;

    try {
      const { error } = await supabase
        .from('announcements')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Comunicado excluído',
      });

      fetchAnnouncements();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando...</div>;
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <div>
          <h2 className="text-2xl font-bold">Gerenciar Comunicados</h2>
          <p className="text-muted-foreground">Crie e gerencie comunicados para a equipe</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="w-4 h-4 mr-2" />
              Novo Comunicado
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Criar Novo Comunicado</DialogTitle>
              <DialogDescription>
                Preencha as informações abaixo para criar um comunicado
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="title">Título *</Label>
                <Input
                  id="title"
                  placeholder="Ex: Nova política de horários"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="content">Conteúdo *</Label>
                <Textarea
                  id="content"
                  placeholder="Escreva o conteúdo do comunicado..."
                  rows={6}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="target">Público-alvo</Label>
                <Select value={targetRole} onValueChange={setTargetRole}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos</SelectItem>
                    <SelectItem value="colaborador">Colaboradores</SelectItem>
                    <SelectItem value="gerente">Gerentes</SelectItem>
                    <SelectItem value="franqueado">Franqueados</SelectItem>
                    <SelectItem value="gestor_setor">Gestores de Setor</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancelar
              </Button>
              <Button onClick={handleCreateAnnouncement}>
                <Send className="w-4 h-4 mr-2" />
                Publicar Agora
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-4">
        {announcements.map((announcement) => (
          <Card key={announcement.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle>{announcement.title}</CardTitle>
                  <CardDescription>
                    Publicado {formatDistanceToNow(new Date(announcement.created_at), {
                      addSuffix: true,
                      locale: ptBR,
                    })}
                  </CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="ghost" size="icon" onClick={() => handleDelete(announcement.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                {announcement.content}
              </p>
              <div className="flex gap-4 text-sm text-muted-foreground">
                <div className="flex items-center gap-1">
                  <Eye className="w-4 h-4" />
                  {announcement.views_count} visualizações
                </div>
                <div className="flex items-center gap-1">
                  ❤️ {announcement.likes_count} curtidas
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
