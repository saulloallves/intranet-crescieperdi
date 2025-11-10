import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Users, ChevronDown } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';

type UserRole = 'colaborador' | 'gerente' | 'franqueado' | 'gestor_setor' | 'admin';

const roleLabels: Record<UserRole, string> = {
  colaborador: 'Colaborador',
  gerente: 'Gerente',
  franqueado: 'Franqueado',
  gestor_setor: 'Gestor de Setor',
  admin: 'Administrador',
};

export function RoleSwitcher() {
  const { profile } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  // Só mostra em dev mode
  if (import.meta.env.VITE_DEV_MODE !== 'true') {
    return null;
  }

  const handleRoleChange = (role: UserRole) => {
    // Dispara evento customizado para o AuthContext capturar
    window.dispatchEvent(new CustomEvent('dev-role-change', { detail: { role } }));
    setIsOpen(false);
  };

  return (
    <div className="fixed bottom-24 right-4 z-50">
      <DropdownMenu open={isOpen} onOpenChange={setIsOpen}>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="shadow-lg bg-background border-2 border-primary"
          >
            <Users className="w-4 h-4 mr-2" />
            {roleLabels[profile?.role as UserRole] || 'Dev Mode'}
            <ChevronDown className="w-4 h-4 ml-2" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem onClick={() => handleRoleChange('colaborador')}>
            👤 Colaborador
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('gerente')}>
            👔 Gerente
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('franqueado')}>
            🏢 Franqueado
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('gestor_setor')}>
            📊 Gestor de Setor
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => handleRoleChange('admin')}>
            👑 Administrador
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
