import { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';
import { Send, Users, Building2, Loader2 } from 'lucide-react';

interface NotificationTemplate {
  title: string;
  message: string;
  type: string;
}

const TEMPLATES: Record<string, NotificationTemplate> = {
  new_announcement: {
    title: 'Novo Comunicado Publicado',
    message: 'Um novo comunicado foi publicado. Confira agora!',
    type: 'announcement',
  },
  new_training: {
    title: 'Novo Treinamento Disponível',
    message: 'Um novo treinamento está disponível para você. Acesse e complete!',
    type: 'training',
  },
  campaign_reminder: {
    title: 'Lembrete de Campanha',
    message: 'Não esqueça de registrar seus resultados da campanha!',
    type: 'campaign',
  },
  recognition: {
    title: 'Você Recebeu um Reconhecimento!',
    message: 'Parabéns! Você foi reconhecido pelo seu trabalho excepcional.',
    type: 'recognition',
  },
};

export function SendNotificationDialog() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [template, setTemplate] = useState('');
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [sendWhatsApp, setSendWhatsApp] = useState(false);
  const [targetType, setTargetType] = useState<'all' | 'roles' | 'units'>('all');
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedUnits, setSelectedUnits] = useState<string[]>([]);
  const [units, setUnits] = useState<any[]>([]);

  useEffect(() => {
    if (open) {
      fetchUnits();
    }
  }, [open]);

  const fetchUnits = async () => {
    const { data } = await supabase
      .from('units')
      .select('code, name')
      .eq('is_active', true)
      .order('name');
    setUnits(data || []);
  };

  const handleTemplateSelect = (templateKey: string) => {
    setTemplate(templateKey);
    const t = TEMPLATES[templateKey];
    setTitle(t.title);
    setMessage(t.message);
    setType(t.type);
  };

  const toggleRole = (role: string) => {
    setSelectedRoles(prev =>
      prev.includes(role) ? prev.filter(r => r !== role) : [...prev, role]
    );
  };

  const toggleUnit = (unitCode: string) => {
    setSelectedUnits(prev =>
      prev.includes(unitCode) ? prev.filter(u => u !== unitCode) : [...prev, unitCode]
    );
  };

  const handleSend = async () => {
    if (!title || !message) {
      toast({
        title: 'Erro',
        description: 'Título e mensagem são obrigatórios',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-notification', {
        body: {
          title,
          message,
          type,
          sendWhatsApp,
          roles: targetType === 'roles' ? selectedRoles : undefined,
          units: targetType === 'units' ? selectedUnits : undefined,
        },
      });

      if (error) throw error;

      toast({
        title: 'Notificações Enviadas!',
        description: `${data.notificationsSent} notificações enviadas${
          data.whatsappResults ? ` | WhatsApp: ${data.whatsappResults.sent} enviados` : ''
        }`,
      });

      setOpen(false);
      resetForm();
    } catch (error: any) {
      console.error('Error sending notifications:', error);
      toast({
        title: 'Erro ao Enviar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setTemplate('');
    setTitle('');
    setMessage('');
    setType('info');
    setSendWhatsApp(false);
    setTargetType('all');
    setSelectedRoles([]);
    setSelectedUnits([]);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button>
          <Send className="w-4 h-4 mr-2" />
          Enviar Notificação
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Enviar Notificação</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Template Selector */}
          <div className="space-y-2">
            <Label>Template (Opcional)</Label>
            <Select value={template} onValueChange={handleTemplateSelect}>
              <SelectTrigger>
                <SelectValue placeholder="Selecione um template..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new_announcement">Novo Comunicado</SelectItem>
                <SelectItem value="new_training">Novo Treinamento</SelectItem>
                <SelectItem value="campaign_reminder">Lembrete de Campanha</SelectItem>
                <SelectItem value="recognition">Reconhecimento</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Title */}
          <div className="space-y-2">
            <Label htmlFor="title">Título *</Label>
            <Input
              id="title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Título da notificação"
            />
          </div>

          {/* Message */}
          <div className="space-y-2">
            <Label htmlFor="message">Mensagem *</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Conteúdo da notificação"
              rows={4}
            />
          </div>

          {/* Type */}
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="info">Info</SelectItem>
                <SelectItem value="announcement">Comunicado</SelectItem>
                <SelectItem value="training">Treinamento</SelectItem>
                <SelectItem value="campaign">Campanha</SelectItem>
                <SelectItem value="recognition">Reconhecimento</SelectItem>
                <SelectItem value="alert">Alerta</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* WhatsApp Toggle */}
          <div className="flex items-center justify-between">
            <Label htmlFor="whatsapp">Enviar via WhatsApp (Z-API)</Label>
            <Switch
              id="whatsapp"
              checked={sendWhatsApp}
              onCheckedChange={setSendWhatsApp}
            />
          </div>

          {/* Target Type */}
          <div className="space-y-2">
            <Label>Destinatários</Label>
            <Select value={targetType} onValueChange={(v: any) => setTargetType(v)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Usuários</SelectItem>
                <SelectItem value="roles">Por Cargo</SelectItem>
                <SelectItem value="units">Por Unidade</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Role Selection */}
          {targetType === 'roles' && (
            <div className="space-y-2">
              <Label>Selecione os Cargos</Label>
              <div className="flex flex-wrap gap-2">
                {['admin', 'gestor_setor', 'colaborador', 'franqueado'].map((role) => (
                  <Badge
                    key={role}
                    variant={selectedRoles.includes(role) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleRole(role)}
                  >
                    <Users className="w-3 h-3 mr-1" />
                    {role === 'admin' ? 'Admin' : 
                     role === 'gestor_setor' ? 'Gestor' : 
                     role === 'colaborador' ? 'Colaborador' : 'Franqueado'}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Unit Selection */}
          {targetType === 'units' && (
            <div className="space-y-2">
              <Label>Selecione as Unidades</Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto">
                {units.map((unit) => (
                  <Badge
                    key={unit.code}
                    variant={selectedUnits.includes(unit.code) ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => toggleUnit(unit.code)}
                  >
                    <Building2 className="w-3 h-3 mr-1" />
                    {unit.name}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancelar
            </Button>
            <Button onClick={handleSend} disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Enviando...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Enviar
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}