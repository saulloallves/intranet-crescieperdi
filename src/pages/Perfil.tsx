import { useState, useEffect } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { LogOut, Mail, Building, Shield, Phone, FileText, MessageSquare, Upload, History, Key, Edit } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { PermissionViewer } from '@/components/admin/PermissionViewer';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface LoginHistory {
  id: string;
  timestamp: string;
  ip_address: string;
  user_agent: string;
  action: string;
}

export default function Perfil() {
  const { profile, signOut } = useAuth();
  const [whatsappEnabled, setWhatsappEnabled] = useState(profile?.receive_whatsapp_notifications || false);
  const [updating, setUpdating] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [loginHistory, setLoginHistory] = useState<LoginHistory[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [editing, setEditing] = useState(false);
  const [editedName, setEditedName] = useState(profile?.full_name || '');

  const getRoleBadge = (role: string) => {
    const badges = {
      admin: { label: 'Administrador', variant: 'default' as const },
      gestor_setor: { label: 'Gestor de Setor', variant: 'secondary' as const },
      franqueado: { label: 'Franqueado', variant: 'secondary' as const },
      gerente: { label: 'Gerente', variant: 'outline' as const },
      colaborador: { label: 'Colaborador', variant: 'outline' as const },
    };

    return badges[role as keyof typeof badges] || badges.colaborador;
  };

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url);
    }
  }, [profile]);

  const fetchLoginHistory = async () => {
    if (!profile?.id) return;
    
    setLoadingHistory(true);
    try {
      const { data, error } = await supabase.functions.invoke('user-activity-monitoring', {
        body: {
          action: 'get_activity_logs',
          user_id: profile.id,
          limit: 10,
        },
      });

      if (error) throw error;
      setLoginHistory(data.logs || []);
    } catch (error: any) {
      console.error('Error fetching login history:', error);
      toast.error('Erro ao carregar histórico');
    } finally {
      setLoadingHistory(false);
    }
  };

  const handleAvatarUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !profile?.id) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      toast.error('Imagem muito grande. Máximo 2MB');
      return;
    }

    setUploading(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${profile.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      const { error: updateError } = await supabase
        .from('profiles')
        .update({ avatar_url: publicUrl })
        .eq('id', profile.id);

      if (updateError) throw updateError;

      setAvatarUrl(publicUrl);
      toast.success('Foto atualizada com sucesso!');
    } catch (error: any) {
      console.error('Error uploading avatar:', error);
      toast.error('Erro ao fazer upload da foto');
    } finally {
      setUploading(false);
    }
  };

  const handleUpdateName = async () => {
    if (!profile?.id || !editedName.trim()) return;

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editedName })
        .eq('id', profile.id);

      if (error) throw error;

      toast.success('Nome atualizado com sucesso!');
      setEditing(false);
    } catch (error: any) {
      console.error('Error updating name:', error);
      toast.error('Erro ao atualizar nome');
    } finally {
      setUpdating(false);
    }
  };

  const handleWhatsappToggle = async (checked: boolean) => {
    if (!profile?.phone) {
      toast.error('Adicione um número de WhatsApp primeiro', {
        description: 'Entre em contato com o administrador para atualizar seu perfil.',
      });
      return;
    }

    setUpdating(true);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ receive_whatsapp_notifications: checked })
        .eq('id', profile.id);

      if (error) throw error;

      setWhatsappEnabled(checked);
      toast.success(
        checked 
          ? 'Notificações WhatsApp ativadas!' 
          : 'Notificações WhatsApp desativadas'
      );
    } catch (error: any) {
      console.error('Error updating WhatsApp preference:', error);
      toast.error('Erro ao atualizar preferência');
    } finally {
      setUpdating(false);
    }
  };

  const roleBadge = getRoleBadge(profile?.role || 'colaborador');

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <h1 className="text-3xl font-bold mb-6">Meu Perfil</h1>

        <Tabs defaultValue="profile" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="profile">Perfil</TabsTrigger>
            <TabsTrigger value="permissions">Permissões</TabsTrigger>
            <TabsTrigger value="history" onClick={fetchLoginHistory}>Histórico</TabsTrigger>
          </TabsList>

          <TabsContent value="profile" className="space-y-6">
            <Card className="card-elevated">
              <CardContent className="pt-6">
                <div className="flex flex-col items-center text-center mb-6">
                  <div className="relative mb-4">
                    <Avatar className="w-24 h-24">
                      {avatarUrl && <AvatarImage src={avatarUrl} alt={profile?.full_name} />}
                      <AvatarFallback className="gradient-primary text-white text-3xl">
                        {profile?.full_name?.charAt(0) || 'U'}
                      </AvatarFallback>
                    </Avatar>
                    <label htmlFor="avatar-upload" className="absolute bottom-0 right-0 p-2 bg-primary text-primary-foreground rounded-full cursor-pointer hover:bg-primary/90 transition-colors">
                      <Upload className="w-4 h-4" />
                      <input
                        id="avatar-upload"
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handleAvatarUpload}
                        disabled={uploading}
                      />
                    </label>
                  </div>
                  
                  <div className="flex items-center gap-2 mb-2">
                    {editing ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editedName}
                          onChange={(e) => setEditedName(e.target.value)}
                          className="w-64"
                        />
                        <Button size="sm" onClick={handleUpdateName} disabled={updating}>
                          Salvar
                        </Button>
                        <Button size="sm" variant="outline" onClick={() => setEditing(false)}>
                          Cancelar
                        </Button>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-2xl font-bold">{profile?.full_name}</h2>
                        <Button size="sm" variant="ghost" onClick={() => setEditing(true)}>
                          <Edit className="w-4 h-4" />
                        </Button>
                      </>
                    )}
                  </div>
                  
                  <Badge variant={roleBadge.variant} className="mb-4">
                    {roleBadge.label}
                  </Badge>
                </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Mail className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Email</p>
                  <p className="font-medium">{profile?.email}</p>
                </div>
              </div>

              {profile?.cpf && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <FileText className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">CPF</p>
                    <p className="font-medium">{profile.cpf}</p>
                  </div>
                </div>
              )}

              {profile?.phone && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Phone className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">WhatsApp</p>
                    <p className="font-medium">{profile.phone}</p>
                  </div>
                </div>
              )}

              {profile?.unit_code && (
                <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                  <Building className="w-5 h-5 text-muted-foreground" />
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">Unidade</p>
                    <p className="font-medium">{profile.unit_code}</p>
                  </div>
                </div>
              )}

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Shield className="w-5 h-5 text-muted-foreground" />
                <div className="flex-1">
                  <p className="text-sm text-muted-foreground">Status</p>
                  <p className="font-medium">
                    {profile?.is_active ? 'Ativo' : 'Inativo'}
                  </p>
                </div>
              </div>
                </div>
              </CardContent>
            </Card>

            <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5" />
              Preferências de Notificação
            </CardTitle>
            <CardDescription>
              Configure como deseja receber notificações do sistema
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between">
              <div className="space-y-0.5">
                <Label htmlFor="whatsapp-notifications">
                  Notificações via WhatsApp
                </Label>
                <p className="text-sm text-muted-foreground">
                  Receber notificações e alertas via WhatsApp
                </p>
                {!profile?.phone && (
                  <p className="text-xs text-orange-500 mt-1">
                    ⚠️ Adicione um número de WhatsApp ao seu perfil para ativar
                  </p>
                )}
              </div>
              <Switch
                id="whatsapp-notifications"
                checked={whatsappEnabled}
                onCheckedChange={handleWhatsappToggle}
                disabled={updating || !profile?.phone}
              />
            </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Ações</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <Button
                  variant="destructive"
                  className="w-full"
                  onClick={signOut}
                >
                  <LogOut className="w-4 h-4 mr-2" />
                  Sair da conta
                </Button>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="permissions">
            <PermissionViewer userId={profile?.id} />
          </TabsContent>

          <TabsContent value="history">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <History className="w-5 h-5" />
                  Histórico de Logins
                </CardTitle>
                <CardDescription>
                  Últimos 10 acessos à plataforma
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loadingHistory ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Carregando histórico...
                  </div>
                ) : loginHistory.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    Nenhum registro de login encontrado
                  </div>
                ) : (
                  <div className="space-y-4">
                    {loginHistory.map((log) => (
                      <div key={log.id} className="flex items-start gap-3 p-4 bg-muted/50 rounded-lg">
                        <Shield className="w-5 h-5 text-muted-foreground mt-0.5" />
                        <div className="flex-1">
                          <p className="font-medium">{log.action}</p>
                          <p className="text-sm text-muted-foreground">
                            {format(new Date(log.timestamp), "dd/MM/yyyy 'às' HH:mm", { locale: ptBR })}
                          </p>
                          {log.ip_address && (
                            <p className="text-xs text-muted-foreground mt-1">
                              IP: {log.ip_address}
                            </p>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
