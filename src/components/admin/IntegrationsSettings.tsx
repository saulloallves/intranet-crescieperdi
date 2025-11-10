import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Zap, MessageSquare, Bell, Clock, CheckCircle2 } from "lucide-react";

interface Setting {
  key: string;
  value: string;
  description: string;
}

export function IntegrationsSettings() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [settings, setSettings] = useState<Record<string, string>>({});
  const [testingCron, setTestingCron] = useState(false);

  const { data: settingsData, isLoading } = useQuery({
    queryKey: ['integration-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', [
          'auto_certificate_generation',
          'notify_managers_on_completion',
          'send_quiz_failure_help',
          'inactive_user_alert_days',
          'zapi_instance_id',
          'zapi_notifications_enabled'
        ]);
      
      if (error) throw error;
      return data as Setting[];
    }
  });

  useEffect(() => {
    if (settingsData) {
      const settingsObj: Record<string, string> = {};
      settingsData.forEach((setting: Setting) => {
        settingsObj[setting.key] = setting.value;
      });
      setSettings(settingsObj);
    }
  }, [settingsData]);

  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value }: { key: string; value: string }) => {
      const { error } = await supabase
        .from('settings')
        .update({ value })
        .eq('key', key);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['integration-settings'] });
      toast({
        title: "Configuração atualizada",
        description: "A configuração foi salva com sucesso."
      });
    },
    onError: (error: any) => {
      toast({
        title: "Erro ao atualizar",
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const handleToggle = (key: string, currentValue: string) => {
    const newValue = currentValue === 'true' ? 'false' : 'true';
    setSettings(prev => ({ ...prev, [key]: newValue }));
    updateSettingMutation.mutate({ key, value: newValue });
  };

  const handleInputChange = (key: string, value: string) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = (key: string) => {
    updateSettingMutation.mutate({ key, value: settings[key] });
  };

  const testInactiveUsersCheck = async () => {
    setTestingCron(true);
    try {
      const { data, error } = await supabase.functions.invoke('check-inactive-users');
      
      if (error) throw error;

      toast({
        title: "Verificação executada",
        description: `${data.total || 0} alertas de inatividade enviados.`
      });
    } catch (error: any) {
      toast({
        title: "Erro na verificação",
        description: error.message,
        variant: "destructive"
      });
    } finally {
      setTestingCron(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Alert>
        <Zap className="h-4 w-4" />
        <AlertDescription>
          Configure os gatilhos automáticos e integrações do sistema de treinamentos.
        </AlertDescription>
      </Alert>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <CheckCircle2 className="h-5 w-5" />
            Conclusão de Treinamentos
          </CardTitle>
          <CardDescription>
            Gatilhos executados quando colaborador completa módulos e trilhas
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Gerar certificado automaticamente</Label>
              <p className="text-sm text-muted-foreground">
                Emitir certificado ao completar trilha com nota mínima
              </p>
            </div>
            <Switch
              checked={settings.auto_certificate_generation === 'true'}
              onCheckedChange={() => handleToggle('auto_certificate_generation', settings.auto_certificate_generation)}
            />
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Notificar gerentes na conclusão</Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificação ao gerente quando colaborador completa trilha
              </p>
            </div>
            <Switch
              checked={settings.notify_managers_on_completion === 'true'}
              onCheckedChange={() => handleToggle('notify_managers_on_completion', settings.notify_managers_on_completion)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MessageSquare className="h-5 w-5" />
            Suporte Inteligente (GiraBot)
          </CardTitle>
          <CardDescription>
            Assistência automática com IA para colaboradores
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Enviar ajuda em reprovações</Label>
              <p className="text-sm text-muted-foreground">
                GiraBot envia explicação complementar quando colaborador reprova no quiz
              </p>
            </div>
            <Switch
              checked={settings.send_quiz_failure_help === 'true'}
              onCheckedChange={() => handleToggle('send_quiz_failure_help', settings.send_quiz_failure_help)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Alertas de Inatividade
          </CardTitle>
          <CardDescription>
            Notificar colaboradores sem progresso em treinamentos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="inactive-days">Dias sem progresso para alerta</Label>
            <div className="flex gap-2">
              <Input
                id="inactive-days"
                type="number"
                min="1"
                max="90"
                value={settings.inactive_user_alert_days || '30'}
                onChange={(e) => handleInputChange('inactive_user_alert_days', e.target.value)}
              />
              <Button onClick={() => handleSave('inactive_user_alert_days')}>
                Salvar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Sistema verifica diariamente às 9h e envia alertas automáticos
            </p>
          </div>

          <Separator />

          <div>
            <Button 
              onClick={testInactiveUsersCheck}
              disabled={testingCron}
              variant="outline"
            >
              {testingCron ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Verificando...
                </>
              ) : (
                'Executar Verificação Agora'
              )}
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="h-5 w-5" />
            Integração Z-API (WhatsApp)
          </CardTitle>
          <CardDescription>
            Enviar notificações via WhatsApp para gerentes
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label>Habilitar notificações WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagens via Z-API quando trilha é concluída
              </p>
            </div>
            <Switch
              checked={settings.zapi_notifications_enabled === 'true'}
              onCheckedChange={() => handleToggle('zapi_notifications_enabled', settings.zapi_notifications_enabled)}
            />
          </div>

          <Separator />

          <div className="space-y-2">
            <Label htmlFor="zapi-instance">ID da Instância Z-API</Label>
            <div className="flex gap-2">
              <Input
                id="zapi-instance"
                placeholder="Ex: 3BDD458..."
                value={settings.zapi_instance_id || ''}
                onChange={(e) => handleInputChange('zapi_instance_id', e.target.value)}
              />
              <Button onClick={() => handleSave('zapi_instance_id')}>
                Salvar
              </Button>
            </div>
            <p className="text-sm text-muted-foreground">
              Configure o token Z-API nas variáveis de ambiente (ZAPI_TOKEN)
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
