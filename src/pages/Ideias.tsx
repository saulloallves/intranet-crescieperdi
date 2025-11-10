import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Lightbulb, Plus, ThumbsUp, CheckCircle2, Clock, XCircle, Upload, MessageSquare, TrendingUp, CalendarClock } from 'lucide-react';

interface Idea {
  id: string;
  code: string;
  title: string;
  description: string;
  category: string;
  status: string;
  votes_count: number;
  media_urls: any;
  ai_category: string;
  feedback: string;
  created_at: string;
  submitted_by: string;
  target_audience?: 'colaboradores' | 'franqueados' | 'ambos';
  vote_start?: string;
  vote_end?: string;
  positive_votes?: number;
  negative_votes?: number;
  total_votes?: number;
  quorum?: number;
  profiles: {
    full_name: string;
    unit_code?: string;
  } | null;
}

interface UserVote {
  vote: boolean;
  comment?: string;
}

const MAX_DESCRIPTION_LENGTH = 500;

export default function Ideias() {
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [votedIdeas, setVotedIdeas] = useState<Set<string>>(new Set());
  const [userVotes, setUserVotes] = useState<Map<string, UserVote>>(new Map());
  const [dialogOpen, setDialogOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const { user } = useAuth();
  const { toast } = useToast();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [category, setCategory] = useState('operacao');
  const [targetAudience, setTargetAudience] = useState<'colaboradores' | 'franqueados' | 'ambos'>('ambos');
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [sortBy, setSortBy] = useState<'votes' | 'recent'>('votes');
  const [submitting, setSubmitting] = useState(false);
  const [activeTab, setActiveTab] = useState('em_votacao');
  const [voteComment, setVoteComment] = useState('');
  const [showCommentBox, setShowCommentBox] = useState<string | null>(null);

  useEffect(() => {
    fetchIdeas();
    fetchUserVotes();
  }, []);

  const fetchIdeas = async () => {
    try {
      const orderColumn = sortBy === 'votes' ? 'votes_count' : 'created_at';
      const { data, error } = await supabase
        .from('ideas')
        .select(`
          *,
          profiles!submitted_by (full_name, unit_code)
        `)
        .order(orderColumn, { ascending: false });

      if (error) throw error;
      setIdeas(data as any || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar ideias',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchIdeas();
  }, [sortBy]);

  const fetchUserVotes = async () => {
    if (!user) return;

    try {
      const { data } = await supabase
        .from('ideas_votes')
        .select('idea_id, vote, comment')
        .eq('user_id', user.id);

      if (data) {
        const votesMap = new Map(
          data.map((v) => [v.idea_id, { vote: v.vote, comment: v.comment }])
        );
        setUserVotes(votesMap);
        setVotedIdeas(new Set(data.map((vote) => vote.idea_id)));
      }
    } catch (error) {
      console.error('Error fetching votes:', error);
    }
  };

  const uploadMedia = async (files: File[]): Promise<string[]> => {
    const uploadedUrls: string[] = [];
    for (const file of files) {
      const fileName = `${user?.id}/${Date.now()}_${file.name}`;
      const { data, error } = await supabase.storage
        .from('ideas-media')
        .upload(fileName, file);

      if (!error && data) {
        const { data: { publicUrl } } = supabase.storage
          .from('ideas-media')
          .getPublicUrl(fileName);
        uploadedUrls.push(publicUrl);
      }
    }
    return uploadedUrls;
  };

  const handleSubmit = async () => {
    if (!title.trim() || !description.trim()) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Título e descrição são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    if (description.length > MAX_DESCRIPTION_LENGTH) {
      toast({
        title: 'Descrição muito longa',
        description: `A descrição deve ter no máximo ${MAX_DESCRIPTION_LENGTH} caracteres`,
        variant: 'destructive',
      });
      return;
    }

    setSubmitting(true);
    try {
      // Upload de mídia (se houver)
      const mediaUrls = mediaFiles.length > 0 ? await uploadMedia(mediaFiles) : [];

      // Classificar com IA
      let aiCategory = null;
      try {
        const { data: aiData } = await supabase.functions.invoke('classify-idea', {
          body: { title, description, category }
        });
        aiCategory = aiData?.ai_category;
      } catch (error) {
        console.error('Erro ao classificar com IA:', error);
      }

      // Get user profile to access unit_code
      const { data: profile } = await supabase
        .from('profiles')
        .select('unit_code')
        .eq('id', user?.id)
        .single();

      const { error } = await supabase.from('ideas').insert({
        title: title.trim(),
        description: description.trim(),
        category,
        target_audience: targetAudience,
        submitted_by: user?.id,
        media_urls: mediaUrls,
        ai_category: aiCategory,
        unit_code: profile?.unit_code || null,
        status: 'pending',
      });

      if (error) throw error;

      toast({
        title: 'Ideia enviada!',
        description: aiCategory 
          ? `Classificada como: ${aiCategory}` 
          : 'Sua sugestão foi registrada para análise',
      });

      setTitle('');
      setDescription('');
      setCategory('operacao');
      setTargetAudience('ambos');
      setMediaFiles([]);
      setDialogOpen(false);
      fetchIdeas();
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar ideia',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleVote = async (ideaId: string, vote: boolean) => {
    if (!user) return;

    try {
      const existingVote = userVotes.get(ideaId);

      if (existingVote) {
        // Atualizar voto existente
        const { error } = await supabase
          .from('ideas_votes')
          .update({ 
            vote, 
            comment: voteComment.trim() || null 
          })
          .eq('idea_id', ideaId)
          .eq('user_id', user.id);

        if (error) throw error;
      } else {
        // Criar novo voto
        const { error } = await supabase
          .from('ideas_votes')
          .insert({ 
            idea_id: ideaId, 
            user_id: user.id, 
            vote,
            comment: voteComment.trim() || null
          });

        if (error) throw error;
      }

      toast({
        title: 'Voto registrado!',
        description: `Você ${vote ? 'aprovou' : 'reprovou'} esta ideia.`,
      });

      setVoteComment('');
      setShowCommentBox(null);
      fetchIdeas();
      fetchUserVotes();
    } catch (error: any) {
      toast({
        title: 'Erro ao votar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle2 className="w-4 h-4" />;
      case 'pending':
        return <Clock className="w-4 h-4" />;
      case 'rejected':
        return <XCircle className="w-4 h-4" />;
      default:
        return <Clock className="w-4 h-4" />;
    }
  };

  const getStatusLabel = (status: string) => {
    const statuses: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
      pending: { label: 'Em análise', variant: 'secondary' },
      triagem: { label: 'Em análise', variant: 'secondary' },
      aprovada_para_votacao: { label: 'Aguardando votação', variant: 'outline' },
      em_votacao: { label: 'Em votação', variant: 'default' },
      encerrada: { label: 'Votação encerrada', variant: 'outline' },
      aprovada: { label: 'Aprovada', variant: 'default' },
      approved: { label: 'Aprovada', variant: 'default' },
      em_implementacao: { label: 'Em implementação', variant: 'default' },
      implementada: { label: 'Implementada', variant: 'default' },
      implemented: { label: 'Implementada', variant: 'default' },
      recusada: { label: 'Recusada', variant: 'destructive' },
      rejected: { label: 'Recusada', variant: 'destructive' },
    };
    return statuses[status] || statuses.pending;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="flex flex-col gap-4 mb-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold mb-2">Ideias e Sugestões</h1>
              <p className="text-muted-foreground">
                Contribua com melhorias para a rede
              </p>
            </div>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Nova Ideia
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Enviar Nova Ideia</DialogTitle>
                <DialogDescription>
                  Compartilhe sua sugestão de melhoria
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="title">Título *</Label>
                  <Input
                    id="title"
                    placeholder="Ex: Melhorar processo de avaliação"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label htmlFor="description">Descrição *</Label>
                    <span className="text-sm text-muted-foreground">
                      {description.length}/{MAX_DESCRIPTION_LENGTH}
                    </span>
                  </div>
                  <Textarea
                    id="description"
                    placeholder="Descreva sua ideia detalhadamente..."
                    rows={4}
                    value={description}
                    onChange={(e) => {
                      if (e.target.value.length <= MAX_DESCRIPTION_LENGTH) {
                        setDescription(e.target.value);
                      }
                    }}
                    maxLength={MAX_DESCRIPTION_LENGTH}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="category">Categoria</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="operacao">Operação</SelectItem>
                      <SelectItem value="atendimento">Atendimento</SelectItem>
                      <SelectItem value="visual">Comunicação Visual</SelectItem>
                      <SelectItem value="treinamento">Treinamento</SelectItem>
                      <SelectItem value="tecnologia">Tecnologia</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="media">Anexar Mídia (Opcional)</Label>
                  <Input
                    id="media"
                    type="file"
                    accept="image/*,video/*,.pdf"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setMediaFiles(files);
                    }}
                  />
                  {mediaFiles.length > 0 && (
                    <p className="text-sm text-muted-foreground">
                      {mediaFiles.length} arquivo(s) selecionado(s)
                    </p>
                  )}
                </div>
              </div>
              <div className="flex justify-end gap-3">
                <Button variant="outline" onClick={() => setDialogOpen(false)} disabled={submitting}>
                  Cancelar
                </Button>
                <Button onClick={handleSubmit} disabled={submitting}>
                  {submitting ? 'Enviando...' : 'Enviar Ideia'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
          </div>

          {/* Filtros de ordenação */}
          <Tabs value={sortBy} onValueChange={(v) => setSortBy(v as 'votes' | 'recent')} className="w-full">
            <TabsList className="grid w-full max-w-md grid-cols-2">
              <TabsTrigger value="votes" className="gap-2">
                <TrendingUp className="w-4 h-4" />
                Mais Votadas
              </TabsTrigger>
              <TabsTrigger value="recent" className="gap-2">
                <CalendarClock className="w-4 h-4" />
                Mais Recentes
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        {ideas.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Lightbulb className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Seja o primeiro a enviar uma ideia!
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {ideas.map((idea) => {
              const statusInfo = getStatusLabel(idea.status);
              return (
                <Card key={idea.id} className="card-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <Badge variant="outline">{idea.code}</Badge>
                          {idea.ai_category && (
                            <Badge variant="secondary" className="gap-1">
                              🤖 {idea.ai_category}
                            </Badge>
                          )}
                          <Badge variant="secondary">{idea.category}</Badge>
                          <Badge variant={statusInfo.variant} className="gap-1">
                            {getStatusIcon(idea.status)}
                            {statusInfo.label}
                          </Badge>
                        </div>
                        <CardTitle className="mb-2">{idea.title}</CardTitle>
                        <CardDescription>{idea.description}</CardDescription>
                        
                        {/* Mídia anexada */}
                        {Array.isArray(idea.media_urls) && idea.media_urls.length > 0 && (
                          <div className="grid grid-cols-2 gap-2 mt-4">
                            {idea.media_urls.map((url: string, idx: number) => (
                              <img
                                key={idx}
                                src={url}
                                alt={`Anexo ${idx + 1}`}
                                className="rounded-lg w-full h-32 object-cover"
                              />
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="w-12 h-12 rounded-full bg-pink-500/10 flex items-center justify-center">
                        <Lightbulb className="w-6 h-6 text-pink-600" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="flex items-center justify-between">
                      <p className="text-sm text-muted-foreground">
                        Por {idea.profiles?.full_name || 'Usuário'}
                      </p>
                    </div>

                    {/* Sistema de votação (apenas para ideias em votação) */}
                    {idea.status === 'em_votacao' && (
                      <div className="space-y-3">
                        <div className="flex items-center justify-between text-sm">
                          <span className="font-medium">Sua opinião:</span>
                          {idea.vote_end && (
                            <span className="text-muted-foreground flex items-center gap-1">
                              <CalendarClock className="w-4 h-4" />
                              Até {new Date(idea.vote_end).toLocaleDateString('pt-BR')}
                            </span>
                          )}
                        </div>

                        {userVotes.has(idea.id) ? (
                          <div className="p-3 bg-muted rounded-lg">
                            <p className="text-sm">
                              Você {userVotes.get(idea.id)?.vote ? '👍 aprovou' : '👎 reprovou'} esta ideia
                            </p>
                            {userVotes.get(idea.id)?.comment && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Comentário: {userVotes.get(idea.id)?.comment}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  if (showCommentBox === idea.id) {
                                    handleVote(idea.id, true);
                                  } else {
                                    setShowCommentBox(idea.id);
                                  }
                                }}
                              >
                                👍 Aprovar
                              </Button>
                              <Button
                                variant="outline"
                                className="flex-1"
                                onClick={() => {
                                  if (showCommentBox === idea.id) {
                                    handleVote(idea.id, false);
                                  } else {
                                    setShowCommentBox(idea.id);
                                  }
                                }}
                              >
                                👎 Reprovar
                              </Button>
                            </div>

                            {showCommentBox === idea.id && (
                              <div className="space-y-2">
                                <Textarea
                                  placeholder="Comentário opcional sobre sua avaliação..."
                                  value={voteComment}
                                  onChange={(e) => setVoteComment(e.target.value)}
                                  className="text-sm"
                                />
                              </div>
                            )}
                          </div>
                        )}

                        {/* Progresso da votação */}
                        {idea.total_votes !== undefined && idea.total_votes > 0 && (
                          <div className="space-y-1">
                            <div className="flex justify-between text-xs text-muted-foreground">
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
                              {idea.total_votes} voto{idea.total_votes !== 1 ? 's' : ''}
                            </p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* Feedback da curadoria */}
                    {idea.feedback && (
                      <Alert>
                        <MessageSquare className="h-4 w-4" />
                        <AlertTitle>Retorno da Curadoria</AlertTitle>
                        <AlertDescription>{idea.feedback}</AlertDescription>
                      </Alert>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
