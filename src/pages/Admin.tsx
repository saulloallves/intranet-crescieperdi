import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AdminDashboard } from '@/components/admin/AdminDashboard';
import { AdminComunicados } from '@/components/admin/AdminComunicados';
import { AdminSettings } from '@/components/admin/AdminSettings';
import { AutomationSettings } from '@/components/admin/AutomationSettings';
import { AdminUsers } from '@/components/admin/AdminUsers';
import { AdminTreinamentos } from '@/components/admin/AdminTreinamentos';
import { AdminChecklists } from '@/components/admin/AdminChecklists';
import AdminChecklistReports from '@/components/admin/AdminChecklistReports';
import { AdminManuais } from '@/components/admin/AdminManuais';
import { AdminSuporte } from '@/components/admin/AdminSuporte';
import { AdminGiraBot } from '@/components/admin/AdminGiraBot';
import { AdminMidias } from '@/components/admin/AdminMidias';
import { AdminReconhecimento } from '@/components/admin/AdminReconhecimento';
import { AdminIdeiasNew } from '@/components/admin/AdminIdeiasNew';
import { AdminCampanhas } from '@/components/admin/AdminCampanhas';
import { AdminNotificacoesAdvanced } from '@/components/admin/AdminNotificacoesAdvanced';
import { AdminBusca } from '@/components/admin/AdminBusca';
import { AdminCrossConfig } from '@/components/admin/AdminCrossConfig';
import { AdminZAPI } from '@/components/admin/AdminZAPI';
import { AdminPesquisas } from '@/components/admin/AdminPesquisas';
import AdminFeed from '@/components/admin/AdminFeed';
import { AdminConteudosObrigatorios } from '@/components/admin/AdminConteudosObrigatorios';
import { MandatoryContentDashboard } from '@/components/admin/MandatoryContentDashboard';
import { AdminTrainingPaths } from '@/components/admin/AdminTrainingPaths';
import { AdminMural } from '@/components/admin/AdminMural';
import {
  BarChart3,
  Megaphone, 
  Settings, 
  Users, 
  GraduationCap,
  ClipboardCheck,
  BookOpen,
  Headphones,
  Bot,
  Image,
  Award,
  Lightbulb,
  Target,
  Bell,
  Search,
  Sliders,
  MessageSquare,
  BarChart, 
  FileText,
  Zap,
  FileCheck,
  Route,
  Heart
} from 'lucide-react';

