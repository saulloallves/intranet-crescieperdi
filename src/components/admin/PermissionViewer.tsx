import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { 
  Shield, 
  Check, 
  X, 
  Lock, 
  Unlock, 
  AlertCircle,
  MessageSquare,
  Send
} from 'lucide-react';
import { 
  permissionIcons, 
  permissionLabels, 
  permissionColors,
  systemModules 
} from '@/lib/userManagement';

interface Permission {
  module: string;
  access_level: string;
  description?: string;
}

interface PermissionViewerProps {
  userId?: string;
}

const MODULE_DESCRIPTIONS: Record<string, { name: string; description: string; icon: React.ReactNode }> = {
  feed: {
    name: 'Feed',
    description: 'Visualizar e interagir com posts do feed',
    icon: <MessageSquare className="w-4 h-4" />
  },
  mural: {
    name: 'Mural',
    description: 'Criar posts e responder no mural colaborativo',
    icon: <MessageSquare className="w-4 h-4" />
  },
  treinamentos: {
    name: 'Treinamentos',
    description: 'Acessar módulos de treinamento e certificações',
    icon: <Shield className="w-4 h-4" />
  },
  ideias: {
    name: 'Ideias',
    description: 'Enviar e votar em ideias de melhoria',
    icon: <Shield className="w-4 h-4" />
  },
  reconhecimento: {
    name: 'Reconhecimento',
    description: 'Visualizar e enviar reconhecimentos',
    icon: <Shield className="w-4 h-4" />
  },
  campanhas: {
    name: 'Campanhas',
    description: 'Participar de campanhas da empresa',
    icon: <Shield className="w-4 h-4" />
  },
  checklists: {
    name: 'Checklists',
    description: 'Preencher e acompanhar checklists',
    icon: <Shield className="w-4 h-4" />
  },
  manuais: {
    name: 'Manuais',
    description: 'Consultar manuais e documentações',
    icon: <Shield className="w-4 h-4" />
  },
  comunicados: {
    name: 'Comunicados',
    description: 'Receber comunicados da empresa',
    icon: <Shield className="w-4 h-4" />
  },
  pesquisas: {
    name: 'Pesquisas',
    description: 'Responder pesquisas de clima e opinião',
    icon: <Shield className="w-4 h-4" />
  },
  midias: {
    name: 'Mídias',
    description: 'Acessar biblioteca de mídias',
    icon: <Shield className="w-4 h-4" />
  },
  admin: {
    name: 'Administração',
    description: 'Acesso total ao painel administrativo',
    icon: <Shield className="w-4 h-4" />
  },
};

