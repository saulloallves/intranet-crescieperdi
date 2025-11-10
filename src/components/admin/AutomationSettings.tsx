import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Loader2, Save, AlertCircle } from 'lucide-react';
import { ChecklistAutomationStatus } from './ChecklistAutomationStatus';

interface AutomationSetting {
  key: string;
  value: any;
  description: string;
}

export function AutomationSettings() {
  const [settings, setSettings] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('automation_settings')
        .select('*');

      if (error) throw error;

      const settingsMap: Record<string, any> = {};
      data?.forEach((setting: AutomationSetting) => {
        settingsMap[setting.key] = setting.value;
      });

      // Buscar também configurações de conteúdos obrigatórios da tabela settings
      const { data: mandatorySettings, error: mandatoryError } = await supabase
        .from('settings')
        .select('*')
        .in('key', [
          'mandatory_content_block_access',
          'mandatory_content_reminder_frequency',
          'mandatory_content_quiz_auto_generate',
          'mandatory_content_require_100_percent_video',
          'mandatory_content_signature_pdf_enabled',
          'mandatory_content_whatsapp_batch_limit',
          'mandatory_content_reminder_time',
          'mandatory_content_max_reminders'
        ]);

      if (!mandatoryError && mandatorySettings) {
        mandatorySettings.forEach((setting: any) => {
          // Parse values from settings table
          let value = setting.value;
          if (typeof value === 'string') {
            if (value === 'true') value = true;
            else if (value === 'false') value = false;
            else if (value.startsWith('"') && value.endsWith('"')) {
              value = value.slice(1, -1); // Remove quotes
            }
          }
          settingsMap[setting.key] = value;
        });
      }

      setSettings(settingsMap);
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast.error('Erro ao carregar configurações');
    } finally {
      setLoading(false);
    }
  };

  const updateSetting = async (key: string, value: any) => {
    setSettings(prev => ({ ...prev, [key]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      // Keys que pertencem à tabela settings
      const settingsTableKeys = [
        'mandatory_content_block_access',
        'mandatory_content_reminder_frequency',
        'mandatory_content_quiz_auto_generate',
        'mandatory_content_require_100_percent_video',
        'mandatory_content_signature_pdf_enabled',
        'mandatory_content_whatsapp_batch_limit',
        'mandatory_content_reminder_time',
        'mandatory_content_max_reminders'
      ];

      // Update settings de automation_settings
      for (const [key, value] of Object.entries(settings)) {
        if (settingsTableKeys.includes(key)) {
          // Atualizar na tabela settings
          const { error } = await supabase
            .from('settings')
            .update({ 
              value: typeof value === 'boolean' ? String(value) : value,
              updated_at: new Date().toISOString() 
            })
            .eq('key', key);

          if (error) throw error;
        } else {
          // Atualizar na tabela automation_settings
          const { error } = await supabase
            .from('automation_settings')
            .update({ value, updated_at: new Date().toISOString() })
            .eq('key', key);

          if (error) throw error;
        }
      }

      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast.error('Erro ao salvar configurações');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <ChecklistAutomationStatus />
      
      <Card>
        <CardHeader>
          <CardTitle>Automações Internas</CardTitle>
          <CardDescription>Configure gatilhos automáticos do sistema</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="auto-notifications">Notificações Automáticas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificações automaticamente para novos conteúdos
              </p>
            </div>
            <Switch
              id="auto-notifications"
              checked={settings.auto_notifications_enabled === true || settings.auto_notifications_enabled === 'true'}
              onCheckedChange={(checked) => updateSetting('auto_notifications_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="welcome-message">Mensagem de Boas-Vindas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar mensagem automática para novos usuários
              </p>
            </div>
            <Switch
              id="welcome-message"
              checked={settings.welcome_message_enabled === true || settings.welcome_message_enabled === 'true'}
              onCheckedChange={(checked) => updateSetting('welcome_message_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="password-recovery">Recuperação de Senha via WhatsApp</Label>
              <p className="text-sm text-muted-foreground">
                Enviar senha via WhatsApp na recuperação
              </p>
            </div>
            <Switch
              id="password-recovery"
              checked={settings.password_recovery_whatsapp === true || settings.password_recovery_whatsapp === 'true'}
              onCheckedChange={(checked) => updateSetting('password_recovery_whatsapp', checked)}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Configuração de Fila WhatsApp</h4>
            <p className="text-sm text-muted-foreground">
              Defina as pausas entre disparos para evitar bloqueios
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="delay-min">Delay Mínimo (segundos)</Label>
                <Input
                  id="delay-min"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.whatsapp_queue_delay_min || 3}
                  onChange={(e) => updateSetting('whatsapp_queue_delay_min', parseInt(e.target.value))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="delay-max">Delay Máximo (segundos)</Label>
                <Input
                  id="delay-max"
                  type="number"
                  min="1"
                  max="60"
                  value={settings.whatsapp_queue_delay_max || 5}
                  onChange={(e) => updateSetting('whatsapp_queue_delay_max', parseInt(e.target.value))}
                />
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Alertas de Checklist</CardTitle>
          <CardDescription>Configure alertas automáticos para checklists pendentes</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="push-enabled">Notificações Push Internas</Label>
              <p className="text-sm text-muted-foreground">
                Enviar notificações na intranet para checklists pendentes
              </p>
            </div>
            <Switch
              id="push-enabled"
              checked={settings.push_enabled === true || settings.push_enabled === 'true'}
              onCheckedChange={(checked) => updateSetting('push_enabled', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="zapi-alerts">Alertas via WhatsApp (Z-API)</Label>
              <p className="text-sm text-muted-foreground">
                Enviar alertas via WhatsApp quando unidades não enviarem checklists no prazo
              </p>
            </div>
            <Switch
              id="zapi-alerts"
              checked={settings.enable_zapi_alerts === true || settings.enable_zapi_alerts === 'true'}
              onCheckedChange={(checked) => updateSetting('enable_zapi_alerts', checked)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="alert-repeat">Intervalo de Reenvio (horas)</Label>
            <Input
              id="alert-repeat"
              type="number"
              min="1"
              max="24"
              value={settings.alert_repeat_interval || 2}
              onChange={(e) => updateSetting('alert_repeat_interval', parseInt(e.target.value))}
            />
            <p className="text-xs text-muted-foreground">
              Tempo para reenviar alerta se o checklist continuar pendente
            </p>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Execução Automática (Cron)
            </h4>
            <p className="text-sm text-muted-foreground">
              Para ativar a verificação automática de checklists, configure um cron job no Supabase:
            </p>
            <code className="block text-xs bg-background p-3 rounded border mt-2">
              select cron.schedule(<br/>
              &nbsp;&nbsp;'check-checklists',<br/>
              &nbsp;&nbsp;'0 * * * *',  -- A cada hora<br/>
              &nbsp;&nbsp;$$<br/>
              &nbsp;&nbsp;select net.http_post(<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;url:='https://sgeabunxaunzoedwvvox.supabase.co/functions/v1/check-checklist-compliance',<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;headers:='{"{"}Content-Type": "application/json"{"}"}'::jsonb<br/>
              &nbsp;&nbsp;);<br/>
              &nbsp;&nbsp;$$<br/>
              );
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Ou use o botão "Verificar Agora" na aba Relatórios para testar manualmente.
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Conteúdos Obrigatórios (Cresci e Perdi)</CardTitle>
          <CardDescription>Configure o comportamento do módulo de conformidade e leitura obrigatória</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="block-access">Bloquear acesso até conclusão</Label>
              <p className="text-sm text-muted-foreground">
                Impede acesso à intranet até que usuário complete conteúdos pendentes
              </p>
            </div>
            <Switch
              id="block-access"
              checked={settings.mandatory_content_block_access === true || settings.mandatory_content_block_access === 'true'}
              onCheckedChange={(checked) => updateSetting('mandatory_content_block_access', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="quiz-auto-generate">Gerar quiz automático (IA)</Label>
              <p className="text-sm text-muted-foreground">
                Usar IA para criar perguntas de avaliação de compreensão automaticamente
              </p>
            </div>
            <Switch
              id="quiz-auto-generate"
              checked={settings.mandatory_content_quiz_auto_generate === true || settings.mandatory_content_quiz_auto_generate === 'true'}
              onCheckedChange={(checked) => updateSetting('mandatory_content_quiz_auto_generate', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="video-100">Exigir vídeo 100%</Label>
              <p className="text-sm text-muted-foreground">
                Usuário precisa assistir o vídeo até o final para liberar confirmação
              </p>
            </div>
            <Switch
              id="video-100"
              checked={settings.mandatory_content_require_100_percent_video === true || settings.mandatory_content_require_100_percent_video === 'true'}
              onCheckedChange={(checked) => updateSetting('mandatory_content_require_100_percent_video', checked)}
            />
          </div>

          <div className="flex items-center justify-between">
            <div className="space-y-0.5">
              <Label htmlFor="signature-pdf">Gerar PDF de ciência</Label>
              <p className="text-sm text-muted-foreground">
                Criar comprovante em PDF após confirmação (recurso futuro)
              </p>
            </div>
            <Switch
              id="signature-pdf"
              checked={settings.mandatory_content_signature_pdf_enabled === true || settings.mandatory_content_signature_pdf_enabled === 'true'}
              onCheckedChange={(checked) => updateSetting('mandatory_content_signature_pdf_enabled', checked)}
            />
          </div>

          <div className="space-y-4 pt-4 border-t">
            <h4 className="font-medium">Lembretes Automáticos</h4>
            <p className="text-sm text-muted-foreground">
              Configure envio de lembretes via WhatsApp e Push para conteúdos pendentes
            </p>
            
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reminder-time">Horário dos lembretes</Label>
                <Input
                  id="reminder-time"
                  type="time"
                  value={settings.mandatory_content_reminder_time || '10:00'}
                  onChange={(e) => updateSetting('mandatory_content_reminder_time', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  Hora fixa para envio diário de lembretes
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="max-reminders">Limite de lembretes</Label>
                <Input
                  id="max-reminders"
                  type="number"
                  min="1"
                  max="10"
                  value={settings.mandatory_content_max_reminders || 5}
                  onChange={(e) => updateSetting('mandatory_content_max_reminders', parseInt(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  Número máximo de lembretes por usuário
                </p>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="whatsapp-batch">Limite de envios WhatsApp por lote</Label>
              <Input
                id="whatsapp-batch"
                type="number"
                min="10"
                max="200"
                value={settings.mandatory_content_whatsapp_batch_limit || 50}
                onChange={(e) => updateSetting('mandatory_content_whatsapp_batch_limit', parseInt(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Quantidade de mensagens enviadas por vez para evitar sobrecarga
              </p>
            </div>
          </div>

          <div className="p-4 bg-muted rounded-lg space-y-2">
            <h4 className="font-medium flex items-center gap-2">
              <AlertCircle className="w-4 h-4" />
              Execução Automática de Lembretes
            </h4>
            <p className="text-sm text-muted-foreground">
              Para ativar o envio automático diário de lembretes, configure um cron job no Supabase:
            </p>
            <code className="block text-xs bg-background p-3 rounded border mt-2">
              select cron.schedule(<br/>
              &nbsp;&nbsp;'send-mandatory-reminders-daily',<br/>
              &nbsp;&nbsp;'0 10 * * *',  -- Todo dia às 10h<br/>
              &nbsp;&nbsp;$$<br/>
              &nbsp;&nbsp;select net.http_post(<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;url:='https://sgeabunxaunzoedwvvox.supabase.co/functions/v1/send-mandatory-content-reminders',<br/>
              &nbsp;&nbsp;&nbsp;&nbsp;headers:='{"{"}Content-Type": "application/json"{"}"}'::jsonb<br/>
              &nbsp;&nbsp;);<br/>
              &nbsp;&nbsp;$$<br/>
              );
            </code>
            <p className="text-xs text-muted-foreground mt-2">
              Os lembretes serão enviados automaticamente para usuários com conteúdos pendentes.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="mr-2 h-4 w-4" />
              Salvar Automações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
