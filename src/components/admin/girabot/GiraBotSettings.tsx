import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';
import {
  Settings,
  Zap,
  Lock,
  Bell,
  RefreshCw,
  Save,
  AlertTriangle,
  Bot,
  Database
} from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';

interface GiraBotSettings {
  ai_parameters: {
    temperature: number;
    max_tokens: number;
    context_depth: number;
  };
  usage_limits: {
    daily_limit: number;
    per_user_limit: number;
    alert_threshold: number;
  };
  module_integrations: {
    feed: boolean;
    treinamentos: boolean;
    mural: boolean;
    ideias: boolean;
  };
  alert_settings: {
    enable_smart_alerts: boolean;
    alert_frequency: string;
    notify_via_whatsapp: boolean;
  };
}

export function GiraBotSettings() {
  const [settings, setSettings] = useState<GiraBotSettings>({
    ai_parameters: {
      temperature: 0.7,
      max_tokens: 1000,
      context_depth: 10
    },
    usage_limits: {
      daily_limit: 1000,
      per_user_limit: 50,
      alert_threshold: 800
    },
    module_integrations: {
      feed: true,
      treinamentos: true,
      mural: true,
      ideias: true
    },
    alert_settings: {
      enable_smart_alerts: true,
      alert_frequency: '6h',
      notify_via_whatsapp: true
    }
  });

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from('girabot_settings')
        .select('*');

      if (error) throw error;

      if (data && data.length > 0) {
        const settingsObj: any = {};
        data.forEach(item => {
          settingsObj[item.key] = item.value;
        });
        setSettings(settingsObj as GiraBotSettings);
      }
    } catch (error: any) {
      console.error('Error fetching settings:', error);
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'ai_parameters',
          value: settings.ai_parameters,
          description: 'Parâmetros de IA para geração de respostas'
        },
        {
          key: 'usage_limits',
          value: settings.usage_limits,
          description: 'Limites de uso do sistema'
        },
        {
          key: 'module_integrations',
          value: settings.module_integrations,
          description: 'Módulos integrados com o GiraBot'
        },
        {
          key: 'alert_settings',
          value: settings.alert_settings,
          description: 'Configurações de alertas inteligentes'
        }
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('girabot_settings')
          .upsert({
            key: update.key,
            value: update.value,
            description: update.description,
            updated_by: profile?.id
          }, {
            onConflict: 'key'
          });

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas',
        description: 'As alterações foram aplicadas com sucesso.'
      });
    } catch (error: any) {
      console.error('Error saving settings:', error);
      toast({
        title: 'Erro ao salvar configurações',
        description: error.message,
        variant: 'destructive'
      });
    } finally {
      setSaving(false);
    }
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
          <h3 className="text-2xl font-bold">Configurações do GiraBot</h3>
          <p className="text-muted-foreground">Configure parâmetros de IA, limites e integrações</p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Alterações
            </>
          )}
        </Button>
      </div>

      {/* AI Parameters */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bot className="w-5 h-5" />
            Parâmetros de IA
          </CardTitle>
          <CardDescription>
            Configure o comportamento do modelo de linguagem
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label>Temperature: {settings.ai_parameters.temperature}</Label>
              <span className="text-sm text-muted-foreground">
                Criatividade vs. Precisão
              </span>
            </div>
            <Slider
              value={[settings.ai_parameters.temperature]}
              onValueChange={([value]) =>
                setSettings({
                  ...settings,
                  ai_parameters: { ...settings.ai_parameters, temperature: value }
                })
              }
              min={0}
              max={1}
              step={0.1}
              className="w-full"
            />
            <p className="text-xs text-muted-foreground">
              Valores baixos (0.1-0.3): Respostas mais precisas e consistentes<br />
              Valores altos (0.7-1.0): Respostas mais criativas e variadas
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="max_tokens">Máximo de Tokens por Resposta</Label>
            <Input
              id="max_tokens"
              type="number"
              value={settings.ai_parameters.max_tokens}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai_parameters: {
                    ...settings.ai_parameters,
                    max_tokens: parseInt(e.target.value) || 1000
                  }
                })
              }
              min={100}
              max={4000}
            />
            <p className="text-xs text-muted-foreground">
              Controla o tamanho máximo das respostas. 1 token ≈ 0.75 palavras
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="context_depth">Profundidade de Contexto</Label>
            <Input
              id="context_depth"
              type="number"
              value={settings.ai_parameters.context_depth}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  ai_parameters: {
                    ...settings.ai_parameters,
                    context_depth: parseInt(e.target.value) || 10
                  }
                })
              }
              min={1}
              max={50}
            />
            <p className="text-xs text-muted-foreground">
              Número de mensagens anteriores incluídas como contexto
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Usage Limits */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Lock className="w-5 h-5" />
            Limites de Uso
          </CardTitle>
          <CardDescription>
            Defina limites para proteger recursos e custos
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-3">
            <Label htmlFor="daily_limit">Limite Diário Total</Label>
            <Input
              id="daily_limit"
              type="number"
              value={settings.usage_limits.daily_limit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  usage_limits: {
                    ...settings.usage_limits,
                    daily_limit: parseInt(e.target.value) || 1000
                  }
                })
              }
              min={100}
              max={10000}
            />
            <p className="text-xs text-muted-foreground">
              Número máximo de interações permitidas por dia
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="per_user_limit">Limite Por Usuário (dia)</Label>
            <Input
              id="per_user_limit"
              type="number"
              value={settings.usage_limits.per_user_limit}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  usage_limits: {
                    ...settings.usage_limits,
                    per_user_limit: parseInt(e.target.value) || 50
                  }
                })
              }
              min={5}
              max={500}
            />
            <p className="text-xs text-muted-foreground">
              Limite individual de interações por usuário por dia
            </p>
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="alert_threshold">Limite de Alerta</Label>
            <div className="flex items-center gap-2">
              <Input
                id="alert_threshold"
                type="number"
                value={settings.usage_limits.alert_threshold}
                onChange={(e) =>
                  setSettings({
                    ...settings,
                    usage_limits: {
                      ...settings.usage_limits,
                      alert_threshold: parseInt(e.target.value) || 800
                    }
                  })
                }
                min={50}
                max={settings.usage_limits.daily_limit}
              />
              <AlertTriangle className="w-5 h-5 text-orange-500" />
            </div>
            <p className="text-xs text-muted-foreground">
              Enviar alerta ao atingir este número de interações diárias
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Module Integrations */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Integrações com Módulos
          </CardTitle>
          <CardDescription>
            Habilite ou desabilite a integração do GiraBot com cada módulo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.entries(settings.module_integrations).map(([module, enabled]) => (
            <div key={module} className="flex items-center justify-between">
              <div>
                <Label className="capitalize">{module}</Label>
                <p className="text-xs text-muted-foreground">
                  GiraBot responderá perguntas sobre este módulo
                </p>
              </div>
              <Switch
                checked={enabled}
                onCheckedChange={(checked) =>
                  setSettings({
                    ...settings,
                    module_integrations: {
                      ...settings.module_integrations,
                      [module]: checked
                    }
                  })
                }
              />
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Alert Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Bell className="w-5 h-5" />
            Configurações de Alertas
          </CardTitle>
          <CardDescription>
            Configure alertas inteligentes e notificações
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <Label>Alertas Inteligentes</Label>
              <p className="text-xs text-muted-foreground">
                Detectar anomalias e gerar alertas automáticos
              </p>
            </div>
            <Switch
              checked={settings.alert_settings.enable_smart_alerts}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  alert_settings: {
                    ...settings.alert_settings,
                    enable_smart_alerts: checked
                  }
                })
              }
            />
          </div>

          <Separator />

          <div className="space-y-3">
            <Label htmlFor="alert_frequency">Frequência de Verificação</Label>
            <select
              id="alert_frequency"
              value={settings.alert_settings.alert_frequency}
              onChange={(e) =>
                setSettings({
                  ...settings,
                  alert_settings: {
                    ...settings.alert_settings,
                    alert_frequency: e.target.value
                  }
                })
              }
              className="w-full h-10 px-3 rounded-md border border-input bg-background"
            >
              <option value="1h">A cada hora</option>
              <option value="3h">A cada 3 horas</option>
              <option value="6h">A cada 6 horas</option>
              <option value="12h">A cada 12 horas</option>
              <option value="24h">Diariamente</option>
            </select>
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <div>
              <Label>Notificar via WhatsApp</Label>
              <p className="text-xs text-muted-foreground">
                Enviar alertas de alta prioridade via Z-API
              </p>
            </div>
            <Switch
              checked={settings.alert_settings.notify_via_whatsapp}
              onCheckedChange={(checked) =>
                setSettings({
                  ...settings,
                  alert_settings: {
                    ...settings.alert_settings,
                    notify_via_whatsapp: checked
                  }
                })
              }
            />
          </div>
        </CardContent>
      </Card>

      {/* Save Button (Bottom) */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? (
            <>
              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              Salvando...
            </>
          ) : (
            <>
              <Save className="w-4 h-4 mr-2" />
              Salvar Todas as Configurações
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
