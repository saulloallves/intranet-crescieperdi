import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Target, Trophy, TrendingUp, Calendar } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  goal_value: number;
  goal_unit: string;
  start_date: string;
  end_date: string;
  progress?: number;
}

interface UserStats {
  user_id: string;
  full_name: string;
  avatar_url: string | null;
  total_value: number;
  campaign_count: number;
  progress: number;
  campaigns: { id: string; title: string; type: string; value: number }[];
}

export default function Campanhas() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [userStats, setUserStats] = useState<UserStats[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      // Fetch campaigns
      const { data: campaignsData, error: campaignsError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('is_active', true)
        .order('start_date', { ascending: false });

      if (campaignsError) throw campaignsError;

      // Calculate progress for each campaign
      const campaignsWithProgress = await Promise.all(
        (campaignsData || []).map(async (campaign) => {
          const { data: results } = await supabase
            .from('campaign_results')
            .select('value')
            .eq('campaign_id', campaign.id);

          const totalValue = results?.reduce((sum, r) => sum + Number(r.value), 0) || 0;
          const progress = campaign.goal_value > 0 ? (totalValue / Number(campaign.goal_value)) * 100 : 0;

          return {
            ...campaign,
            progress: Math.min(progress, 100),
          };
        })
      );

      setCampaigns(campaignsWithProgress);

      // Fetch user stats
      const { data: resultsData, error: resultsError } = await supabase
        .from('campaign_results')
        .select(`
          user_id,
          value,
          campaign_id,
          campaigns (id, title, type, goal_value)
        `);

      if (resultsError) throw resultsError;

      // Fetch profiles
      const { data: profilesData } = await supabase
        .from('profiles')
        .select('id, full_name, avatar_url');

      // Group by user
      const userStatsMap = new Map<string, UserStats>();
      
      resultsData?.forEach((result: any) => {
        const userId = result.user_id;
        if (!userId) return;

        if (!userStatsMap.has(userId)) {
          const profile = profilesData?.find(p => p.id === userId);
          userStatsMap.set(userId, {
            user_id: userId,
            full_name: profile?.full_name || 'Usuário',
            avatar_url: profile?.avatar_url || null,
            total_value: 0,
            campaign_count: 0,
            progress: 0,
            campaigns: [],
          });
        }

        const userStat = userStatsMap.get(userId)!;
        userStat.total_value += Number(result.value);
        
        const campaignId = result.campaign_id;
        const existingCampaign = userStat.campaigns.find(c => c.id === campaignId);
        
        if (existingCampaign) {
          existingCampaign.value += Number(result.value);
        } else {
          userStat.campaigns.push({
            id: campaignId,
            title: result.campaigns?.title || '',
            type: result.campaigns?.type || '',
            value: Number(result.value),
          });
          userStat.campaign_count++;
        }
      });

      // Calculate average progress for each user
      const stats = Array.from(userStatsMap.values()).map(stat => {
        const totalGoal = stat.campaigns.reduce((sum, c) => {
          const campaign = campaignsWithProgress.find(cp => cp.id === c.id);
          return sum + (campaign?.goal_value || 0);
        }, 0);
        
        stat.progress = totalGoal > 0 ? (stat.total_value / totalGoal) * 100 : 0;
        return stat;
      });

      // Sort by total value
      stats.sort((a, b) => b.total_value - a.total_value);
      setUserStats(stats);

    } catch (error: any) {
      toast({
        title: 'Erro ao carregar dados',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const isActive = (campaign: Campaign) => {
    const now = new Date();
    const endDate = new Date(campaign.end_date);
    return now <= endDate;
  };

  if (loading) {
    return (
      <AppLayout>
        <div className="flex items-center justify-center min-h-[50vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout>
      <div className="container mx-auto px-4 py-6 max-w-4xl">
        <div className="mb-6">
          <h1 className="text-3xl font-bold mb-2">Campanhas e Missões</h1>
          <p className="text-muted-foreground">
            Acompanhe metas e desafios ativos
          </p>
        </div>

        {/* Hero Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6 text-center">
              <Target className="w-8 h-8 mx-auto mb-2 text-primary" />
              <p className="text-2xl font-bold">{campaigns.length}</p>
              <p className="text-xs text-muted-foreground">Campanhas Ativas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Trophy className="w-8 h-8 mx-auto mb-2 text-yellow-500" />
              <p className="text-2xl font-bold">
                {campaigns.filter((c) => (c.progress || 0) >= 100).length}
              </p>
              <p className="text-xs text-muted-foreground">Metas Atingidas</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <TrendingUp className="w-8 h-8 mx-auto mb-2 text-green-500" />
              <p className="text-2xl font-bold">
                {Math.round(
                  campaigns.reduce((sum, c) => sum + (c.progress || 0), 0) / (campaigns.length || 1)
                )}%
              </p>
              <p className="text-xs text-muted-foreground">Progresso Médio</p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6 text-center">
              <Calendar className="w-8 h-8 mx-auto mb-2 text-secondary" />
              <p className="text-2xl font-bold">
                {campaigns.filter((c) => isActive(c)).length}
              </p>
              <p className="text-xs text-muted-foreground">Em Andamento</p>
            </CardContent>
          </Card>
        </div>

        {/* User Rankings */}
        {userStats.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold mb-4">Ranking de Desempenho</h2>
            <p className="text-muted-foreground mb-4">
              Compare seu progresso com outros usuários
            </p>
            <div className="space-y-4">
              {userStats.map((user, index) => (
                <Card key={user.user_id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="text-2xl font-bold text-muted-foreground w-8">
                          #{index + 1}
                        </div>
                        <Avatar className="w-12 h-12">
                          <AvatarImage src={user.avatar_url || undefined} />
                          <AvatarFallback className="bg-primary text-primary-foreground">
                            {user.full_name?.charAt(0).toUpperCase() || 'U'}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1">
                          <h3 className="font-semibold">{user.full_name}</h3>
                          <p className="text-sm text-muted-foreground">
                            {user.campaign_count} {user.campaign_count === 1 ? 'campanha' : 'campanhas'}
                          </p>
                        </div>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground">
                        <Target className="w-6 h-6" />
                      </div>
                    </div>
                    <div className="mt-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-semibold">
                          {Math.round(user.progress)}%
                        </span>
                      </div>
                      <Progress value={Math.min(user.progress, 100)} className="h-3" />
                    </div>
                    {user.campaigns.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {user.campaigns.map((campaign) => (
                          <Badge key={campaign.id} variant="secondary" className="text-xs">
                            {campaign.type}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Campaigns List */}
        {campaigns.length === 0 ? (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Target className="w-12 h-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground text-center">
                Nenhuma campanha ativa no momento
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Campanhas Ativas</h2>
            {campaigns.map((campaign) => {
              const active = isActive(campaign);
              const daysLeft = formatDistanceToNow(new Date(campaign.end_date), {
                addSuffix: true,
                locale: ptBR,
              });

              return (
                <Card key={campaign.id} className="card-elevated">
                  <CardHeader>
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge variant={active ? 'default' : 'secondary'}>
                            {active ? 'Ativa' : 'Encerrada'}
                          </Badge>
                          <Badge variant="outline">{campaign.type}</Badge>
                        </div>
                        <CardTitle className="mb-2">{campaign.title}</CardTitle>
                        <CardDescription>{campaign.description}</CardDescription>
                      </div>
                      <div className="w-12 h-12 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center text-primary-foreground">
                        <Target className="w-6 h-6" />
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <div className="flex items-center justify-between text-sm mb-2">
                        <span className="text-muted-foreground">Progresso</span>
                        <span className="font-semibold">
                          {Math.round(campaign.progress || 0)}% de {campaign.goal_value} {campaign.goal_unit}
                        </span>
                      </div>
                      <Progress value={campaign.progress || 0} className="h-3" />
                    </div>
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-4 h-4" />
                        Termina {daysLeft}
                      </div>
                      {(campaign.progress || 0) >= 100 && (
                        <Badge className="bg-green-500">
                          <Trophy className="w-3 h-3 mr-1" />
                          Meta atingida!
                        </Badge>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
