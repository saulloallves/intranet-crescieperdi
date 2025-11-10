import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { 
  Bot, 
  Settings, 
  MessageSquare, 
  TrendingUp, 
  Database,
  Save,
  RefreshCw,
  BarChart3,
  Users,
  Clock
} from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';

interface AISettings {
  [key: string]: string;
}

interface AISession {
  id: string;
  user_id: string;
  module: string;
  question: string;
  response: string;
  tokens_used: number;
  feedback: string | null;
  created_at: string;
  profiles?: { full_name: string; role: string };
}

interface FAQ {
  id: string;
  question: string;
  answer: string;
  context: string;
  active: boolean;
}

export default function AdminGiraBotAdvanced() {
  const [settings, setSettings] = useState<AISettings>({});
  const [sessions, setSessions] = useState<AISession[]>([]);
  const [faqs, setFaqs] = useState<FAQ[]>([]);
  const [loading, setLoading] = useState(false);
  const [newFaq, setNewFaq] = useState({ question: '', answer: '', context: 'general' });
  const { toast } = useToast();

  useEffect(() => {
    loadSettings();
    loadSessions();
    loadFAQs();
  }, []);

  const loadSettings = async () => {
    try {
      const { data } = await supabase
        .from('ai_settings' as any)
        .select('param, value');
      
      const settingsMap: AISettings = {};
      data?.forEach((s: any) => settingsMap[s.param] = s.value);
      setSettings(settingsMap);
    } catch (error) {
      console.log('Tables not yet created - migration pending');
    }
  };

  const loadSessions = async () => {
    try {
      const { data } = await supabase
        .from('ai_sessions' as any)
        .select(`
          *,
          profiles:user_id (full_name, role)
        `)
        .order('created_at', { ascending: false })
        .limit(50);
      
      setSessions((data as any) || []);
    } catch (error) {
      console.log('Tables not yet created - migration pending');
    }
  };

  const loadFAQs = async () => {
    try {
      const { data } = await supabase
        .from('faq_training' as any)
        .select('*')
        .order('context', { ascending: true });
      
      setFaqs((data as any) || []);
    } catch (error) {
      console.log('Tables not yet created - migration pending');
    }
  };

  const saveSettings = async () => {
    setLoading(true);
    try {
      for (const [param, value] of Object.entries(settings)) {
        await supabase
          .from('ai_settings' as any)
          .upsert({ param, value }, { onConflict: 'param' });
      }
      toast({
        title: 'Configurações salvas',
        description: 'As configurações do GiraBot foram atualizadas.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível salvar as configurações. Certifique-se que a migration foi executada.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const addFAQ = async () => {
    if (!newFaq.question || !newFaq.answer) {
      toast({
        title: 'Campos obrigatórios',
        description: 'Preencha pergunta e resposta.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);
    try {
      await supabase
        .from('faq_training' as any)
        .insert({
          question: newFaq.question,
          answer: newFaq.answer,
          context: newFaq.context,
          active: true
        });
      
      setNewFaq({ question: '', answer: '', context: 'general' });
      loadFAQs();
      toast({
        title: 'FAQ adicionada',
        description: 'Nova pergunta frequente registrada.',
      });
    } catch (error) {
      toast({
        title: 'Erro',
        description: 'Não foi possível adicionar a FAQ. Certifique-se que a migration foi executada.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const toggleFAQ = async (id: string, active: boolean) => {
    try {
      await supabase
        .from('faq_training' as any)
        .update({ active: !active })
        .eq('id', id);
      loadFAQs();
    } catch (error) {
      console.log('Error toggling FAQ');
    }
  };

  const getModuleStats = () => {
    const stats: Record<string, number> = {};
    sessions.forEach(s => {
      stats[s.module] = (stats[s.module] || 0) + 1;
    });
    return Object.entries(stats).sort((a, b) => b[1] - a[1]);
  };

  const getTotalTokens = () => {
    return sessions.reduce((sum, s) => sum + (s.tokens_used || 0), 0);
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-3">
            <div className="w-12 h-12 rounded-full gradient-secondary flex items-center justify-center">
              <Bot className="w-6 h-6 text-secondary-foreground" />
            </div>
            GiraBot Avançado
          </h1>
          <p className="text-muted-foreground mt-1">
            Configurações, monitoramento e curadoria da IA institucional
          </p>
        </div>
        <Button onClick={loadSessions} variant="outline">
          <RefreshCw className="w-4 h-4 mr-2" />
          Atualizar
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Total Interações</p>
                <p className="text-2xl font-bold">{sessions.length}</p>
              </div>
              <MessageSquare className="w-8 h-8 text-secondary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Tokens Usados</p>
                <p className="text-2xl font-bold">{getTotalTokens().toLocaleString()}</p>
              </div>
              <TrendingUp className="w-8 h-8 text-accent" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">FAQs Ativas</p>
                <p className="text-2xl font-bold">{faqs.filter(f => f.active).length}</p>
              </div>
              <Database className="w-8 h-8 text-primary" />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-muted-foreground">Feedbacks Positivos</p>
                <p className="text-2xl font-bold">
                  {sessions.filter(s => s.feedback === 'positive').length}
                </p>
              </div>
              <BarChart3 className="w-8 h-8 text-chart-4" />
            </div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="settings" className="space-y-4">
        <TabsList>
          <TabsTrigger value="settings">
            <Settings className="w-4 h-4 mr-2" />
            Configurações
          </TabsTrigger>
          <TabsTrigger value="sessions">
            <MessageSquare className="w-4 h-4 mr-2" />
            Interações
          </TabsTrigger>
          <TabsTrigger value="faqs">
            <Database className="w-4 h-4 mr-2" />
            FAQs
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="w-4 h-4 mr-2" />
            Analytics
          </TabsTrigger>
        </TabsList>

        <TabsContent value="settings">
          <Card>
            <CardHeader>
              <CardTitle>Configurações da IA</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Temperatura (0-1)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    max="1"
                    value={settings.girabot_temperature || '0.7'}
                    onChange={(e) => setSettings({...settings, girabot_temperature: e.target.value})}
                  />
                </div>

                <div className="space-y-2">
                  <Label>Contexto (tokens)</Label>
                  <Input
                    type="number"
                    value={settings.global_context_depth || '4000'}
                    onChange={(e) => setSettings({...settings, global_context_depth: e.target.value})}
                  />
                </div>

                <div className="flex items-center justify-between col-span-2">
                  <Label>Integração com Busca Global</Label>
                  <Switch
                    checked={settings.connect_with_search === 'true'}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, connect_with_search: checked ? 'true' : 'false'})
                    }
                  />
                </div>

                <div className="flex items-center justify-between col-span-2">
                  <Label>Ajuda Contextual Ativa</Label>
                  <Switch
                    checked={settings.contextual_help_enabled === 'true'}
                    onCheckedChange={(checked) => 
                      setSettings({...settings, contextual_help_enabled: checked ? 'true' : 'false'})
                    }
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label>Prompt Institucional</Label>
                <Textarea
                  rows={4}
                  value={settings.girabot_context_prompt || ''}
                  onChange={(e) => setSettings({...settings, girabot_context_prompt: e.target.value})}
                  placeholder="Você é o GiraBot, assistente da Cresci e Perdi..."
                />
              </div>

              <Button onClick={saveSettings} disabled={loading} className="gradient-secondary">
                <Save className="w-4 h-4 mr-2" />
                Salvar Configurações
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sessions">
          <Card>
            <CardHeader>
              <CardTitle>Histórico de Interações</CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Módulo</TableHead>
                    <TableHead>Pergunta</TableHead>
                    <TableHead>Tokens</TableHead>
                    <TableHead>Feedback</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sessions.map((session) => (
                    <TableRow key={session.id}>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Users className="w-4 h-4 text-muted-foreground" />
                          <div>
                            <p className="text-sm font-medium">{session.profiles?.full_name}</p>
                            <p className="text-xs text-muted-foreground">{session.profiles?.role}</p>
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{session.module}</Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate">
                        {session.question}
                      </TableCell>
                      <TableCell>{session.tokens_used}</TableCell>
                      <TableCell>
                        {session.feedback && (
                          <Badge variant={session.feedback === 'positive' ? 'default' : 'destructive'}>
                            {session.feedback}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="w-3 h-3" />
                          {new Date(session.created_at).toLocaleString('pt-BR')}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faqs">
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Adicionar Nova FAQ</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label>Pergunta</Label>
                  <Input
                    value={newFaq.question}
                    onChange={(e) => setNewFaq({...newFaq, question: e.target.value})}
                    placeholder="Como funciona o módulo de treinamentos?"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Resposta</Label>
                  <Textarea
                    rows={3}
                    value={newFaq.answer}
                    onChange={(e) => setNewFaq({...newFaq, answer: e.target.value})}
                    placeholder="O módulo de treinamentos permite..."
                  />
                </div>
                <div className="space-y-2">
                  <Label>Contexto/Módulo</Label>
                  <Input
                    value={newFaq.context}
                    onChange={(e) => setNewFaq({...newFaq, context: e.target.value})}
                    placeholder="training"
                  />
                </div>
                <Button onClick={addFAQ} disabled={loading} className="gradient-primary">
                  Adicionar FAQ
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>FAQs Cadastradas ({faqs.length})</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {faqs.map((faq) => (
                    <div key={faq.id} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">{faq.context}</Badge>
                            <Badge variant={faq.active ? 'default' : 'secondary'}>
                              {faq.active ? 'Ativa' : 'Inativa'}
                            </Badge>
                          </div>
                          <p className="font-medium text-sm">{faq.question}</p>
                          <p className="text-sm text-muted-foreground mt-1">{faq.answer}</p>
                        </div>
                        <Switch
                          checked={faq.active}
                          onCheckedChange={() => toggleFAQ(faq.id, faq.active)}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="analytics">
          <Card>
            <CardHeader>
              <CardTitle>Analytics por Módulo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {getModuleStats().map(([module, count]) => (
                  <div key={module} className="flex items-center justify-between p-3 border rounded-lg">
                    <div className="flex items-center gap-3">
                      <Badge variant="outline">{module}</Badge>
                      <p className="text-sm text-muted-foreground">
                        {count} interações
                      </p>
                    </div>
                    <div className="w-32 h-2 bg-muted rounded-full overflow-hidden">
                      <div 
                        className="h-full gradient-secondary"
                        style={{ width: `${(count / sessions.length) * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
