import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Trash2, Target } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { CreateCampaignDialog } from './CreateCampaignDialog';

interface Campaign {
  id: string;
  title: string;
  description: string;
  type: string;
  start_date: string;
  end_date: string;
  goal_value: number;
  goal_unit: string;
  is_active: boolean;
  created_at: string;
}

export function AdminCampanhas() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchCampaigns();
  }, []);

  const fetchCampaigns = async () => {
    try {
      const { data, error } = await supabase
        .from('campaigns')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setCampaigns(data || []);
    } catch (error) {
      console.error('Erro ao buscar campanhas:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta campanha?')) return;

    try {
      const { error } = await supabase.from('campaigns').delete().eq('id', id);

      if (error) throw error;

      toast({
        title: 'Campanha excluída',
        description: 'A campanha foi removida com sucesso.',
      });
      fetchCampaigns();
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível excluir a campanha.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando campanhas...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Gerenciar Campanhas</h2>
          <p className="text-muted-foreground">Metas e desafios corporativos</p>
        </div>
        <CreateCampaignDialog onSuccess={fetchCampaigns} />
      </div>

      <div className="grid gap-4">
        {campaigns.map((campaign) => (
          <Card key={campaign.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Target className="w-5 h-5" />
                    <CardTitle>{campaign.title}</CardTitle>
                    <Badge variant={campaign.is_active ? 'default' : 'secondary'}>
                      {campaign.is_active ? 'Ativa' : 'Inativa'}
                    </Badge>
                    <Badge variant="outline">{campaign.type}</Badge>
                  </div>
                  <CardDescription>{campaign.description}</CardDescription>
                </div>
                <div className="flex gap-2">
                  <Button variant="destructive" size="icon" onClick={() => handleDelete(campaign.id)}>
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-4 text-sm text-muted-foreground">
                <span>Meta: {campaign.goal_value} {campaign.goal_unit}</span>
                <span>• {new Date(campaign.start_date).toLocaleDateString()} - {new Date(campaign.end_date).toLocaleDateString()}</span>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
