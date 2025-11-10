import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Save, Link as LinkIcon, FolderOpen } from 'lucide-react';
import { AdminTrainingCategories } from './AdminTrainingCategories';

export function AdminSettings() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const { toast } = useToast();

  // Settings state
  const [girabotUrl, setGirabotUrl] = useState('');
  const [supportUrl, setSupportUrl] = useState('');
  const [midiasUrl, setMidiasUrl] = useState('');
  const [companyName, setCompanyName] = useState('');

  useEffect(() => {
    fetchSettings();
  }, []);

  const fetchSettings = async () => {
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .in('key', ['typebot_girabot_url', 'typebot_support_url', 'typebot_midias_url', 'company_name']);

      if (error) throw error;

      data?.forEach((setting) => {
        const value = typeof setting.value === 'string' ? setting.value : JSON.stringify(setting.value);
        const cleanValue = value.replace(/^"|"$/g, '');
        
        switch (setting.key) {
          case 'typebot_girabot_url':
            setGirabotUrl(cleanValue);
            break;
          case 'typebot_support_url':
            setSupportUrl(cleanValue);
            break;
          case 'typebot_midias_url':
            setMidiasUrl(cleanValue);
            break;
          case 'company_name':
            setCompanyName(cleanValue);
            break;
        }
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar configurações',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const updates = [
        { key: 'typebot_girabot_url', value: JSON.stringify(girabotUrl) },
        { key: 'typebot_support_url', value: JSON.stringify(supportUrl) },
        { key: 'typebot_midias_url', value: JSON.stringify(midiasUrl) },
        { key: 'company_name', value: JSON.stringify(companyName) },
      ];

      for (const update of updates) {
        const { error } = await supabase
          .from('settings')
          .update({ value: update.value })
          .eq('key', update.key);

        if (error) throw error;
      }

      toast({
        title: 'Configurações salvas!',
        description: 'As alterações foram aplicadas com sucesso',
      });
    } catch (error: any) {
      toast({
        title: 'Erro ao salvar',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando configurações...</div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold mb-2">Configurações Globais</h2>
        <p className="text-muted-foreground">
          Configure os links dos Typebots e parâmetros da intranet
        </p>
      </div>

      <Tabs defaultValue="general" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="general">Informações Gerais</TabsTrigger>
          <TabsTrigger value="categories">
            <FolderOpen className="w-4 h-4 mr-2" />
            Categorias de Treinamento
          </TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="space-y-6 mt-6">
          <Card>
            <CardHeader>
              <CardTitle>Informações da Empresa</CardTitle>
              <CardDescription>Dados institucionais</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="company-name">Nome da Empresa</Label>
                <Input
                  id="company-name"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="Cresci e Perdi"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <LinkIcon className="w-5 h-5" />
                URLs dos Typebots
              </CardTitle>
              <CardDescription>
                Configure os links dos chatbots integrados
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="girabot-url">GiraBot (IA Institucional)</Label>
                <Input
                  id="girabot-url"
                  type="url"
                  value={girabotUrl}
                  onChange={(e) => setGirabotUrl(e.target.value)}
                  placeholder="https://typebot.io/seu-girabot"
                />
                <p className="text-xs text-muted-foreground">
                  Chatbot principal de IA para responder dúvidas dos colaboradores
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="support-url">Suporte</Label>
                <Input
                  id="support-url"
                  type="url"
                  value={supportUrl}
                  onChange={(e) => setSupportUrl(e.target.value)}
                  placeholder="https://typebot.io/seu-suporte"
                />
                <p className="text-xs text-muted-foreground">
                  Chatbot de atendimento e abertura de tickets
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="midias-url">Mídias</Label>
                <Input
                  id="midias-url"
                  type="url"
                  value={midiasUrl}
                  onChange={(e) => setMidiasUrl(e.target.value)}
                  placeholder="https://typebot.io/suas-midias"
                />
                <p className="text-xs text-muted-foreground">
                  Chatbot para solicitação e entrega de materiais de marketing
                </p>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="w-4 h-4 mr-2" />
              {saving ? 'Salvando...' : 'Salvar Configurações'}
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="mt-6">
          <AdminTrainingCategories />
        </TabsContent>
      </Tabs>
    </div>
  );
}