export default function Admin() {
  const { isAdmin, isGestor, loading } = useAuth();
  const navigate = useNavigate();
  const isDevMode = import.meta.env.VITE_DEV_MODE === 'true';

  useEffect(() => {
    // Dev mode: permitir acesso sem verificação
    if (isDevMode) return;
    
    if (!loading && !isAdmin && !isGestor) {
      navigate('/dashboard');
    }
  }, [isAdmin, isGestor, loading, navigate, isDevMode]);

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  // Dev mode: permitir acesso
  if (!isDevMode && !isAdmin && !isGestor) {
    return null;
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-screen-xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Painel Administrativo</h1>
          <p className="text-muted-foreground">
            Gerencie comunicados, usuários e configurações da intranet
          </p>
        </div>

        {/* Admin Tabs */}
        <Tabs defaultValue="dashboard" className="w-full">
          <TabsList className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-10 gap-2 h-auto p-2">
            <TabsTrigger value="dashboard" className="gap-2">
              <BarChart3 className="w-4 h-4" />
              <span className="text-xs">Dashboard</span>
            </TabsTrigger>
            <TabsTrigger value="comunicados" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="text-xs">Comunicados</span>
            </TabsTrigger>
            <TabsTrigger value="feed" className="gap-2">
              <Megaphone className="w-4 h-4" />
              <span className="text-xs">Feed</span>
            </TabsTrigger>
            <TabsTrigger value="treinamentos" className="gap-2">
              <GraduationCap className="w-4 h-4" />
              <span className="text-xs">Treinamentos</span>
            </TabsTrigger>
            <TabsTrigger value="trilhas" className="gap-2">
              <Route className="w-4 h-4" />
              <span className="text-xs">Trilhas</span>
            </TabsTrigger>
            <TabsTrigger value="checklists" className="gap-2">
              <ClipboardCheck className="w-4 h-4" />
              <span className="text-xs">Checklists</span>
            </TabsTrigger>
            <TabsTrigger value="relatorios" className="gap-2">
              <FileText className="w-4 h-4" />
              <span className="text-xs">Relatórios</span>
            </TabsTrigger>
            <TabsTrigger value="manuais" className="gap-2">
              <BookOpen className="w-4 h-4" />
              <span className="text-xs">Manuais</span>
            </TabsTrigger>
            <TabsTrigger value="suporte" className="gap-2">
              <Headphones className="w-4 h-4" />
              <span className="text-xs">Suporte</span>
            </TabsTrigger>
            <TabsTrigger value="girabot" className="gap-2">
              <Bot className="w-4 h-4" />
              <span className="text-xs">GiraBot</span>
            </TabsTrigger>
            <TabsTrigger value="midias" className="gap-2">
              <Image className="w-4 h-4" />
              <span className="text-xs">Mídias</span>
            </TabsTrigger>
            <TabsTrigger value="reconhecimento" className="gap-2">
              <Award className="w-4 h-4" />
              <span className="text-xs">Reconhecimento</span>
            </TabsTrigger>
            <TabsTrigger value="ideias" className="gap-2">
              <Lightbulb className="w-4 h-4" />
              <span className="text-xs">Ideias</span>
            </TabsTrigger>
            <TabsTrigger value="campanhas" className="gap-2">
              <Target className="w-4 h-4" />
              <span className="text-xs">Campanhas</span>
            </TabsTrigger>
            <TabsTrigger value="notificacoes" className="gap-2">
              <Bell className="w-4 h-4" />
              <span className="text-xs">Notificações</span>
            </TabsTrigger>
            <TabsTrigger value="busca" className="gap-2">
              <Search className="w-4 h-4" />
              <span className="text-xs">Busca</span>
            </TabsTrigger>
            <TabsTrigger value="pesquisas" className="gap-2">
              <BarChart className="w-4 h-4" />
              <span className="text-xs">Pesquisas</span>
            </TabsTrigger>
            <TabsTrigger value="users" className="gap-2">
              <Users className="w-4 h-4" />
              <span className="text-xs">Usuários</span>
            </TabsTrigger>
            <TabsTrigger value="crossconfig" className="gap-2">
              <Sliders className="w-4 h-4" />
              <span className="text-xs">CrossConfig</span>
            </TabsTrigger>
            <TabsTrigger value="zapi" className="gap-2">
              <MessageSquare className="w-4 h-4" />
              <span className="text-xs">Z-API</span>
            </TabsTrigger>
            <TabsTrigger value="settings" className="gap-2">
              <Settings className="w-4 h-4" />
              <span className="text-xs">Configurações</span>
            </TabsTrigger>
            <TabsTrigger value="automations" className="gap-2">
              <Zap className="w-4 h-4" />
              <span className="text-xs">Automações</span>
            </TabsTrigger>
            <TabsTrigger value="conteudos-obrigatorios" className="gap-2">
              <FileCheck className="w-4 h-4" />
              <span className="text-xs">Conteúdos Obrigatórios</span>
            </TabsTrigger>
            <TabsTrigger value="mural" className="gap-2">
              <Heart className="w-4 h-4" />
              <span className="text-xs">Mural</span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="dashboard" className="mt-6">
            <AdminDashboard />
          </TabsContent>

          <TabsContent value="comunicados" className="mt-6">
            <AdminComunicados />
          </TabsContent>

          <TabsContent value="feed" className="mt-6">
            <AdminFeed />
          </TabsContent>

          <TabsContent value="treinamentos" className="mt-6">
            <AdminTreinamentos />
          </TabsContent>

          <TabsContent value="trilhas" className="mt-6">
            <AdminTrainingPaths />
          </TabsContent>

          <TabsContent value="checklists" className="mt-6">
            <AdminChecklists />
          </TabsContent>

          <TabsContent value="relatorios" className="mt-6">
            <AdminChecklistReports />
          </TabsContent>

          <TabsContent value="manuais" className="mt-6">
            <AdminManuais />
          </TabsContent>

          <TabsContent value="suporte" className="mt-6">
            <AdminSuporte />
          </TabsContent>

          <TabsContent value="girabot" className="mt-6">
            <AdminGiraBot />
          </TabsContent>

          <TabsContent value="midias" className="mt-6">
            <AdminMidias />
          </TabsContent>

          <TabsContent value="reconhecimento" className="mt-6">
            <AdminReconhecimento />
          </TabsContent>

          <TabsContent value="ideias" className="mt-6">
            <AdminIdeiasNew />
          </TabsContent>

          <TabsContent value="campanhas" className="mt-6">
            <AdminCampanhas />
          </TabsContent>

          <TabsContent value="notificacoes" className="mt-6">
            <AdminNotificacoesAdvanced />
          </TabsContent>

          <TabsContent value="busca" className="mt-6">
            <AdminBusca />
          </TabsContent>

          <TabsContent value="pesquisas" className="mt-6">
            <AdminPesquisas />
          </TabsContent>

          <TabsContent value="users" className="mt-6">
            <AdminUsers />
          </TabsContent>

          <TabsContent value="crossconfig" className="mt-6">
            <AdminCrossConfig />
          </TabsContent>

          <TabsContent value="zapi" className="mt-6">
            <AdminZAPI />
          </TabsContent>

          <TabsContent value="settings" className="mt-6">
            <AdminSettings />
          </TabsContent>

          <TabsContent value="automations" className="mt-6">
            <AutomationSettings />
          </TabsContent>

          <TabsContent value="conteudos-obrigatorios" className="mt-6">
            <Tabs defaultValue="gerenciar">
              <TabsList>
                <TabsTrigger value="gerenciar">Gerenciar</TabsTrigger>
                <TabsTrigger value="dashboard">Dashboard</TabsTrigger>
              </TabsList>
              <TabsContent value="gerenciar" className="mt-6">
                <AdminConteudosObrigatorios />
              </TabsContent>
              <TabsContent value="dashboard" className="mt-6">
                <MandatoryContentDashboard />
              </TabsContent>
            </Tabs>
          </TabsContent>

          <TabsContent value="mural" className="mt-6">
            <AdminMural />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
