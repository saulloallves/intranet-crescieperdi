import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, ThumbsUp, CheckCircle2, Clock, CheckCheck, MessageSquare, XCircle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { IdeaCurationDialog } from './IdeaCurationDialog';

interface Idea {
  id: string;
  title: string;
  description: string;
  category: string;
  status: string;
  votes_count: number;
  created_at: string;
}

export function AdminIdeias() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [curationDialog, setCurationDialog] = useState<{ open: boolean; idea: Idea | null }>({
    open: false,
    idea: null,
  });
  const [stats, setStats] = useState({
    total: 0,
    pending: 0,
    approved: 0,
    rejected: 0,
    implemented: 0,
  });
  const { toast } = useToast();

  useEffect(() => {
    fetchIdeas();
  }, [statusFilter, categoryFilter]);

  const fetchIdeas = async () => {
    try {
      let query = supabase
        .from('ideas')
        .select('*')
        .order('votes_count', { ascending: false });

      if (statusFilter !== 'all') {
        query = query.eq('status', statusFilter);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      const ideasData = data || [];
      setIdeas(ideasData);

      // Calculate stats
      const allIdeas = await supabase.from('ideas').select('status');
      if (allIdeas.data) {
        setStats({
          total: allIdeas.data.length,
          pending: allIdeas.data.filter(i => i.status === 'pending').length,
          approved: allIdeas.data.filter(i => i.status === 'approved').length,
          rejected: allIdeas.data.filter(i => i.status === 'rejected').length,
          implemented: allIdeas.data.filter(i => i.status === 'implemented').length,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar ideias:', error);
    } finally {
      setLoading(false);
    }
  };

  const updateStatus = async (id: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('ideas')
        .update({ status: newStatus })
        .eq('id', id);

      if (error) throw error;

      toast({
        title: 'Status atualizado',
        description: `Ideia ${newStatus === 'approved' ? 'aprovada' : 'recusada'} com sucesso.`,
      });
      fetchIdeas();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, 'default' | 'secondary' | 'destructive' | 'outline'> = {
      pending: 'secondary',
      approved: 'default',
      rejected: 'destructive',
      implemented: 'outline',
    };
    const labels: Record<string, string> = {
      pending: 'Pendente',
      approved: 'Aprovada',
      rejected: 'Recusada',
      implemented: 'Implementada',
    };
    return <Badge variant={variants[status] || 'outline'}>{labels[status] || status}</Badge>;
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando ideias...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Gerenciar Ideias e Sugestões</h2>
        <p className="text-muted-foreground">Curadoria do canal de inovação colaborativa</p>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Lightbulb className="w-4 h-4" />
              Total
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.total}</div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pendentes
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.pending}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4" />
              Aprovadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.approved}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCheck className="w-4 h-4" />
              Implementadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.implemented}</div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <XCircle className="w-4 h-4" />
              Recusadas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{stats.rejected}</div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filtros</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos</SelectItem>
                  <SelectItem value="pending">Pendentes</SelectItem>
                  <SelectItem value="approved">Aprovadas</SelectItem>
                  <SelectItem value="implemented">Implementadas</SelectItem>
                  <SelectItem value="rejected">Recusadas</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex-1">
              <label className="text-sm font-medium mb-2 block">Categoria</label>
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Filtrar por categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="processo">Processo</SelectItem>
                  <SelectItem value="tecnologia">Tecnologia</SelectItem>
                  <SelectItem value="produto">Produto</SelectItem>
                  <SelectItem value="ambiente">Ambiente</SelectItem>
                  <SelectItem value="outro">Outro</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Ideas List */}
      <div className="grid gap-4">
        {ideas.map((idea) => (
          <Card key={idea.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2 flex-wrap">
                    <Lightbulb className="w-5 h-5" />
                    <CardTitle>{idea.title}</CardTitle>
                    {getStatusBadge(idea.status)}
                    <Badge variant="outline">{idea.category}</Badge>
                  </div>
                  <CardDescription>{idea.description}</CardDescription>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {(idea.status === 'pending' || idea.status === 'pendente') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurationDialog({ open: true, idea })}
                      className="gap-2"
                    >
                      <MessageSquare className="w-4 h-4" />
                      Curar
                    </Button>
                  )}
                  {(idea.status === 'approved' || idea.status === 'aprovada') && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => updateStatus(idea.id, 'implementada')}
                      className="gap-2"
                    >
                      <CheckCheck className="w-4 h-4" />
                      Marcar como Implementada
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <ThumbsUp className="w-4 h-4" />
                <span>{idea.votes_count} votos</span>
              </div>
            </CardContent>
          </Card>
        ))}
        
        {curationDialog.idea && (
          <IdeaCurationDialog
            idea={curationDialog.idea}
            open={curationDialog.open}
            onOpenChange={(open) => setCurationDialog({ open, idea: null })}
            onSuccess={fetchIdeas}
          />
        )}

        {ideas.length === 0 && !loading && (
          <Card>
            <CardContent className="py-12 text-center">
              <Lightbulb className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">Nenhuma ideia encontrada com os filtros selecionados.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