export function PermissionViewer({ userId }: PermissionViewerProps) {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);
  const [requestMessage, setRequestMessage] = useState('');
  const [showRequestForm, setShowRequestForm] = useState(false);

  useEffect(() => {
    fetchPermissions();
  }, [userId]);

  const fetchPermissions = async () => {
    if (!userId) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-permissions-management', {
        body: {
          action: 'get_user_permissions',
          user_id: userId,
        },
      });

      if (error) throw error;
      setPermissions(data.permissions || []);
    } catch (error: any) {
      console.error('Error fetching permissions:', error);
      toast.error('Erro ao carregar permissões');
    } finally {
      setLoading(false);
    }
  };

  const getAccessLevelBadge = (level: string): { 
    emoji: string; 
    label: string; 
    colorClass: string; 
    variant: 'default' | 'destructive' | 'outline' | 'secondary' 
  } => {
    const colorClass = permissionColors[level as keyof typeof permissionColors] || permissionColors.none;
    const label = permissionLabels[level as keyof typeof permissionLabels] || permissionLabels.none;
    const emoji = permissionIcons[level as keyof typeof permissionIcons] || permissionIcons.none;
    
    let variant: 'default' | 'destructive' | 'outline' | 'secondary' = 'outline';
    if (level === 'admin') variant = 'destructive';
    else if (level === 'write') variant = 'default';
    else if (level === 'read') variant = 'secondary';
    
    return { emoji, label, colorClass, variant };
  };

  const handleRequestPermission = async () => {
    if (!requestMessage.trim()) {
      toast.error('Por favor, descreva qual permissão você precisa');
      return;
    }

    setRequesting(true);
    try {
      // Log the permission request
      await supabase.functions.invoke('user-activity-monitoring', {
        body: {
          action: 'log_activity',
          user_id: userId,
          action_type: 'permission_request',
          details: { message: requestMessage },
        },
      });

      toast.success('Solicitação enviada com sucesso!');
      setRequestMessage('');
      setShowRequestForm(false);
    } catch (error: any) {
      console.error('Error requesting permission:', error);
      toast.error('Erro ao enviar solicitação');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="text-center py-8 text-muted-foreground">
            Carregando permissões...
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <Lock className="w-5 h-5" />
            Minhas Permissões
          </CardTitle>
          <CardDescription className="text-sm">
            Visualize seus níveis de acesso aos módulos da plataforma
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Object.entries(systemModules).map(([module, name]) => {
              const permission = permissions.find(p => p.module === module);
              const accessLevel = permission?.access_level || 'none';
              const badge = getAccessLevelBadge(accessLevel);

              return (
                <div
                  key={module}
                  className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3 md:p-4 bg-muted/50 rounded-lg hover:bg-muted/70 transition-colors"
                >
                  <div className="flex items-start gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0 mt-0.5">
                      <span className="text-base">{badge.emoji}</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="font-medium text-sm md:text-base truncate">{name}</h4>
                      <p className="text-xs md:text-sm text-muted-foreground">
                        {MODULE_DESCRIPTIONS[module]?.description || `Acesso ao módulo ${name}`}
                      </p>
                    </div>
                  </div>
                  <Badge 
                    variant={badge.variant} 
                    className={`flex-shrink-0 border ${badge.colorClass} text-xs`}
                  >
                    {badge.emoji} {badge.label}
                  </Badge>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-lg md:text-xl">
            <AlertCircle className="w-5 h-5" />
            Solicitar Permissão
          </CardTitle>
          <CardDescription className="text-sm">
            Precisa de acesso a algum módulo? Solicite ao administrador
          </CardDescription>
        </CardHeader>
        <CardContent>
          {!showRequestForm ? (
            <Button onClick={() => setShowRequestForm(true)} className="w-full">
              <Send className="w-4 h-4 mr-2" />
              Nova Solicitação
            </Button>
          ) : (
            <div className="space-y-4">
              <Textarea
                placeholder="Descreva qual permissão você precisa e o motivo..."
                value={requestMessage}
                onChange={(e) => setRequestMessage(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex flex-col sm:flex-row gap-2">
                <Button 
                  onClick={handleRequestPermission} 
                  disabled={requesting}
                  className="w-full sm:w-auto sm:flex-1"
                >
                  <Send className="w-4 h-4 mr-2" />
                  {requesting ? 'Enviando...' : 'Enviar Solicitação'}
                </Button>
                <Button 
                  variant="outline" 
                  onClick={() => {
                    setShowRequestForm(false);
                    setRequestMessage('');
                  }}
                  className="w-full sm:w-auto"
                >
                  Cancelar
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card className="border-orange-200 bg-orange-50/50 dark:bg-orange-950/20">
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm">
              <p className="font-medium text-orange-900 dark:text-orange-100 mb-2">
                Sobre os níveis de acesso
              </p>
              <ul className="space-y-1.5 text-orange-800 dark:text-orange-200">
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0">{permissionIcons.admin}</span>
                  <span><strong>{permissionLabels.admin}:</strong> Acesso completo com permissões de gerenciamento</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0">{permissionIcons.write}</span>
                  <span><strong>{permissionLabels.write}:</strong> Pode visualizar e criar/editar conteúdo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0">{permissionIcons.read}</span>
                  <span><strong>{permissionLabels.read}:</strong> Pode apenas visualizar o conteúdo</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="flex-shrink-0">{permissionIcons.none}</span>
                  <span><strong>{permissionLabels.none}:</strong> Sem acesso ao módulo</span>
                </li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
