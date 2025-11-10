import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PermissionMatrix } from "@/components/admin/PermissionMatrix";
import { UserActivityLogs } from "@/components/admin/UserActivityLogs";
import { UserSecurityDashboard } from "@/components/admin/UserSecurityDashboard";
import { Shield, Activity, Lock, Key } from "lucide-react";

export default function AdminUsersSecurity() {
  const [activeTab, setActiveTab] = useState("security");

  return (
    <AppLayout>
      <div className="container mx-auto py-6 space-y-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">Segurança e Permissões</h1>
          <p className="text-muted-foreground">
            Gerencie permissões, monitore atividades e garanta a segurança do sistema
          </p>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="security" className="flex items-center gap-2">
              <Shield className="h-4 w-4" />
              Segurança
            </TabsTrigger>
            <TabsTrigger value="permissions" className="flex items-center gap-2">
              <Key className="h-4 w-4" />
              Permissões
            </TabsTrigger>
            <TabsTrigger value="logs" className="flex items-center gap-2">
              <Activity className="h-4 w-4" />
              Logs de Atividade
            </TabsTrigger>
          </TabsList>

          <TabsContent value="security" className="space-y-6">
            <UserSecurityDashboard />
          </TabsContent>

          <TabsContent value="permissions" className="space-y-6">
            <PermissionMatrix />
          </TabsContent>

          <TabsContent value="logs" className="space-y-6">
            <UserActivityLogs />
          </TabsContent>
        </Tabs>
      </div>
    </AppLayout>
  );
}
