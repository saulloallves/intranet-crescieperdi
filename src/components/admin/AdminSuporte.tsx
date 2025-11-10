import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Ticket, RefreshCw, CheckCircle, Clock, AlertCircle, Loader2 } from 'lucide-react';
import { toast } from '@/hooks/use-toast';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface SupportTicket {
  id: string;
  subject: string;
  category: string;
  description: string;
  status: string;
  priority: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

export function AdminSuporte() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [stats, setStats] = useState({ total: 0, open: 0, resolved: 0, pending: 0 });

  useEffect(() => {
    fetchTickets();
  }, []);

  const fetchTickets = async () => {
    try {
      const { data, error } = await supabase
        .from('support_tickets')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      setTickets(data || []);
      setStats({
        total: data?.length || 0,
        open: data?.filter(t => t.status === 'open').length || 0,
        resolved: data?.filter(t => t.status === 'resolved').length || 0,
        pending: data?.filter(t => t.status === 'pending').length || 0,
      });
    } catch (error) {
      console.error('Error fetching tickets:', error);
    } finally {
      setLoading(false);
    }
  };

  const syncTypebot = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke('typebot-sync');

      if (error) throw error;

      toast({
        title: 'Sincronização Concluída',
        description: `${data.stats.support.new} novos tickets importados`,
      });

      await fetchTickets();
    } catch (error: any) {
      toast({
        title: 'Erro na Sincronização',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSyncing(false);
    }
  };

  const updateTicketStatus = async (ticketId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from('support_tickets')
        .update({ 
          status: newStatus,
          resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null,
        })
        .eq('id', ticketId);

      if (error) throw error;

      toast({ title: 'Status Atualizado!' });
      await fetchTickets();
    } catch (error: any) {
      toast({
        title: 'Erro ao Atualizar',
        description: error.message,
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="flex items-center justify-center py-12">Carregando tickets...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold mb-2">Suporte (Typebot)</h2>
          <p className="text-muted-foreground">Tickets de suporte integrados via Typebot</p>
        </div>
        <Button onClick={syncTypebot} disabled={syncing}>
          {syncing ? (
            <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Sincronizando...</>
          ) : (
            <><RefreshCw className="w-4 h-4 mr-2" /> Sincronizar</>
          )}
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Total de Tickets</CardDescription>
              <Ticket className="w-4 h-4 text-muted-foreground" />
            </div>
            <CardTitle className="text-3xl">{stats.total}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Abertos</CardDescription>
              <AlertCircle className="w-4 h-4 text-orange-500" />
            </div>
            <CardTitle className="text-3xl text-orange-500">{stats.open}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Pendentes</CardDescription>
              <Clock className="w-4 h-4 text-yellow-500" />
            </div>
            <CardTitle className="text-3xl text-yellow-500">{stats.pending}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardDescription>Resolvidos</CardDescription>
              <CheckCircle className="w-4 h-4 text-green-500" />
            </div>
            <CardTitle className="text-3xl text-green-500">{stats.resolved}</CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="grid gap-4">
        {tickets.map((ticket) => (
          <Card key={ticket.id}>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Ticket className="w-5 h-5" />
                    <CardTitle className="text-base">{ticket.subject}</CardTitle>
                    <Badge variant="outline">{ticket.category}</Badge>
                    <Badge variant={
                      ticket.priority === 'high' ? 'destructive' :
                      ticket.priority === 'medium' ? 'default' : 'secondary'
                    }>
                      {ticket.priority}
                    </Badge>
                  </div>
                  <CardDescription className="mb-2">{ticket.description}</CardDescription>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{ticket.user_name} ({ticket.user_email})</span>
                    <span>{new Date(ticket.created_at).toLocaleString('pt-BR')}</span>
                  </div>
                </div>
                <Select
                  value={ticket.status}
                  onValueChange={(value) => updateTicketStatus(ticket.id, value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">Aberto</SelectItem>
                    <SelectItem value="pending">Pendente</SelectItem>
                    <SelectItem value="resolved">Resolvido</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardHeader>
          </Card>
        ))}

        {tickets.length === 0 && (
          <Card>
            <CardContent className="py-12 text-center">
              <Ticket className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground">
                Nenhum ticket encontrado. Clique em "Sincronizar" para importar do Typebot.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}