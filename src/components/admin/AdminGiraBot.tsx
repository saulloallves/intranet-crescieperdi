import { useState } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { GiraBotAnalytics } from './girabot/GiraBotAnalytics';
import { GiraBotCuration } from './girabot/GiraBotCuration';
import { GiraBotSettings } from './girabot/GiraBotSettings';
import { GiraBotReports } from './girabot/GiraBotReports';
import { Bot, BarChart3, BookOpen, Settings, FileText } from 'lucide-react';

export function AdminGiraBot() {
  const [activeTab, setActiveTab] = useState('analytics');

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Bot className="w-8 h-8 text-primary" />
        <div>
          <h2 className="text-3xl font-bold">Painel de Controle do GiraBot</h2>
          <p className="text-muted-foreground">
            Analytics, relatórios, curadoria e configurações avançadas
          </p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="analytics" className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4" />
            Analytics
          </TabsTrigger>
          <TabsTrigger value="reports" className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Relatórios
          </TabsTrigger>
          <TabsTrigger value="curation" className="flex items-center gap-2">
            <BookOpen className="w-4 h-4" />
            Curadoria
          </TabsTrigger>
          <TabsTrigger value="settings" className="flex items-center gap-2">
            <Settings className="w-4 h-4" />
            Configurações
          </TabsTrigger>
        </TabsList>

        <TabsContent value="analytics" className="mt-6">
          <GiraBotAnalytics />
        </TabsContent>

        <TabsContent value="reports" className="mt-6">
          <GiraBotReports />
        </TabsContent>

        <TabsContent value="curation" className="mt-6">
          <GiraBotCuration />
        </TabsContent>

        <TabsContent value="settings" className="mt-6">
          <GiraBotSettings />
        </TabsContent>
      </Tabs>
    </div>
  );
}