import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Save, RotateCcw, Shield, Lock, Eye, Edit3 } from "lucide-react";
import { 
  permissionIcons, 
  permissionLabels, 
  permissionColors,
  roleColors,
  roleLabels,
  systemModules,
  getPermissionIcon,
  getPermissionLabel,
  getPermissionColor
} from '@/lib/userManagement';

type AccessLevel = 'none' | 'read' | 'write' | 'admin';

interface Permission {
  id: string;
  role: string;
  module: string;
  access_level: AccessLevel;
}

const ACCESS_LEVELS: { value: AccessLevel; label: string; icon: any }[] = [
  { value: 'none', label: permissionLabels.none, icon: Lock },
  { value: 'read', label: permissionLabels.read, icon: Eye },
  { value: 'write', label: permissionLabels.write, icon: Edit3 },
  { value: 'admin', label: permissionLabels.admin, icon: Shield },
];

export function PermissionMatrix() {
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [matrix, setMatrix] = useState<Record<string, Record<string, AccessLevel>>>({});
  const [roles, setRoles] = useState<string[]>([]);
  const [modules, setModules] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changes, setChanges] = useState<Map<string, { role: string; module: string; level: AccessLevel }>>(new Map());
  const { toast } = useToast();

  useEffect(() => {
    loadPermissions();
  }, []);

  const loadPermissions = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase.functions.invoke('user-permissions-management', {
        body: { action: 'get_matrix' }
      });

      if (error) throw error;

      setMatrix(data.matrix);
      setRoles(data.roles);
      setModules(data.modules);

      // Flatten permissions for easier access
      const perms: Permission[] = [];
      Object.entries(data.matrix).forEach(([role, mods]) => {
        Object.entries(mods as Record<string, AccessLevel>).forEach(([module, level]) => {
          perms.push({ id: `${role}-${module}`, role, module, access_level: level });
        });
      });
      setPermissions(perms);
    } catch (error) {
      console.error('Error loading permissions:', error);
      toast({
        title: "Erro ao carregar permissões",
        description: "Não foi possível carregar a matriz de permissões.",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handlePermissionChange = (role: string, module: string, newLevel: AccessLevel) => {
    // Update local matrix
    setMatrix(prev => ({
      ...prev,
      [role]: {
        ...prev[role],
        [module]: newLevel,
      }
    }));

    // Track change
    const key = `${role}-${module}`;
    setChanges(prev => new Map(prev).set(key, { role, module, level: newLevel }));
  };

  const saveChanges = async () => {
    if (changes.size === 0) {
      toast({
        title: "Nenhuma alteração",
        description: "Não há alterações para salvar.",
      });
      return;
    }

    try {
      setSaving(true);

      // Find permission IDs and prepare updates
      const updates = Array.from(changes.values()).map(change => {
        const perm = permissions.find(p => p.role === change.role && p.module === change.module);
        return {
          id: perm?.id,
          role: change.role,
          module: change.module,
          access_level: change.level,
        };
      });

      // Separate creates and updates
      const toUpdate = updates.filter(u => u.id);
      const toCreate = updates.filter(u => !u.id);

      // Batch update existing
      if (toUpdate.length > 0) {
        const { error } = await supabase.functions.invoke('user-permissions-management', {
          body: {
            action: 'bulk_update',
            updates: toUpdate.map(u => ({ id: u.id, access_level: u.access_level }))
          }
        });

        if (error) throw error;
      }

      // Create new permissions
      for (const perm of toCreate) {
        const { error } = await supabase.functions.invoke('user-permissions-management', {
          body: {
            action: 'create',
            role: perm.role,
            module: perm.module,
            access_level: perm.access_level,
          }
        });

        if (error) throw error;
      }

      toast({
        title: "Permissões atualizadas",
        description: `${changes.size} permissão(ões) atualizada(s) com sucesso.`,
      });

      setChanges(new Map());
      loadPermissions();
    } catch (error) {
      console.error('Error saving permissions:', error);
      toast({
        title: "Erro ao salvar",
        description: "Não foi possível salvar as alterações.",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const resetChanges = () => {
    setChanges(new Map());
    loadPermissions();
    toast({
      title: "Alterações descartadas",
      description: "Matriz de permissões resetada.",
    });
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Matriz de Permissões</CardTitle>
            <CardDescription>
              Gerencie permissões de acesso por papel e módulo
            </CardDescription>
          </div>
          <div className="flex gap-2">
            {changes.size > 0 && (
              <>
                <Badge variant="secondary">{changes.size} alterações pendentes</Badge>
                <Button variant="outline" size="sm" onClick={resetChanges}>
                  <RotateCcw className="h-4 w-4 mr-2" />
                  Descartar
                </Button>
                <Button size="sm" onClick={saveChanges} disabled={saving}>
                  {saving ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4 mr-2" />
                  )}
                  Salvar
                </Button>
              </>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Legend */}
        <div className="mb-6 flex flex-wrap gap-3">
          {ACCESS_LEVELS.map(level => {
            const Icon = level.icon;
            return (
              <div key={level.value} className="flex items-center gap-2">
                <span className="text-lg">{getPermissionIcon(level.value)}</span>
                <Icon className="h-4 w-4" />
                <span className="text-sm">{level.label}</span>
              </div>
            );
          })}
        </div>

        {/* Matrix Table - Responsive */}
        <div className="overflow-x-auto -mx-2 sm:mx-0">
          <div className="inline-block min-w-full align-middle">
            <div className="overflow-hidden border rounded-lg">
              <table className="min-w-full divide-y divide-border">
                <thead className="bg-muted/50">
                  <tr>
                    <th className="px-3 py-3 text-left text-xs font-semibold text-foreground min-w-[150px] sticky left-0 bg-muted/50 z-10">
                      Módulo / Papel
                    </th>
                    {roles.map(role => (
                      <th key={role} className="px-3 py-3 text-center text-xs font-semibold text-foreground min-w-[140px]">
                        <div className={`inline-block px-2 py-1 rounded-md ${roleColors[role as keyof typeof roleColors]}`}>
                          {roleLabels[role as keyof typeof roleLabels] || role}
                        </div>
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border bg-background">
                  {modules.map((module, idx) => (
                    <tr key={module} className={idx % 2 === 0 ? 'bg-muted/20' : 'bg-background'}>
                      <td className="px-3 py-3 font-medium text-sm capitalize sticky left-0 bg-inherit z-10">
                        {systemModules[module as keyof typeof systemModules] || module.replace(/_/g, ' ')}
                      </td>
                      {roles.map(role => {
                        const currentLevel = matrix[role]?.[module] || 'none';
                        const hasChange = changes.has(`${role}-${module}`);
                        const Icon = ACCESS_LEVELS.find(l => l.value === currentLevel)?.icon || Lock;

                        return (
                          <td key={`${role}-${module}`} className="px-2 py-2">
                            <Select
                              value={currentLevel}
                              onValueChange={(value) => handlePermissionChange(role, module, value as AccessLevel)}
                            >
                              <SelectTrigger className={`w-full text-xs ${hasChange ? 'ring-2 ring-primary' : ''} ${getPermissionColor(currentLevel)}`}>
                                <SelectValue>
                                  <div className="flex items-center gap-1.5">
                                    <span className="text-sm">{getPermissionIcon(currentLevel)}</span>
                                    <Icon className="h-3 w-3" />
                                    <span className="hidden sm:inline">{getPermissionLabel(currentLevel)}</span>
                                  </div>
                                </SelectValue>
                              </SelectTrigger>
                              <SelectContent>
                                {ACCESS_LEVELS.map(level => {
                                  const LevelIcon = level.icon;
                                  return (
                                    <SelectItem key={level.value} value={level.value}>
                                      <div className="flex items-center gap-2">
                                        <span>{getPermissionIcon(level.value)}</span>
                                        <LevelIcon className="h-3 w-3" />
                                        <span>{level.label}</span>
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {modules.length === 0 && (
          <div className="text-center py-12 text-muted-foreground">
            Nenhuma permissão encontrada
          </div>
        )}
      </CardContent>
    </Card>
  );
}
