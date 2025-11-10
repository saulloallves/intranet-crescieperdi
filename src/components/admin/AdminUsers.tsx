import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { CreateUserDialog } from './CreateUserDialog';
import { EditUserDialog } from './EditUserDialog';
import { ResetPasswordDialog } from './ResetPasswordDialog';
import { Edit, Key, ToggleLeft, ToggleRight, Trash2, Search, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRoleColor, getRoleLabel } from '@/lib/userManagement';

interface User {
  id: string;
  full_name: string;
  email: string;
  role: string;
  unit_code: string | null;
  is_active: boolean;
  created_at: string;
  avatar_url: string | null;
  phone: string | null;
  cpf: string | null;
}

export function AdminUsers() {
  const [users, setUsers] = useState<User[]>([]);
  const [filteredUsers, setFilteredUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [editUser, setEditUser] = useState<User | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [resetPasswordUser, setResetPasswordUser] = useState<{ id: string; name: string } | null>(null);
  const [resetPasswordOpen, setResetPasswordOpen] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();

  useEffect(() => {
    fetchUsers();
  }, []);

  useEffect(() => {
    filterUsers();
  }, [users, searchTerm, roleFilter, statusFilter]);

  const filterUsers = () => {
    let filtered = [...users];

    if (searchTerm) {
      filtered = filtered.filter(
        (user) =>
          user.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          user.email.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (roleFilter !== 'all') {
      filtered = filtered.filter((user) => user.role === roleFilter);
    }

    if (statusFilter !== 'all') {
      const isActive = statusFilter === 'active';
      filtered = filtered.filter((user) => user.is_active === isActive);
    }

    setFilteredUsers(filtered);
  };

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setUsers(data || []);
      setFilteredUsers(data || []);
    } catch (error: any) {
      toast({
        title: 'Erro ao carregar usuários',
        description: error.message,
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  const getRoleBadge = (role: string) => {
    return (
      <Badge variant="outline" className={`border ${getRoleColor(role)}`}>
        {getRoleLabel(role)}
      </Badge>
    );
  };

  const handleEdit = (user: User) => {
    setEditUser(user);
    setEditDialogOpen(true);
  };

  const handleResetPassword = (userId: string, userName: string) => {
    setResetPasswordUser({ id: userId, name: userName });
    setResetPasswordOpen(true);
  };

  const handleToggleActive = async (userId: string, currentStatus: boolean) => {
    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'toggleActive',
          userData: {
            userId,
            isActive: !currentStatus,
          },
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Status atualizado',
        description: `Usuário ${!currentStatus ? 'ativado' : 'desativado'} com sucesso.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error toggling active status:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível atualizar o status.',
        variant: 'destructive',
      });
    }
  };

  const handleDelete = async (userId: string, userName: string) => {
    if (!confirm(`Tem certeza que deseja excluir ${userName}? Esta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke('admin-users', {
        body: {
          action: 'delete',
          userData: { userId },
        },
      });

      if (error) throw error;

      if (data.error) {
        throw new Error(data.error);
      }

      toast({
        title: 'Usuário excluído',
        description: `${userName} foi removido do sistema.`,
      });

      fetchUsers();
    } catch (error: any) {
      console.error('Error deleting user:', error);
      toast({
        title: 'Erro',
        description: error.message || 'Não foi possível excluir o usuário.',
        variant: 'destructive',
      });
    }
  };

  if (loading) {
    return <div className="text-center py-8">Carregando usuários...</div>;
  }

  return (
    <div>
      <div className="mb-6">
        <div className="flex flex-col md:flex-row md:justify-between md:items-start gap-4">
          <div>
            <h2 className="text-2xl font-bold">Gestão de Usuários</h2>
            <p className="text-sm text-muted-foreground">Adicione, edite e gerencie usuários do sistema</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <Button 
              variant="outline" 
              onClick={() => navigate('/admin/seguranca')}
              className="w-full sm:w-auto"
            >
              <Shield className="w-4 h-4 mr-2" />
              <span className="hidden md:inline">Segurança e Permissões</span>
              <span className="md:hidden">Segurança</span>
            </Button>
            <CreateUserDialog onSuccess={fetchUsers} />
          </div>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-3 lg:col-span-1 relative">
              <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
              <Input
                placeholder="Buscar usuários..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={roleFilter} onValueChange={setRoleFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por cargo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os cargos</SelectItem>
                <SelectItem value="admin">Administrador</SelectItem>
                <SelectItem value="gestor_setor">Gestor de Setor</SelectItem>
                <SelectItem value="gerente">Gerente</SelectItem>
                <SelectItem value="franqueado">Franqueado</SelectItem>
                <SelectItem value="colaborador">Colaborador</SelectItem>
              </SelectContent>
            </Select>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger>
                <SelectValue placeholder="Filtrar por status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os status</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* User Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Total de Usuários</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">{users.length}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Administradores</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">
              {users.filter((u) => u.role === 'admin' || u.role === 'gestor_setor').length}
            </CardTitle>
          </CardHeader>
        </Card>
        <Card className="sm:col-span-2 lg:col-span-1">
          <CardHeader className="pb-3">
            <CardDescription className="text-xs">Usuários Ativos</CardDescription>
            <CardTitle className="text-2xl md:text-3xl">
              {users.filter((u) => u.is_active).length}
            </CardTitle>
          </CardHeader>
        </Card>
      </div>

      <div className="mb-4">
        <p className="text-sm text-muted-foreground">
          Mostrando {filteredUsers.length} de {users.length} usuários
        </p>
      </div>

      {/* Users List */}
      <div className="grid gap-4">
        {filteredUsers.map((user) => (
          <Card key={user.id} className="hover:shadow-md transition-shadow">
            <CardContent className="p-4 md:p-6">
              <div className="flex flex-col sm:flex-row items-start gap-4">
                <Avatar className="h-12 w-12 sm:h-16 sm:w-16 flex-shrink-0">
                  <AvatarImage src={user.avatar_url || undefined} />
                  <AvatarFallback className="gradient-primary text-white text-lg sm:text-xl">
                    {user.full_name.charAt(0).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0 w-full">
                  <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-bold text-base md:text-lg truncate">{user.full_name}</h3>
                      <p className="text-sm text-muted-foreground truncate">{user.email}</p>
                      {user.unit_code && (
                        <p className="text-xs text-muted-foreground mt-1">Unidade: {user.unit_code}</p>
                      )}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {getRoleBadge(user.role)}
                        <Badge variant={user.is_active ? 'default' : 'secondary'}>
                          {user.is_active ? 'Ativo' : 'Inativo'}
                        </Badge>
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 sm:flex gap-2 mt-4">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(user)}
                      className="w-full sm:w-auto"
                    >
                      <Edit className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Editar</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleResetPassword(user.id, user.full_name)}
                      className="w-full sm:w-auto"
                    >
                      <Key className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Senha</span>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleToggleActive(user.id, user.is_active)}
                      className="w-full sm:w-auto"
                    >
                      {user.is_active ? (
                        <ToggleRight className="w-4 h-4 sm:mr-1" />
                      ) : (
                        <ToggleLeft className="w-4 h-4 sm:mr-1" />
                      )}
                      <span className="hidden sm:inline">{user.is_active ? 'Desativar' : 'Ativar'}</span>
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDelete(user.id, user.full_name)}
                      className="w-full sm:w-auto"
                    >
                      <Trash2 className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:inline">Excluir</span>
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Dialogs */}
      <EditUserDialog
        user={editUser}
        open={editDialogOpen}
        onOpenChange={setEditDialogOpen}
        onSuccess={fetchUsers}
      />

      {resetPasswordUser && (
        <ResetPasswordDialog
          userId={resetPasswordUser.id}
          userName={resetPasswordUser.name}
          open={resetPasswordOpen}
          onOpenChange={setResetPasswordOpen}
        />
      )}
    </div>
  );
}
