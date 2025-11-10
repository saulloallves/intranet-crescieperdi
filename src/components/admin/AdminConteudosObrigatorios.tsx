import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { useToast } from '@/hooks/use-toast';
import { Plus, Video, FileText, Edit, Trash2, Users, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

export function AdminConteudosObrigatorios() {
  const { user } = useAuth();
  const { toast } = useToast();

  const [contents, setContents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<any>(null);
  const [generating, setGenerating] = useState(false);

  const [formData, setFormData] = useState({
    title: '',
    type: 'text',
    content_url: '',
    content_text: '',
    target_audience: 'ambos',
    active: true,
    quiz_questions: null as any,
  });

  useEffect(() => {
    fetchContents();
  }, []);

  const fetchContents = async () => {
    try {
      const { data, error } = await supabase
        .from('mandatory_contents')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setContents(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!formData.content_text) {
      toast({
        title: 'Texto vazio',
        description: 'Preencha o conteúdo textual antes de gerar o quiz.',
        variant: 'destructive',
      });
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-quiz-questions', {
        body: { contentText: formData.content_text, numQuestions: 3 }
      });

      if (error) throw error;

      setFormData({ ...formData, quiz_questions: { questions: data.questions } });
      
      toast({
        title: 'Quiz gerado!',
        description: `${data.questions.length} perguntas criadas automaticamente.`,
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar quiz',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setGenerating(false);
    }
  };

  const handleSave = async () => {
    try {
      const payload = {
        ...formData,
        quiz_questions: formData.type === 'text' ? formData.quiz_questions : null,
        created_by: user?.id,
      };

      if (editingContent) {
        const { error } = await supabase
          .from('mandatory_contents')
          .update(payload)
          .eq('id', editingContent.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('mandatory_contents')
          .insert(payload);

        if (error) throw error;
      }

      toast({
        title: editingContent ? 'Conteúdo atualizado!' : 'Conteúdo criado!',
      });

      setDialogOpen(false);
      resetForm();
      fetchContents();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este conteúdo?')) return;

    try {
      const { error } = await supabase
        .from('mandatory_contents')
        .delete()
        .eq('id', id);

      if (error) throw error;

      toast({ title: 'Conteúdo excluído!' });
      fetchContents();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const resetForm = () => {
    setFormData({
      title: '',
      type: 'text',
      content_url: '',
      content_text: '',
      target_audience: 'ambos',
      active: true,
      quiz_questions: null,
    });
    setEditingContent(null);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Conteúdos Obrigatórios</h2>
          <p className="text-muted-foreground">Gerencie vídeos e textos obrigatórios com confirmação de leitura</p>
        </div>
        <Button onClick={() => setDialogOpen(true)}>
          <Plus className="w-4 h-4 mr-2" />
          Novo Conteúdo
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdos Cadastrados</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8">
              <Loader2 className="w-8 h-8 animate-spin mx-auto" />
            </div>
          ) : contents.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">Nenhum conteúdo cadastrado</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Título</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Público</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {contents.map((content) => (
                  <TableRow key={content.id}>
                    <TableCell className="font-medium">{content.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {content.type === 'video' ? (
                          <><Video className="w-3 h-3 mr-1" /> Vídeo</>
                        ) : (
                          <><FileText className="w-3 h-3 mr-1" /> Texto</>
                        )}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        <Users className="w-3 h-3 mr-1" />
                        {content.target_audience === 'ambos' ? 'Todos' : content.target_audience}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {content.active ? (
                        <Badge variant="default">
                          <CheckCircle className="w-3 h-3 mr-1" /> Ativo
                        </Badge>
                      ) : (
                        <Badge variant="secondary">
                          <XCircle className="w-3 h-3 mr-1" /> Inativo
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingContent(content);
                          setFormData(content);
                          setDialogOpen(true);
                        }}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDelete(content.id)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={dialogOpen} onOpenChange={(open) => {
        setDialogOpen(open);
        if (!open) resetForm();
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingContent ? 'Editar Conteúdo' : 'Novo Conteúdo Obrigatório'}</DialogTitle>
            <DialogDescription>
              Configure vídeo ou texto obrigatório com confirmação de leitura
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div>
              <Label>Título *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="Ex: Treinamento LGPD 2025"
              />
            </div>

            <div>
              <Label>Tipo de Conteúdo *</Label>
              <Select value={formData.type} onValueChange={(value) => setFormData({ ...formData, type: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="video">
                    <div className="flex items-center gap-2">
                      <Video className="w-4 h-4" />
                      Vídeo
                    </div>
                  </SelectItem>
                  <SelectItem value="text">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4" />
                      Texto
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {formData.type === 'video' && (
              <div>
                <Label>URL do Vídeo *</Label>
                <Input
                  type="url"
                  value={formData.content_url}
                  onChange={(e) => setFormData({ ...formData, content_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>
            )}

            {formData.type === 'text' && (
              <>
                <div>
                  <Label>Conteúdo Textual *</Label>
                  <Textarea
                    value={formData.content_text}
                    onChange={(e) => setFormData({ ...formData, content_text: e.target.value })}
                    placeholder="Conteúdo do texto obrigatório..."
                    rows={10}
                  />
                </div>

                <Button
                  variant="outline"
                  onClick={handleGenerateQuiz}
                  disabled={generating || !formData.content_text}
                  className="w-full"
                >
                  {generating ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Gerando Quiz...
                    </>
                  ) : (
                    '🤖 Gerar Quiz Automático (IA)'
                  )}
                </Button>

                {formData.quiz_questions && (
                  <div className="p-4 border rounded-lg bg-muted/30">
                    <p className="text-sm font-semibold mb-2">
                      ✅ Quiz gerado: {formData.quiz_questions.questions?.length || 0} perguntas
                    </p>
                  </div>
                )}
              </>
            )}

            <div>
              <Label>Público-alvo *</Label>
              <Select value={formData.target_audience} onValueChange={(value) => setFormData({ ...formData, target_audience: value })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="colaboradores">Colaboradores</SelectItem>
                  <SelectItem value="franqueados">Franqueados</SelectItem>
                  <SelectItem value="ambos">Ambos</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex items-center justify-between">
              <Label>Ativo</Label>
              <Switch
                checked={formData.active}
                onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button variant="outline" onClick={() => {
                setDialogOpen(false);
                resetForm();
              }}>
                Cancelar
              </Button>
              <Button onClick={handleSave} disabled={!formData.title || (formData.type === 'video' && !formData.content_url) || (formData.type === 'text' && !formData.content_text)}>
                {editingContent ? 'Atualizar' : 'Criar'}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
