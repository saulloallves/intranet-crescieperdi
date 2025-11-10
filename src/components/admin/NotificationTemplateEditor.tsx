import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import {
  Plus,
  Edit,
  Trash2,
  Eye,
  Send,
  Save,
  X,
  MessageSquare,
  Mail,
  Smartphone,
  Info,
} from 'lucide-react';

interface Template {
  id: string;
  title: string;
  message_template: string;
  channel: string;
  variables: any;
  active: boolean;
  created_at: string;
  created_by?: string;
  updated_at?: string;
}

interface PreviewData {
  title: string;
  message: string;
}

export function NotificationTemplateEditor() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewData | null>(null);
  const [testUserId, setTestUserId] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('notification_templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar templates',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTemplate = async (template: Partial<Template>) => {
    try {
      if (editingTemplate?.id) {
        // Atualizar
        const { error } = await supabase
          .from('notification_templates')
          .update({
            title: template.title,
            message_template: template.message_template,
            channel: template.channel,
            active: template.active,
          })
          .eq('id', editingTemplate.id);

        if (error) throw error;
        
        toast({
          title: 'Template atualizado',
          description: 'O template foi atualizado com sucesso.',
        });
      } else {
        // Criar
        const { error } = await supabase
          .from('notification_templates')
          .insert({
            title: template.title || '',
            message_template: template.message_template || '',
            channel: template.channel || 'push',
            active: template.active ?? true,
          });

        if (error) throw error;
        
        toast({
          title: 'Template criado',
          description: 'O template foi criado com sucesso.',
        });
      }

      setIsDialogOpen(false);
      setEditingTemplate(null);
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar template',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleDeleteTemplate = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este template?')) return;

    try {
      const { error } = await supabase
        .from('notification_templates')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      toast({
        title: 'Template excluído',
        description: 'O template foi excluído com sucesso.',
      });
      
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: 'Erro ao excluir template',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleToggleActive = async (id: string, active: boolean) => {
    try {
      const { error } = await supabase
        .from('notification_templates')
        .update({ active: !active })
        .eq('id', id);

      if (error) throw error;
      
      fetchTemplates();
    } catch (error: any) {
      toast({
        title: 'Erro ao atualizar status',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handlePreview = async (template: Template) => {
    try {
      const { data, error } = await supabase.functions.invoke('process-notification-template', {
        body: {
          template_id: template.id,
          variables: {
            nome: 'João Silva',
            unidade: 'São Paulo - Centro',
            cargo: 'Gerente',
          },
        },
      });

      if (error) throw error;
      
      setPreviewData(data.processed);
    } catch (error: any) {
      toast({
        title: 'Erro ao gerar preview',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const handleTestSend = async (template: Template) => {
    if (!testUserId) {
      toast({
        title: 'ID do usuário necessário',
        description: 'Informe o ID de um usuário para enviar o teste.',
        variant: 'destructive',
      });
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('send-notification-advanced', {
        body: {
          user_ids: [testUserId],
          template_id: template.id,
          type: 'system',
          channel: template.channel,
          variables: {
            nome: 'Teste',
            unidade: 'Teste',
          },
        },
      });

      if (error) throw error;
      
      toast({
        title: 'Teste enviado',
        description: 'A notificação de teste foi enviada com sucesso.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao enviar teste',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  const getChannelIcon = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return <MessageSquare className="w-4 h-4" />;
      case 'email':
        return <Mail className="w-4 h-4" />;
      default:
        return <Smartphone className="w-4 h-4" />;
    }
  };

  const getChannelLabel = (channel: string) => {
    switch (channel) {
      case 'whatsapp':
        return 'WhatsApp';
      case 'email':
        return 'E-mail';
      default:
        return 'Push';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Templates de Notificação</h2>
          <p className="text-muted-foreground">
            Crie e gerencie templates reutilizáveis com variáveis dinâmicas
          </p>
        </div>
        <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => setEditingTemplate(null)}>
              <Plus className="w-4 h-4 mr-2" />
              Novo Template
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <TemplateForm
              template={editingTemplate}
              onSave={handleSaveTemplate}
              onCancel={() => {
                setIsDialogOpen(false);
                setEditingTemplate(null);
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Info sobre variáveis */}
      <Card className="border-blue-200 bg-blue-50/50">
        <CardContent className="pt-4">
          <div className="flex items-start gap-3">
            <Info className="w-5 h-5 text-blue-600 mt-0.5" />
            <div className="space-y-1">
              <div className="font-medium text-sm text-blue-900">Variáveis Disponíveis</div>
              <div className="text-sm text-blue-700">
                Use <code className="px-1.5 py-0.5 bg-blue-100 rounded">{'{{nome}}'}</code>,{' '}
                <code className="px-1.5 py-0.5 bg-blue-100 rounded">{'{{unidade}}'}</code>,{' '}
                <code className="px-1.5 py-0.5 bg-blue-100 rounded">{'{{cargo}}'}</code> para
                personalização automática
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Lista de Templates */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {templates.map(template => (
          <Card key={template.id} className={!template.active ? 'opacity-60' : ''}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1 flex-1">
                  <CardTitle className="text-lg">{template.title}</CardTitle>
                  <div className="flex items-center gap-2 flex-wrap">
                    <Badge variant="outline" className="text-xs">
                      {getChannelIcon(template.channel)}
                      <span className="ml-1">{getChannelLabel(template.channel)}</span>
                    </Badge>
                    {template.variables && template.variables.length > 0 && (
                      <Badge variant="secondary" className="text-xs">
                        {template.variables.length} variáveis
                      </Badge>
                    )}
                    <Badge variant={template.active ? 'default' : 'secondary'} className="text-xs">
                      {template.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </div>
                </div>
                <Switch
                  checked={template.active}
                  onCheckedChange={() => handleToggleActive(template.id, template.active)}
                />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="text-sm text-muted-foreground line-clamp-3">
                {template.message_template}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handlePreview(template)}
                >
                  <Eye className="w-3 h-3 mr-1" />
                  Preview
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setEditingTemplate(template);
                    setIsDialogOpen(true);
                  }}
                >
                  <Edit className="w-3 h-3 mr-1" />
                  Editar
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestSend(template)}
                >
                  <Send className="w-3 h-3 mr-1" />
                  Testar
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => handleDeleteTemplate(template.id)}
                >
                  <Trash2 className="w-3 h-3 mr-1" />
                  Excluir
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialog de Preview */}
      {previewData && (
        <Dialog open={!!previewData} onOpenChange={() => setPreviewData(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Preview do Template</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label className="text-xs text-muted-foreground">Título</Label>
                <div className="font-semibold mt-1">{previewData.title}</div>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Mensagem</Label>
                <div className="text-sm mt-1 whitespace-pre-wrap">{previewData.message}</div>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}

      {/* Campo de teste */}
      <Card>
        <CardHeader>
          <CardTitle className="text-sm">Envio de Teste</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Input
              placeholder="ID do usuário para teste"
              value={testUserId}
              onChange={(e) => setTestUserId(e.target.value)}
            />
            <Button variant="outline">Buscar</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// Componente de Formulário
interface TemplateFormProps {
  template: Template | null;
  onSave: (template: Partial<Template>) => void;
  onCancel: () => void;
}

function TemplateForm({ template, onSave, onCancel }: TemplateFormProps) {
  const [formData, setFormData] = useState({
    title: template?.title || '',
    message_template: template?.message_template || '',
    channel: template?.channel || 'push',
    active: template?.active ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <DialogHeader>
        <DialogTitle>
          {template ? 'Editar Template' : 'Novo Template'}
        </DialogTitle>
      </DialogHeader>

      <div className="space-y-4">
        <div>
          <Label htmlFor="title">Título</Label>
          <Input
            id="title"
            value={formData.title}
            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
            placeholder="Ex: Bem-vindo ao sistema"
            required
          />
        </div>

        <div>
          <Label htmlFor="channel">Canal</Label>
          <Select
            value={formData.channel}
            onValueChange={(value) => setFormData({ ...formData, channel: value })}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="push">Push (App)</SelectItem>
              <SelectItem value="whatsapp">WhatsApp</SelectItem>
              <SelectItem value="email">E-mail</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label htmlFor="message">Mensagem</Label>
          <Textarea
            id="message"
            value={formData.message_template}
            onChange={(e) => setFormData({ ...formData, message_template: e.target.value })}
            placeholder="Olá {{nome}}, bem-vindo à {{unidade}}!"
            rows={6}
            required
          />
          <p className="text-xs text-muted-foreground mt-1">
            Use {'{{variavel}}'} para inserir dados dinâmicos
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Switch
            checked={formData.active}
            onCheckedChange={(checked) => setFormData({ ...formData, active: checked })}
          />
          <Label>Template ativo</Label>
        </div>
      </div>

      <DialogFooter>
        <Button type="button" variant="outline" onClick={onCancel}>
          <X className="w-4 h-4 mr-2" />
          Cancelar
        </Button>
        <Button type="submit">
          <Save className="w-4 h-4 mr-2" />
          Salvar
        </Button>
      </DialogFooter>
    </form>
  );
}
