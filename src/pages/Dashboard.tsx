import { useAuth } from '@/contexts/AuthContext';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { GraduationCap, ClipboardCheck, BookOpen, Award, Lightbulb, Target, Image, Rss } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

const modules = [
  {
    icon: Rss,
    title: 'Feed',
    description: 'Timeline de novidades',
    path: '/feed',
    color: 'from-orange-500 to-orange-600',
    available: true,
  },
  {
    icon: GraduationCap,
    title: 'Treinamentos',
    description: 'Cursos e capacitações',
    path: '/treinamentos',
    color: 'from-blue-500 to-blue-600',
    available: true,
  },
  {
    icon: ClipboardCheck,
    title: 'Checklists',
    description: 'Rotinas da loja',
    path: '/checklists',
    color: 'from-green-500 to-green-600',
    available: true,
  },
  {
    icon: BookOpen,
    title: 'Manuais',
    description: 'Documentação e FAQs',
    path: '/manuais',
    color: 'from-purple-500 to-purple-600',
    available: true,
  },
  {
    icon: Award,
    title: 'Reconhecimento',
    description: 'Destaques e cultura',
    path: '/reconhecimento',
    color: 'from-yellow-500 to-yellow-600',
    available: true,
  },
  {
    icon: Lightbulb,
    title: 'Ideias',
    description: 'Sugestões e melhorias',
    path: '/ideias',
    color: 'from-pink-500 to-pink-600',
    available: true,
  },
  {
    icon: Target,
    title: 'Campanhas',
    description: 'Missões e metas',
    path: '/campanhas',
    color: 'from-red-500 to-red-600',
    available: true,
  },
  {
    icon: Image,
    title: 'Mídias',
    description: 'Materiais criativos',
    path: '/midias',
    color: 'from-indigo-500 to-indigo-600',
    available: true,
  },
];

export default function Dashboard() {
  const { profile, user } = useAuth();
  const [metrics, setMetrics] = useState({
    announcements: 0,
    trainings: 0,
    checklists: 0,
    campaigns: 0,
  });

  useEffect(() => {
    const fetchMetrics = async () => {
      if (!user) return;

      try {
        // Fetch unread announcements count
        const { count: announcementsCount } = await supabase
          .from('announcements')
          .select('*', { count: 'exact', head: true })
          .eq('is_published', true);

        // Fetch pending trainings (not completed by user)
        const { data: completedTrainings } = await supabase
          .from('training_progress')
          .select('training_id')
          .eq('user_id', user.id)
          .eq('completed', true);

        const completedIds = completedTrainings?.map(t => t.training_id) || [];
        
        const { count: trainingsCount } = await supabase
          .from('trainings')
          .select('*', { count: 'exact', head: true })
          .eq('is_published', true)
          .not('id', 'in', `(${completedIds.join(',') || 'null'})`);

        // Fetch today's checklists
        const { count: checklistsCount } = await supabase
          .from('checklists')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true)
          .eq('frequency', 'daily');

        // Fetch active campaigns
        const { count: campaignsCount } = await supabase
          .from('campaigns')
          .select('*', { count: 'exact', head: true })
          .eq('is_active', true);

        setMetrics({
          announcements: announcementsCount || 0,
          trainings: trainingsCount || 0,
          checklists: checklistsCount || 0,
          campaigns: campaignsCount || 0,
        });
      } catch (error) {
        console.error('Error fetching metrics:', error);
      }
    };

    fetchMetrics();
  }, [user]);

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-screen-xl">
        {/* Welcome Section */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">
            Bem-vindo de volta, {profile?.full_name?.split(' ')[0]}! 👋
          </h1>
          <p className="text-muted-foreground">
            {profile?.role === 'admin' ? 'Administrador Geral' : 
             profile?.role === 'gestor_setor' ? 'Gestor de Setor' :
             profile?.role === 'franqueado' ? 'Franqueado' :
             profile?.role === 'gerente' ? 'Gerente' : 'Colaborador'}
            {profile?.unit_code && ` • ${profile.unit_code}`}
          </p>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{metrics.announcements}</CardTitle>
              <CardDescription>Comunicados publicados</CardDescription>
            </CardHeader>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{metrics.trainings}</CardTitle>
              <CardDescription>Treinamentos pendentes</CardDescription>
            </CardHeader>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{metrics.checklists}</CardTitle>
              <CardDescription>Checklists do dia</CardDescription>
            </CardHeader>
          </Card>
          <Card className="card-elevated">
            <CardHeader className="pb-2">
              <CardTitle className="text-2xl font-bold">{metrics.campaigns}</CardTitle>
              <CardDescription>Campanhas ativas</CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* Modules Grid */}
        <div>
          <h2 className="text-xl font-semibold mb-4">Módulos da Intranet</h2>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {modules.map((module) => {
              const Icon = module.icon;
              return (
                <Card
                  key={module.path}
                  className="card-elevated cursor-pointer transition-all hover:scale-105"
                  onClick={() => window.location.href = module.path}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center gap-3">
                    <div className={`w-12 h-12 rounded-full bg-gradient-to-br ${module.color} flex items-center justify-center`}>
                      <Icon className="w-6 h-6 text-white" />
                    </div>
                    <div>
                      <h3 className="font-semibold">{module.title}</h3>
                      <p className="text-xs text-muted-foreground">{module.description}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        {/* GiraBot CTA */}
        <Card className="mt-8 gradient-secondary text-white">
          <CardContent className="p-6">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center">
                <span className="text-2xl">🤖</span>
              </div>
              <div className="flex-1">
                <h3 className="text-xl font-bold mb-1">Precisa de ajuda?</h3>
                <p className="text-white/90 text-sm">
                  Converse com o GiraBot, nossa IA institucional, para tirar dúvidas!
                </p>
              </div>
              <Link
                to="/girabot"
                className="px-6 py-3 bg-white text-secondary rounded-lg font-semibold hover:bg-white/90 transition-colors"
              >
                Conversar
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
}
