import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Switch } from '@/components/ui/switch';
import { Link, Bot, Zap, Palette, Shield, RefreshCw, AlertCircle, GraduationCap, MessageSquare, Users } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { AutomationSettings } from './AutomationSettings';
import { Textarea } from '@/components/ui/textarea';
import { Slider } from '@/components/ui/slider';
import { Separator } from '@/components/ui/separator';

export function AdminCrossConfig() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  const [integrations, setIntegrations] = useState({
    typebot_girabot_url: '',
    typebot_support_url: '',
    typebot_midias_url: '',
    typebot_custom_url: '',
    notion_api_key: '',
    notion_database_id: '',
    zapi_token: '',
    resend_api_key: '',
  });

  const [branding, setBranding] = useState({
    primary_color: '#ec4899',
    secondary_color: '#fbbf24',
    company_name: 'Cresci e Perdi',
  });

  const [automation, setAutomation] = useState({
    auto_notification: true,
    auto_index_search: true,
    welcome_message: true,
  });

  const [onboarding, setOnboarding] = useState({
    onboarding_auto_assign: false,
    default_training_by_role: {} as Record<string, string>,
  });

  const [mural, setMural] = useState({
    mural_auto_approval_enabled: false,
    mural_ai_prompt_filter: '',
    mural_ai_prompt_validation: '',
    mural_ai_prompt_moderation: '',
    mural_ai_sensitivity: 3,
    mural_notify_on_reply: true,
    mural_feed_integration: true,
    mural_allow_media: true,
    mural_curator_roles: ['admin', 'gestor_setor'] as string[],
  });

  const [userManagement, setUserManagement] = useState({
    session_timeout: 60,
    max_failed_logins: 5,
    multi_role_enabled: true,
    activity_log_retention_days: 90,
    require_2fa: false,
    notify_inactive_users: true,
    inactive_threshold_days: 30,
    auto_lock_inactive_days: 90,
    permission_audit_enabled: true,
    security_alerts_enabled: true,
  });

  const [trainingPaths, setTrainingPaths] = useState<any[]>([]);

  const [notifications, setNotifications] = useState({
    zapi_enabled: true,
    zapi_retry_attempts: 3,
    zapi_retry_delay: 5,
    email_enabled: true,
    push_enabled: true,
    default_templates: {
      welcome: 'Olá {{nome}}! Bem-vindo(a) ao sistema.',
      training_reminder: '🎓 Lembrete: Você tem treinamentos pendentes.',
      announcement: '📢 {{titulo}}: {{descricao}}'
    },
    report_frequency: 'weekly',
    report_recipients: [] as string[],
    report_enabled: true
  });

  const [reindexing, setReindexing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    fetchSettings();
    fetchTrainingPaths();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase.from('settings').select('*');
      
      if (error) throw error;

      const settingsMap: Record<string, string> = {};
      data?.forEach((setting) => {
        let value = '';
        
        if (typeof setting.value === 'string') {
          // Se é string com JSON (aspas duplas no início e fim), parse
          if (setting.value.startsWith('"') && setting.value.endsWith('"')) {
            try {
              value = JSON.parse(setting.value);
            } catch (e) {
              // Se falhar, apenas remova as aspas
              value = setting.value.replace(/^"|"$/g, '');
            }
          } else {
            value = setting.value;
          }
        } else if (setting.value !== null && setting.value !== undefined) {
          value = String(setting.value);
        }
        
        settingsMap[setting.key] = value;
      });

      setIntegrations({
        typebot_girabot_url: settingsMap.typebot_girabot_url || '',
        typebot_support_url: settingsMap.typebot_support_url || '',
        typebot_midias_url: settingsMap.typebot_midias_url || '',
        typebot_custom_url: settingsMap.typebot_custom_url || '',
        notion_api_key: settingsMap.notion_api_key || '',
        notion_database_id: settingsMap.notion_database_id || '',
        zapi_token: settingsMap.zapi_token || '',
        resend_api_key: settingsMap.resend_api_key || '',
      });

      setBranding({
        primary_color: settingsMap.primary_color || '#ec4899',
        secondary_color: settingsMap.secondary_color || '#fbbf24',
        company_name: settingsMap.company_name || 'Cresci e Perdi',
      });

      setAutomation({
        auto_notification: settingsMap.auto_notification === 'true',
        auto_index_search: settingsMap.auto_index_search === 'true',
        welcome_message: settingsMap.welcome_message === 'true',
      });

      // Parse onboarding settings
      let roleMapping = {};
      try {
        if (settingsMap.default_training_by_role) {
          roleMapping = typeof settingsMap.default_training_by_role === 'string' 
            ? JSON.parse(settingsMap.default_training_by_role)
            : settingsMap.default_training_by_role;
        }
      } catch (e) {
        console.error('Error parsing default_training_by_role:', e);
      }

      setOnboarding({
        onboarding_auto_assign: settingsMap.onboarding_auto_assign === 'true',
        default_training_by_role: roleMapping,
      });

      // Parse mural settings
      let curatorRoles = ['admin', 'gestor_setor'];
      try {
        if (settingsMap.mural_curator_roles) {
          curatorRoles = typeof settingsMap.mural_curator_roles === 'string'
            ? JSON.parse(settingsMap.mural_curator_roles)
            : settingsMap.mural_curator_roles;
        }
      } catch (e) {
        console.error('Error parsing mural_curator_roles:', e);
      }

      setMural({
        mural_auto_approval_enabled: settingsMap.mural_auto_approval_enabled === 'true',
        mural_ai_prompt_filter: settingsMap.mural_ai_prompt_filter || '',
        mural_ai_prompt_validation: settingsMap.mural_ai_prompt_validation || '',
        mural_ai_prompt_moderation: settingsMap.mural_ai_prompt_moderation || '',
        mural_ai_sensitivity: parseInt(settingsMap.mural_ai_sensitivity || '3'),
        mural_notify_on_reply: settingsMap.mural_notify_on_reply !== 'false',
        mural_feed_integration: settingsMap.mural_feed_integration !== 'false',
        mural_allow_media: settingsMap.mural_allow_media !== 'false',
        mural_curator_roles: curatorRoles,
      });

      // Parse user management settings
      setUserManagement({
        session_timeout: parseInt(settingsMap.session_timeout || '60'),
        max_failed_logins: parseInt(settingsMap.max_failed_logins || '5'),
        multi_role_enabled: settingsMap.multi_role_enabled !== 'false',
        activity_log_retention_days: parseInt(settingsMap.activity_log_retention_days || '90'),
        require_2fa: settingsMap.require_2fa === 'true',
        notify_inactive_users: settingsMap.notify_inactive_users !== 'false',
        inactive_threshold_days: parseInt(settingsMap.inactive_threshold_days || '30'),
        auto_lock_inactive_days: parseInt(settingsMap.auto_lock_inactive_days || '90'),
        permission_audit_enabled: settingsMap.permission_audit_enabled !== 'false',
        security_alerts_enabled: settingsMap.security_alerts_enabled !== 'false',
      });

      // Parse notification settings
      let defaultTemplates = {
        welcome: 'Olá {{nome}}! Bem-vindo(a) ao sistema.',
        training_reminder: '🎓 Lembrete: Você tem treinamentos pendentes.',
        announcement: '📢 {{titulo}}: {{descricao}}'
      };
      let reportRecipients: string[] = [];
      
      try {
        if (settingsMap.notification_default_templates) {
          defaultTemplates = typeof settingsMap.notification_default_templates === 'string'
            ? JSON.parse(settingsMap.notification_default_templates)
            : settingsMap.notification_default_templates;
        }
        if (settingsMap.notification_report_recipients) {
          reportRecipients = typeof settingsMap.notification_report_recipients === 'string'
            ? JSON.parse(settingsMap.notification_report_recipients)
            : settingsMap.notification_report_recipients;
        }
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }

      setNotifications({
        zapi_enabled: settingsMap.notification_zapi_enabled !== 'false',
        zapi_retry_attempts: parseInt(settingsMap.notification_zapi_retry_attempts || '3'),
        zapi_retry_delay: parseInt(settingsMap.notification_zapi_retry_delay || '5'),
        email_enabled: settingsMap.notification_email_enabled !== 'false',
        push_enabled: settingsMap.notification_push_enabled !== 'false',
        default_templates: defaultTemplates,
        report_frequency: settingsMap.notification_report_frequency || 'weekly',
        report_recipients: reportRecipients,
        report_enabled: settingsMap.notification_report_enabled !== 'false',
      });
    } catch (error) {
      console.error('Erro ao buscar configurações:', error);
      toast({
        title: 'Erro ao carregar',
        description: 'Não foi possível carregar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSaveIntegrations = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(integrations).map(([key, value]) => ({
        key,
        value: value, // Salvar diretamente sem JSON.stringify duplo
        description: `Configuração de ${key}`,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas!',
        description: 'As integrações foram atualizadas com sucesso.',
      });
      
      // Recarregar para garantir que está atualizado
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(branding).map(([key, value]) => ({
        key,
        value: value,
        description: `Configuração de ${key}`,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Identidade visual salva!',
        description: 'As configurações de marca foram atualizadas.',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveAutomation = async () => {
    setSaving(true);
    try {
      const updates = Object.entries(automation).map(([key, value]) => ({
        key,
        value: String(value),
        description: `Configuração de automação ${key}`,
      }));

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Automações salvas!',
        description: 'As configurações de automação foram atualizadas.',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReindexSearch = async () => {
    setReindexing(true);
    try {
      const { error } = await supabase.functions.invoke('search-index');
      
      if (error) throw error;

      toast({
        title: 'Reindexação iniciada',
        description: 'O índice de busca está sendo reconstruído.',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao reindexar',
        description: error.message || 'Não foi possível iniciar a reindexação.',
        variant: 'destructive',
      });
    } finally {
      setReindexing(false);
    }
  };

  const handleNotionSync = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('notion-sync');
      
      if (error) throw error;

      if (data?.success === false) {
        throw new Error(data.error || 'Erro ao sincronizar');
      }

      toast({
        title: 'Sincronização concluída',
        description: `${data.synced} manuais sincronizados do Notion com sucesso!`,
      });
    } catch (error: any) {
      const errorMessage = error.message || 'Não foi possível sincronizar com o Notion.';
      const isConfigError = errorMessage.includes('Configurações do Notion não encontradas');
      
      toast({
        title: 'Erro ao sincronizar',
        description: isConfigError 
          ? 'Preencha a Notion API Key e o Notion Database ID e clique em "Salvar Integrações" primeiro.'
          : errorMessage,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const fetchTrainingPaths = async () => {
    try {
      const { data, error } = await supabase
        .from('training_paths' as any)
        .select('id, name, target_role')
        .eq('is_active', true)
        .order('order_index');
      
      if (error) throw error;
      setTrainingPaths(data || []);
    } catch (error) {
      console.error('Error fetching training paths:', error);
    }
  };

  const handleSaveOnboarding = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'onboarding_auto_assign',
          value: String(onboarding.onboarding_auto_assign),
          description: 'Habilitar atribuição automática de trilhas no onboarding',
        },
        {
          key: 'default_training_by_role',
          value: JSON.stringify(onboarding.default_training_by_role),
          description: 'Mapeamento de cargo para ID de trilha de treinamento (JSON)',
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Onboarding configurado!',
        description: 'As configurações de onboarding automático foram salvas.',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleRoleMappingChange = (role: string, pathId: string) => {
    setOnboarding({
      ...onboarding,
      default_training_by_role: {
        ...onboarding.default_training_by_role,
        [role]: pathId,
      },
    });
  };

  const handleSaveMural = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'mural_auto_approval_enabled',
          value: String(mural.mural_auto_approval_enabled),
          description: 'Habilitar aprovação automática de posts do Mural via IA',
        },
        {
          key: 'mural_ai_prompt_filter',
          value: mural.mural_ai_prompt_filter,
          description: 'Prompt de IA para filtrar e anonimizar conteúdo do Mural',
        },
        {
          key: 'mural_ai_prompt_validation',
          value: mural.mural_ai_prompt_validation,
          description: 'Prompt de IA para validar e aprovar posts do Mural',
        },
        {
          key: 'mural_ai_prompt_moderation',
          value: mural.mural_ai_prompt_moderation,
          description: 'Prompt de IA para moderar e aprovar respostas do Mural',
        },
        {
          key: 'mural_ai_sensitivity',
          value: String(mural.mural_ai_sensitivity),
          description: 'Nível de sensibilidade da IA (1-5)',
        },
        {
          key: 'mural_notify_on_reply',
          value: String(mural.mural_notify_on_reply),
          description: 'Notificar usuário quando receber resposta no Mural',
        },
        {
          key: 'mural_feed_integration',
          value: String(mural.mural_feed_integration),
          description: 'Integrar posts do Mural ao Feed principal',
        },
        {
          key: 'mural_allow_media',
          value: String(mural.mural_allow_media),
          description: 'Permitir imagens nas postagens do Mural',
        },
        {
          key: 'mural_curator_roles',
          value: JSON.stringify(mural.mural_curator_roles),
          description: 'Cargos com permissão de curadoria do Mural',
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Configurações do Mural salvas!',
        description: 'As configurações foram atualizadas com sucesso.',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleMuralRoleToggle = (role: string) => {
    const currentRoles = [...mural.mural_curator_roles];
    const index = currentRoles.indexOf(role);
    
    if (index > -1) {
      currentRoles.splice(index, 1);
    } else {
      currentRoles.push(role);
    }
    
    setMural({ ...mural, mural_curator_roles: currentRoles });
  };

  const handleSaveUserManagement = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'session_timeout',
          value: String(userManagement.session_timeout),
          description: 'Tempo de timeout da sessão em minutos',
        },
        {
          key: 'max_failed_logins',
          value: String(userManagement.max_failed_logins),
          description: 'Máximo de tentativas de login falhadas',
        },
        {
          key: 'multi_role_enabled',
          value: String(userManagement.multi_role_enabled),
          description: 'Permitir múltiplas roles por usuário',
        },
        {
          key: 'activity_log_retention_days',
          value: String(userManagement.activity_log_retention_days),
          description: 'Dias de retenção dos logs de atividade',
        },
        {
          key: 'require_2fa',
          value: String(userManagement.require_2fa),
          description: 'Exigir autenticação de dois fatores',
        },
        {
          key: 'notify_inactive_users',
          value: String(userManagement.notify_inactive_users),
          description: 'Notificar usuários inativos',
        },
        {
          key: 'inactive_threshold_days',
          value: String(userManagement.inactive_threshold_days),
          description: 'Dias para considerar usuário inativo',
        },
        {
          key: 'auto_lock_inactive_days',
          value: String(userManagement.auto_lock_inactive_days),
          description: 'Dias para bloquear automaticamente usuário inativo',
        },
        {
          key: 'permission_audit_enabled',
          value: String(userManagement.permission_audit_enabled),
          description: 'Habilitar auditoria de permissões',
        },
        {
          key: 'security_alerts_enabled',
          value: String(userManagement.security_alerts_enabled),
          description: 'Habilitar alertas de segurança',
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: 'Configurações de Usuários salvas!',
        description: 'As configurações foram atualizadas com sucesso.',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSaveNotifications = async () => {
    setSaving(true);
    try {
      const updates = [
        {
          key: 'notification_zapi_enabled',
          value: String(notifications.zapi_enabled),
          description: 'Habilitar envio de notificações via WhatsApp (Z-API)',
        },
        {
          key: 'notification_zapi_retry_attempts',
          value: String(notifications.zapi_retry_attempts),
          description: 'Número de tentativas de reenvio em caso de falha',
        },
        {
          key: 'notification_zapi_retry_delay',
          value: String(notifications.zapi_retry_delay),
          description: 'Intervalo entre tentativas de reenvio (segundos)',
        },
        {
          key: 'notification_email_enabled',
          value: String(notifications.email_enabled),
          description: 'Habilitar envio de notificações por e-mail',
        },
        {
          key: 'notification_push_enabled',
          value: String(notifications.push_enabled),
          description: 'Habilitar envio de notificações push no navegador',
        },
        {
          key: 'notification_default_templates',
          value: JSON.stringify(notifications.default_templates),
          description: 'Templates padrão de notificações (JSON)',
        },
        {
          key: 'notification_report_frequency',
          value: notifications.report_frequency,
          description: 'Frequência de geração de relatórios automáticos',
        },
        {
          key: 'notification_report_recipients',
          value: JSON.stringify(notifications.report_recipients),
          description: 'Destinatários dos relatórios automáticos (JSON array)',
        },
        {
          key: 'notification_report_enabled',
          value: String(notifications.report_enabled),
          description: 'Habilitar geração de relatórios automáticos',
        },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .upsert(
            { key: update.key, value: update.value, description: update.description },
            { onConflict: 'key' }
          );
        
        if (error) throw error;
      }

      toast({
        title: '✅ Configurações salvas',
        description: 'Configurações de notificações atualizadas com sucesso',
      });
      
      await fetchSettings();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast({
        title: '❌ Erro ao salvar',
        description: error.message || 'Não foi possível salvar as configurações.',
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">CrossConfig - Configuração Global</h2>
        <p className="text-muted-foreground">Central de governança de todas as ligações e parâmetros do sistema</p>
      </div>

      <Tabs defaultValue="integrations" className="w-full">
        <TabsList className="grid w-full grid-cols-8">
          <TabsTrigger value="integrations" className="gap-2">
            <Link className="w-4 h-4" />
            Integrações
          </TabsTrigger>
          <TabsTrigger value="automation" className="gap-2">
            <Zap className="w-4 h-4" />
            Automações
          </TabsTrigger>
          <TabsTrigger value="mural" className="gap-2">
            <MessageSquare className="w-4 h-4" />
            Mural
          </TabsTrigger>
          <TabsTrigger value="users" className="gap-2">
            <Users className="w-4 h-4" />
            Usuários
          </TabsTrigger>
          <TabsTrigger value="onboarding" className="gap-2">
            <GraduationCap className="w-4 h-4" />
            Onboarding
          </TabsTrigger>
          <TabsTrigger value="notifications" className="gap-2">
            <Bot className="w-4 h-4" />
            Notificações
          </TabsTrigger>
          <TabsTrigger value="branding" className="gap-2">
            <Palette className="w-4 h-4" />
            Identidade
          </TabsTrigger>
          <TabsTrigger value="security" className="gap-2">
            <Shield className="w-4 h-4" />
            Segurança
          </TabsTrigger>
        </TabsList>

        <TabsContent value="integrations" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Integrações Typebot</CardTitle>
              <CardDescription>Configure os links dos fluxos do Typebot</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="typebot_girabot_url">GiraBot (IA Institucional)</Label>
                <Input
                  id="typebot_girabot_url"
                  type="url"
                  value={integrations.typebot_girabot_url}
                  onChange={(e) => setIntegrations({ ...integrations, typebot_girabot_url: e.target.value })}
                  placeholder="https://typebot.io/girabot"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chatbot principal de IA para responder dúvidas dos colaboradores
                </p>
              </div>
              <div>
                <Label htmlFor="typebot_support_url">Suporte</Label>
                <Input
                  id="typebot_support_url"
                  type="url"
                  value={integrations.typebot_support_url}
                  onChange={(e) => setIntegrations({ ...integrations, typebot_support_url: e.target.value })}
                  placeholder="https://typebot.io/suporte"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chatbot de atendimento e abertura de tickets
                </p>
              </div>
              <div>
                <Label htmlFor="typebot_midias_url">Mídias</Label>
                <Input
                  id="typebot_midias_url"
                  type="url"
                  value={integrations.typebot_midias_url}
                  onChange={(e) => setIntegrations({ ...integrations, typebot_midias_url: e.target.value })}
                  placeholder="https://typebot.io/midias"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chatbot para solicitação e entrega de materiais de marketing
                </p>
              </div>
              <div>
                <Label htmlFor="typebot_custom_url">Link Personalizado (Opcional)</Label>
                <Input
                  id="typebot_custom_url"
                  type="url"
                  value={integrations.typebot_custom_url}
                  onChange={(e) => setIntegrations({ ...integrations, typebot_custom_url: e.target.value })}
                  placeholder="https://typebot.io/seu-bot-customizado"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Quarto link web para uso adicional
                </p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>APIs Externas</CardTitle>
              <CardDescription>Chaves de integração com serviços externos</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {(!integrations.notion_api_key || !integrations.notion_database_id) && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Para usar a sincronização com o Notion, você precisa preencher a <strong>Notion API Key</strong> e o <strong>Notion Database ID</strong> abaixo, e depois clicar em <strong>Salvar Integrações</strong>.
                  </AlertDescription>
                </Alert>
              )}
              
              <div>
                <Label htmlFor="notion_api_key">Notion API Key</Label>
                <Input
                  id="notion_api_key"
                  type="password"
                  value={integrations.notion_api_key}
                  onChange={(e) => setIntegrations({ ...integrations, notion_api_key: e.target.value })}
                  placeholder="secret_..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  Chave de integração do Notion para sincronizar manuais e documentação
                </p>
              </div>
              <div>
                <Label htmlFor="notion_database_id">Notion Database ID</Label>
                <Input
                  id="notion_database_id"
                  type="text"
                  value={integrations.notion_database_id}
                  onChange={(e) => setIntegrations({ ...integrations, notion_database_id: e.target.value })}
                  placeholder="abc123..."
                />
                <p className="text-xs text-muted-foreground mt-1">
                  ID do banco de dados do Notion contendo os manuais
                </p>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={handleNotionSync}
                  disabled={syncing || !integrations.notion_api_key || !integrations.notion_database_id}
                  className="flex-1"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${syncing ? 'animate-spin' : ''}`} />
                  {syncing ? 'Sincronizando...' : 'Sincronizar Notion'}
                </Button>
                <Button
                  variant="outline"
                  onClick={handleReindexSearch}
                  disabled={reindexing}
                  className="flex-1"
                >
                  <RefreshCw className={`w-4 h-4 mr-2 ${reindexing ? 'animate-spin' : ''}`} />
                  {reindexing ? 'Reindexando...' : 'Reindexar Busca'}
                </Button>
              </div>
              <div>
                <Label htmlFor="zapi_token">Z-API Token (WhatsApp)</Label>
                <Input
                  id="zapi_token"
                  type="password"
                  value={integrations.zapi_token}
                  onChange={(e) => setIntegrations({ ...integrations, zapi_token: e.target.value })}
                  placeholder="Token da Z-API"
                />
              </div>
              <div>
                <Label htmlFor="resend_api_key">Resend API Key (E-mail)</Label>
                <Input
                  id="resend_api_key"
                  type="password"
                  value={integrations.resend_api_key}
                  onChange={(e) => setIntegrations({ ...integrations, resend_api_key: e.target.value })}
                  placeholder="re_..."
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveIntegrations} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Integrações'}
          </Button>
        </TabsContent>

        <TabsContent value="automation" className="space-y-4">
          <AutomationSettings />
        </TabsContent>

        <TabsContent value="mural" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Configurações do Mural Cresci e Perdi</CardTitle>
              <CardDescription>
                Configure a moderação por IA, notificações e integração com o Feed
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  O Mural permite que colaboradores compartilhem conquistas e peçam ajuda anonimamente, com moderação por IA.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mural-auto-approval" className="text-base">
                      Aprovação Automática via IA
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Posts são analisados e aprovados automaticamente pela IA
                    </p>
                  </div>
                  <Switch
                    id="mural-auto-approval"
                    checked={mural.mural_auto_approval_enabled}
                    onCheckedChange={(checked) => 
                      setMural({ ...mural, mural_auto_approval_enabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mural-notify" className="text-base">
                      Notificar ao Receber Resposta
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar notificação quando alguém responder ao post
                    </p>
                  </div>
                  <Switch
                    id="mural-notify"
                    checked={mural.mural_notify_on_reply}
                    onCheckedChange={(checked) => 
                      setMural({ ...mural, mural_notify_on_reply: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mural-feed" className="text-base">
                      Integração com Feed
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Posts aprovados aparecem no Feed principal
                    </p>
                  </div>
                  <Switch
                    id="mural-feed"
                    checked={mural.mural_feed_integration}
                    onCheckedChange={(checked) => 
                      setMural({ ...mural, mural_feed_integration: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="mural-allow-media" className="text-base">
                      Permitir Imagens
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Habilitar upload de imagens nas postagens
                    </p>
                  </div>
                  <Switch
                    id="mural-allow-media"
                    checked={mural.mural_allow_media}
                    onCheckedChange={(checked) => 
                      setMural({ ...mural, mural_allow_media: checked })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mural-sensitivity">
                    Sensibilidade da IA: {mural.mural_ai_sensitivity}
                  </Label>
                  <p className="text-sm text-muted-foreground mb-2">
                    Nível de rigor na moderação (1=permissivo, 5=rigoroso)
                  </p>
                  <Slider
                    id="mural-sensitivity"
                    min={1}
                    max={5}
                    step={1}
                    value={[mural.mural_ai_sensitivity]}
                    onValueChange={(value) => 
                      setMural({ ...mural, mural_ai_sensitivity: value[0] })
                    }
                    className="w-full"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mural-prompt-filter">Prompt de Anonimização</Label>
                  <Textarea
                    id="mural-prompt-filter"
                    value={mural.mural_ai_prompt_filter}
                    onChange={(e) => setMural({ ...mural, mural_ai_prompt_filter: e.target.value })}
                    placeholder="Instruções para a IA filtrar e anonimizar o conteúdo..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prompt usado para remover informações pessoais e dados sensíveis
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mural-prompt-validation">Prompt de Validação</Label>
                  <Textarea
                    id="mural-prompt-validation"
                    value={mural.mural_ai_prompt_validation}
                    onChange={(e) => setMural({ ...mural, mural_ai_prompt_validation: e.target.value })}
                    placeholder="Instruções para a IA validar e aprovar posts..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prompt usado para determinar se o post deve ser aprovado ou rejeitado
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="mural-prompt-moderation">Prompt de Moderação (Respostas)</Label>
                  <Textarea
                    id="mural-prompt-moderation"
                    value={mural.mural_ai_prompt_moderation}
                    onChange={(e) => setMural({ ...mural, mural_ai_prompt_moderation: e.target.value })}
                    placeholder="Instruções para a IA moderar e aprovar respostas aos posts..."
                    rows={4}
                  />
                  <p className="text-xs text-muted-foreground">
                    Prompt usado para avaliar se respostas são úteis, respeitosas e adequadas
                  </p>
                </div>

                <div className="space-y-3">
                  <div>
                    <Label className="text-base">Cargos com Permissão de Curadoria</Label>
                    <p className="text-sm text-muted-foreground">
                      Defina quem pode moderar manualmente posts e respostas
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {[
                      { value: 'admin', label: 'Administrador' },
                      { value: 'gestor_setor', label: 'Gestor de Setor' },
                      { value: 'colaborador', label: 'Colaborador' },
                    ].map((role) => (
                      <div key={role.value} className="flex items-center space-x-2">
                        <Switch
                          id={`role-${role.value}`}
                          checked={mural.mural_curator_roles.includes(role.value)}
                          onCheckedChange={() => handleMuralRoleToggle(role.value)}
                        />
                        <Label htmlFor={`role-${role.value}`} className="cursor-pointer">
                          {role.label}
                        </Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveMural} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Configurações do Mural'}
          </Button>
        </TabsContent>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Gestão de Usuários e Segurança</CardTitle>
              <CardDescription>
                Configure parâmetros de sessão, autenticação e monitoramento de usuários
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Integrações:</strong> Z-API notifica mudanças de permissão, GiraBot gera relatórios inteligentes, Feed notifica atividades importantes.
                </AlertDescription>
              </Alert>

              <div className="space-y-4">
                <div>
                  <Label htmlFor="session-timeout">Timeout de Sessão (minutos)</Label>
                  <Input
                    id="session-timeout"
                    type="number"
                    min="5"
                    max="1440"
                    value={userManagement.session_timeout}
                    onChange={(e) => setUserManagement({ ...userManagement, session_timeout: parseInt(e.target.value) || 60 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Tempo de inatividade antes de deslogar automaticamente (padrão: 60 minutos)
                  </p>
                </div>

                <div>
                  <Label htmlFor="max-failed-logins">Máximo de Tentativas de Login Falhadas</Label>
                  <Input
                    id="max-failed-logins"
                    type="number"
                    min="1"
                    max="10"
                    value={userManagement.max_failed_logins}
                    onChange={(e) => setUserManagement({ ...userManagement, max_failed_logins: parseInt(e.target.value) || 5 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Número de tentativas antes de bloquear temporariamente a conta (padrão: 5)
                  </p>
                </div>

                <div>
                  <Label htmlFor="activity-log-retention">Retenção de Logs de Atividade (dias)</Label>
                  <Input
                    id="activity-log-retention"
                    type="number"
                    min="7"
                    max="365"
                    value={userManagement.activity_log_retention_days}
                    onChange={(e) => setUserManagement({ ...userManagement, activity_log_retention_days: parseInt(e.target.value) || 90 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Quantos dias manter histórico de atividades dos usuários (padrão: 90 dias)
                  </p>
                </div>

                <div>
                  <Label htmlFor="inactive-threshold">Limite de Inatividade (dias)</Label>
                  <Input
                    id="inactive-threshold"
                    type="number"
                    min="7"
                    max="365"
                    value={userManagement.inactive_threshold_days}
                    onChange={(e) => setUserManagement({ ...userManagement, inactive_threshold_days: parseInt(e.target.value) || 30 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias sem login para considerar usuário inativo (padrão: 30 dias)
                  </p>
                </div>

                <div>
                  <Label htmlFor="auto-lock-days">Bloqueio Automático de Inativos (dias)</Label>
                  <Input
                    id="auto-lock-days"
                    type="number"
                    min="30"
                    max="365"
                    value={userManagement.auto_lock_inactive_days}
                    onChange={(e) => setUserManagement({ ...userManagement, auto_lock_inactive_days: parseInt(e.target.value) || 90 })}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Dias de inatividade antes de bloquear conta automaticamente (padrão: 90 dias)
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="multi-role" className="text-base">
                      Múltiplas Funções por Usuário
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Permitir que um usuário tenha mais de uma role (ex: colaborador + gestor)
                    </p>
                  </div>
                  <Switch
                    id="multi-role"
                    checked={userManagement.multi_role_enabled}
                    onCheckedChange={(checked) => 
                      setUserManagement({ ...userManagement, multi_role_enabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="require-2fa" className="text-base">
                      Exigir Autenticação de Dois Fatores (2FA)
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Obrigar todos os usuários a configurarem 2FA (em desenvolvimento)
                    </p>
                  </div>
                  <Switch
                    id="require-2fa"
                    checked={userManagement.require_2fa}
                    onCheckedChange={(checked) => 
                      setUserManagement({ ...userManagement, require_2fa: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="notify-inactive" className="text-base">
                      Notificar Usuários Inativos
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Enviar lembretes via WhatsApp para usuários que não acessam há tempo
                    </p>
                  </div>
                  <Switch
                    id="notify-inactive"
                    checked={userManagement.notify_inactive_users}
                    onCheckedChange={(checked) => 
                      setUserManagement({ ...userManagement, notify_inactive_users: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="permission-audit" className="text-base">
                      Auditoria de Permissões
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Registrar todas as mudanças de permissões e acessos
                    </p>
                  </div>
                  <Switch
                    id="permission-audit"
                    checked={userManagement.permission_audit_enabled}
                    onCheckedChange={(checked) => 
                      setUserManagement({ ...userManagement, permission_audit_enabled: checked })
                    }
                  />
                </div>

                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label htmlFor="security-alerts" className="text-base">
                      Alertas de Segurança
                    </Label>
                    <p className="text-sm text-muted-foreground">
                      Notificar admins sobre atividades suspeitas e tentativas de acesso
                    </p>
                  </div>
                  <Switch
                    id="security-alerts"
                    checked={userManagement.security_alerts_enabled}
                    onCheckedChange={(checked) => 
                      setUserManagement({ ...userManagement, security_alerts_enabled: checked })
                    }
                  />
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveUserManagement} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Configurações de Usuários'}
          </Button>
        </TabsContent>

        <TabsContent value="onboarding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Onboarding Automático</CardTitle>
              <CardDescription>
                Configure o sistema para associar automaticamente trilhas de treinamento aos novos colaboradores
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Como funciona:</strong> Quando um novo colaborador é cadastrado, o sistema identifica o cargo e automaticamente atribui a trilha correspondente, enviando notificações via WhatsApp e push interno.
                </AlertDescription>
              </Alert>

              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label htmlFor="onboarding-toggle" className="text-base">
                    Ativar Onboarding Automático
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    Habilita a atribuição automática de trilhas ao criar novos usuários
                  </p>
                </div>
                <Switch
                  id="onboarding-toggle"
                  checked={onboarding.onboarding_auto_assign}
                  onCheckedChange={(checked) => 
                    setOnboarding({ ...onboarding, onboarding_auto_assign: checked })
                  }
                />
              </div>

              <div className="space-y-4">
                <div>
                  <h4 className="font-semibold mb-3">Mapeamento de Cargos → Trilhas</h4>
                  <p className="text-sm text-muted-foreground mb-4">
                    Defina qual trilha será atribuída automaticamente para cada cargo
                  </p>
                </div>

                {[
                  { value: 'avaliadora', label: 'Avaliadora' },
                  { value: 'gerente', label: 'Gerente' },
                  { value: 'social_midia', label: 'Social Mídia' },
                  { value: 'operador_caixa', label: 'Operador de Caixa' },
                  { value: 'franqueado', label: 'Franqueado' },
                  { value: 'suporte', label: 'Equipe de Suporte' },
                ].map((role) => (
                  <div key={role.value} className="flex items-center gap-4">
                    <Label className="w-40 text-sm">{role.label}</Label>
                    <Select
                      value={onboarding.default_training_by_role[role.value] || ''}
                      onValueChange={(value) => handleRoleMappingChange(role.value, value)}
                    >
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="Selecione uma trilha..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">Nenhuma trilha</SelectItem>
                        {trainingPaths.map((path) => (
                          <SelectItem key={path.id} value={path.id}>
                            {path.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>

              {trainingPaths.length === 0 && (
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription>
                    Nenhuma trilha encontrada. Execute o script SQL em <strong>TRILHAS_SQL_SETUP.md</strong> primeiro.
                  </AlertDescription>
                </Alert>
              )}
            </CardContent>
          </Card>

          <Button onClick={handleSaveOnboarding} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Configurações de Onboarding'}
          </Button>
        </TabsContent>

        <TabsContent value="notifications" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>⚙️ Configurações de Notificações</CardTitle>
              <CardDescription>
                Configure canais, templates padrão e comportamento de notificações
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Canais de Comunicação */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Canais de Comunicação</h3>
                <div className="grid gap-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="zapi-enabled">WhatsApp (Z-API)</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar notificações via WhatsApp usando Z-API
                      </p>
                    </div>
                    <Switch
                      id="zapi-enabled"
                      checked={notifications.zapi_enabled}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, zapi_enabled: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="email-enabled">E-mail</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar notificações por e-mail
                      </p>
                    </div>
                    <Switch
                      id="email-enabled"
                      checked={notifications.email_enabled}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, email_enabled: checked })
                      }
                    />
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="push-enabled">Push Notifications</Label>
                      <p className="text-xs text-muted-foreground">
                        Enviar notificações push no navegador
                      </p>
                    </div>
                    <Switch
                      id="push-enabled"
                      checked={notifications.push_enabled}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, push_enabled: checked })
                      }
                    />
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Configurações de Retry */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Configurações de Retry</h3>
                <div className="grid gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="retry-attempts">
                      Tentativas de Reenvio: {notifications.zapi_retry_attempts}
                    </Label>
                    <Slider
                      id="retry-attempts"
                      min={1}
                      max={5}
                      step={1}
                      value={[notifications.zapi_retry_attempts]}
                      onValueChange={([value]) => 
                        setNotifications({ ...notifications, zapi_retry_attempts: value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Número de tentativas em caso de falha no envio
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="retry-delay">
                      Intervalo entre Tentativas: {notifications.zapi_retry_delay}s
                    </Label>
                    <Slider
                      id="retry-delay"
                      min={1}
                      max={60}
                      step={5}
                      value={[notifications.zapi_retry_delay]}
                      onValueChange={([value]) => 
                        setNotifications({ ...notifications, zapi_retry_delay: value })
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Tempo de espera entre cada tentativa de reenvio
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Templates Padrão */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Templates Padrão</h3>
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="template-welcome">Boas-vindas</Label>
                    <Textarea
                      id="template-welcome"
                      value={notifications.default_templates.welcome}
                      onChange={(e) => setNotifications({
                        ...notifications,
                        default_templates: {
                          ...notifications.default_templates,
                          welcome: e.target.value
                        }
                      })}
                      placeholder="Template de boas-vindas"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis: {`{{nome}}, {{email}}, {{unidade}}`}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-training">Lembrete de Treinamento</Label>
                    <Textarea
                      id="template-training"
                      value={notifications.default_templates.training_reminder}
                      onChange={(e) => setNotifications({
                        ...notifications,
                        default_templates: {
                          ...notifications.default_templates,
                          training_reminder: e.target.value
                        }
                      })}
                      placeholder="Template de lembrete"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="template-announcement">Comunicado</Label>
                    <Textarea
                      id="template-announcement"
                      value={notifications.default_templates.announcement}
                      onChange={(e) => setNotifications({
                        ...notifications,
                        default_templates: {
                          ...notifications.default_templates,
                          announcement: e.target.value
                        }
                      })}
                      placeholder="Template de comunicado"
                      rows={2}
                    />
                    <p className="text-xs text-muted-foreground">
                      Variáveis disponíveis: {`{{titulo}}, {{descricao}}, {{autor}}`}
                    </p>
                  </div>
                </div>
              </div>

              <div className="border-t border-border" />

              {/* Configurações de Relatórios */}
              <div className="space-y-4">
                <h3 className="text-sm font-semibold">Relatórios Automáticos</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label htmlFor="report-enabled">Relatórios Habilitados</Label>
                      <p className="text-xs text-muted-foreground">
                        Gerar relatórios automáticos de engajamento
                      </p>
                    </div>
                    <Switch
                      id="report-enabled"
                      checked={notifications.report_enabled}
                      onCheckedChange={(checked) => 
                        setNotifications({ ...notifications, report_enabled: checked })
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-frequency">Frequência</Label>
                    <select
                      id="report-frequency"
                      className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                      value={notifications.report_frequency}
                      onChange={(e) => 
                        setNotifications({ ...notifications, report_frequency: e.target.value })
                      }
                    >
                      <option value="daily">Diário</option>
                      <option value="weekly">Semanal</option>
                      <option value="monthly">Mensal</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="report-recipients">Destinatários (emails, separados por vírgula)</Label>
                    <Input
                      id="report-recipients"
                      value={notifications.report_recipients.join(', ')}
                      onChange={(e) => setNotifications({
                        ...notifications,
                        report_recipients: e.target.value.split(',').map(email => email.trim()).filter(Boolean)
                      })}
                      placeholder="admin@empresa.com, gestor@empresa.com"
                    />
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveNotifications} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : '💾 Salvar Configurações de Notificações'}
          </Button>
        </TabsContent>

        <TabsContent value="branding" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Identidade Visual</CardTitle>
              <CardDescription>Personalize as cores e marca da intranet</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="company_name">Nome da Empresa</Label>
                <Input
                  id="company_name"
                  value={branding.company_name}
                  onChange={(e) => setBranding({ ...branding, company_name: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="primary_color">Cor Primária</Label>
                <Input
                  id="primary_color"
                  type="color"
                  value={branding.primary_color}
                  onChange={(e) => setBranding({ ...branding, primary_color: e.target.value })}
                />
              </div>
              <div>
                <Label htmlFor="secondary_color">Cor Secundária</Label>
                <Input
                  id="secondary_color"
                  type="color"
                  value={branding.secondary_color}
                  onChange={(e) => setBranding({ ...branding, secondary_color: e.target.value })}
                />
              </div>
            </CardContent>
          </Card>

          <Button onClick={handleSaveBranding} disabled={saving} className="w-full">
            {saving ? 'Salvando...' : 'Salvar Identidade Visual'}
          </Button>
        </TabsContent>

        <TabsContent value="security" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Segurança e Auditoria</CardTitle>
              <CardDescription>Informações de segurança e conformidade</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Alert>
                <Shield className="h-4 w-4" />
                <AlertDescription>
                  <strong>RLS Ativo:</strong> Todas as tabelas possuem Row Level Security habilitado para proteção de dados.
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Políticas de Acesso</h4>
                <ul className="text-sm text-muted-foreground space-y-1">
                  <li>• Administradores: Acesso total ao sistema</li>
                  <li>• Gestores de Setor: Gerenciar conteúdos e relatórios</li>
                  <li>• Colaboradores: Acesso restrito aos próprios dados</li>
                </ul>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Logs do Sistema</h4>
                <p className="text-sm text-muted-foreground">
                  Todas as ações administrativas são registradas automaticamente. 
                  Consulte os logs através do painel do Supabase.
                </p>
              </div>

              <div className="space-y-2">
                <h4 className="font-semibold text-sm">Backup e Recuperação</h4>
                <p className="text-sm text-muted-foreground">
                  Backups automáticos são realizados diariamente pelo Supabase. 
                  Dados são mantidos em múltiplas regiões para redundância.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
