import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, Clock, CheckCircle2, Rocket, Target } from 'lucide-react';
import { ApproveForVotingDialog } from './ApproveForVotingDialog';
import { StartImplementationDialog } from './StartImplementationDialog';
import { MarkAsImplementedDialog } from './MarkAsImplementedDialog';
import { IdeaCurationDialog } from './IdeaCurationDialog';
import { IdeasDashboard } from './IdeasDashboard';

interface Idea {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  votes_count: number;
  positive_votes?: number;
  negative_votes?: number;
  total_votes?: number;
  quorum?: number;
  vote_end?: string;
  created_at: string;
  submitted_by: string;
  profiles?: {
    full_name: string;
    unit_code?: string;
  };
}

export function AdminIdeiasNew() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('triagem');
  const { toast } = useToast();

  // Dialog states
  const [approveDialog, setApproveDialog] = useState<{ open: boolean; idea: Idea | null }>({ open: false, idea: null });
  const [startImplDialog, setStartImplDialog] = useState<{ open: boolean; idea: Idea | null }>({ open: false, idea: null });
  const [markImplDialog, setMarkImplDialog] = useState<{ open: boolean; idea: Idea | null }>({ open: false, idea: null });
  const [curationDialog, setCurationDialog] = useState<{ open: boolean; idea: Idea | null }>({ open: false, idea: null });

  const [stats, setStats] = useState({
    triagem: 0,
    em_votacao: 0,
    aprovadas: 0,
    em_implementacao: 0,
    implementadas: 0,
  });

  useEffect(() => {
    fetchIdeas();
  }, [activeTab]);

  const fetchIdeas = async () => {
    setLoading(true);
    try {
      let query = supabase
        .from('ideas')
        .select(`*, profiles!submitted_by(full_name, unit_code)`)
        .order('created_at', { ascending: false });

      // Filtrar por fase/tab
      if (activeTab === 'triagem') {
        query = query.in('status', ['pending', 'triagem']);
      } else if (activeTab === 'votacao') {
        query = query.eq('status', 'em_votacao');
      } else if (activeTab === 'aprovadas') {
        query = query.eq('status', 'aprovada');
      } else if (activeTab === 'implementacao') {
        query = query.eq('status', 'em_implementacao');
      } else if (activeTab === 'concluidas') {
        query = query.in('status', ['implementada', 'recusada']);
      } else if (activeTab === 'dashboard') {
        // Dashboard não precisa de filtro específico
        setLoading(false);
        return;
      }

      const { data, error } = await query;
      if (error) throw error;

      setIdeas((data as any) || []);

      // Calcular stats
      const allIdeas = await supabase.from('ideas').select('status');
      if (allIdeas.data) {
        setStats({
          triagem: allIdeas.data.filter(i => ['pending', 'triagem'].includes(i.status)).length,
          em_votacao: allIdeas.data.filter(i => i.status === 'em_votacao').length,
          aprovadas: allIdeas.data.filter(i => i.status === 'aprovada').length,
          em_implementacao: allIdeas.data.filter(i => i.status === 'em_implementacao').length,
          implementadas: allIdeas.data.filter(i => i.status === 'implementada').length,
        });
      }
    } catch (error) {
      console.error('Erro ao buscar ideias:', error);
      toast({
        title: 'Erro ao carregar ideias',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const renderIdeaCard = (idea: Idea) => (
    <Card key={idea.id} className="mb-4">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <Badge variant="outline">{idea.code}</Badge>
              <Badge>{idea.category}</Badge>
            </div>
            <CardTitle className="text-lg">{idea.title}</CardTitle>
            <CardDescription className="mt-2">{idea.description}</CardDescription>
            <div className="flex items-center gap-4 mt-3 text-sm text-muted-foreground">
              <span>Por: {idea.profiles?.full_name}</span>
              {idea.profiles?.unit_code && <span>Unidade: {idea.profiles.unit_code}</span>}
              <span>{new Date(idea.created_at).toLocaleDateString('pt-BR')}</span>
            </div>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {activeTab === 'triagem' && (
          <div className="flex gap-2">
            <Button onClick={() => setApproveDialog({ open: true, idea })}>
              Aprovar para Votação
            </Button>
            <Button variant="outline" onClick={() => setCurationDialog({ open: true, idea })}>
              Curar / Recusar
            </Button>
          </div>
        )}

        {activeTab === 'votacao' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span>Progresso da votação:</span>
              <span className="font-medium">
                {idea.vote_end ? `Encerra em ${new Date(idea.vote_end).toLocaleDateString('pt-BR')}` : 'Sem prazo'}
              </span>
            </div>
            {idea.total_votes !== undefined && (
              <div className="space-y-1">
                <div className="flex justify-between text-xs">
                  <span>👍 {idea.positive_votes || 0} ({idea.total_votes > 0 ? ((idea.positive_votes || 0) / idea.total_votes * 100).toFixed(0) : 0}%)</span>
                  <span>👎 {idea.negative_votes || 0} ({idea.total_votes > 0 ? ((idea.negative_votes || 0) / idea.total_votes * 100).toFixed(0) : 0}%)</span>
                </div>
                <div className="h-2 bg-muted rounded-full overflow-hidden flex">
                  <div 
                    className="bg-green-500" 
                    style={{ width: `${idea.total_votes > 0 ? (idea.positive_votes || 0) / idea.total_votes * 100 : 0}%` }}
                  />
                  <div 
                    className="bg-red-500" 
                    style={{ width: `${idea.total_votes > 0 ? (idea.negative_votes || 0) / idea.total_votes * 100 : 0}%` }}
                  />
                </div>
                <p className="text-xs text-center text-muted-foreground">
                  {idea.total_votes || 0} votos
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'aprovadas' && (
          <Button onClick={() => setStartImplDialog({ open: true, idea })}>
            <Rocket className="w-4 h-4 mr-2" />
            Iniciar Implementação
          </Button>
        )}

        {activeTab === 'implementacao' && (
          <Button onClick={() => setMarkImplDialog({ open: true, idea })}>
            <CheckCircle2 className="w-4 h-4 mr-2" />
            Marcar como Implementada
          </Button>
        )}

        {activeTab === 'concluidas' && idea.quorum !== undefined && (
          <div className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Resultado:</span>
            <Badge variant={idea.status === 'implementada' ? 'default' : 'destructive'}>
              {idea.status === 'implementada' ? `Implementada (${idea.quorum.toFixed(1)}% aprovação)` : 'Recusada'}
            </Badge>
          </div>
        )}
      </CardContent>
    </Card>
  );

  if (loading && activeTab !== 'dashboard') {
    return <div className="flex items-center justify-center py-12">Carregando ideias...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Gestão de Ideias e Sugestões</h2>
        <p className="text-muted-foreground">Curadoria completa do canal de inovação colaborativa</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="triagem" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Triagem
            {stats.triagem > 0 && <Badge variant="secondary" className="ml-1">{stats.triagem}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="votacao" className="flex items-center gap-2">
            <Target className="w-4 h-4" />
            Votação
            {stats.em_votacao > 0 && <Badge variant="secondary" className="ml-1">{stats.em_votacao}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="aprovadas" className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4" />
            Aprovadas
            {stats.aprovadas > 0 && <Badge variant="secondary" className="ml-1">{stats.aprovadas}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="implementacao" className="flex items-center gap-2">
            <Rocket className="w-4 h-4" />
            Implementação
            {stats.em_implementacao > 0 && <Badge variant="secondary" className="ml-1">{stats.em_implementacao}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="concluidas">
            Concluídas
            {stats.implementadas > 0 && <Badge variant="secondary" className="ml-1">{stats.implementadas}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="dashboard" className="flex items-center gap-2">
            <Lightbulb className="w-4 h-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="triagem" className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ideias Aguardando Triagem</h3>
            <p className="text-sm text-muted-foreground">Analise e aprove ideias para votação pública</p>
          </div>
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma ideia pendente de triagem
              </CardContent>
            </Card>
          ) : (
            ideas.map(renderIdeaCard)
          )}
        </TabsContent>

        <TabsContent value="votacao" className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ideias em Votação Ativa</h3>
            <p className="text-sm text-muted-foreground">Acompanhe o progresso das votações</p>
          </div>
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma votação ativa no momento
              </CardContent>
            </Card>
          ) : (
            ideas.map(renderIdeaCard)
          )}
        </TabsContent>

        <TabsContent value="aprovadas" className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ideias Aprovadas pela Comunidade</h3>
            <p className="text-sm text-muted-foreground">Defina responsável e prazo para implementação</p>
          </div>
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma ideia aprovada aguardando implementação
              </CardContent>
            </Card>
          ) : (
            ideas.map(renderIdeaCard)
          )}
        </TabsContent>

        <TabsContent value="implementacao" className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ideias em Implementação</h3>
            <p className="text-sm text-muted-foreground">Marque como implementada quando concluído</p>
          </div>
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma ideia em implementação
              </CardContent>
            </Card>
          ) : (
            ideas.map(renderIdeaCard)
          )}
        </TabsContent>

        <TabsContent value="concluidas" className="mt-6">
          <div className="mb-4">
            <h3 className="text-lg font-semibold">Ideias Finalizadas</h3>
            <p className="text-sm text-muted-foreground">Histórico de ideias implementadas e recusadas</p>
          </div>
          {ideas.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                Nenhuma ideia finalizada ainda
              </CardContent>
            </Card>
          ) : (
            ideas.map(renderIdeaCard)
          )}
        </TabsContent>

        <TabsContent value="dashboard" className="mt-6">
          <IdeasDashboard />
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <ApproveForVotingDialog
        idea={approveDialog.idea}
        open={approveDialog.open}
        onOpenChange={(open) => setApproveDialog({ ...approveDialog, open })}
        onSuccess={fetchIdeas}
      />

      <StartImplementationDialog
        idea={startImplDialog.idea}
        open={startImplDialog.open}
        onOpenChange={(open) => setStartImplDialog({ ...startImplDialog, open })}
        onSuccess={fetchIdeas}
      />

      <MarkAsImplementedDialog
        idea={markImplDialog.idea}
        open={markImplDialog.open}
        onOpenChange={(open) => setMarkImplDialog({ ...markImplDialog, open })}
        onSuccess={fetchIdeas}
      />

      <IdeaCurationDialog
        idea={curationDialog.idea}
        open={curationDialog.open}
        onOpenChange={(open) => setCurationDialog({ ...curationDialog, open })}
        onSuccess={fetchIdeas}
      />
    </div>
  );
}
