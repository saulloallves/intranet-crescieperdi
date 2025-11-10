// Design System para Gestão de Usuários

// Cores por nível de acesso (usando semantic tokens)
export const roleColors = {
  admin: 'text-yellow-700 bg-yellow-50 border-yellow-200',
  gestor_setor: 'text-blue-700 bg-blue-50 border-blue-200',
  gerente: 'text-green-700 bg-green-50 border-green-200',
  franqueado: 'text-purple-700 bg-purple-50 border-purple-200',
  colaborador: 'text-muted-foreground bg-muted border-border',
} as const;

export const roleLabels = {
  admin: 'Administrador',
  gestor_setor: 'Gestor de Setor',
  gerente: 'Gerente',
  franqueado: 'Franqueado',
  colaborador: 'Colaborador',
} as const;

// Ícones de permissão
export const permissionIcons = {
  none: '🔒',
  read: '👁️',
  write: '✏️',
  admin: '⚙️',
} as const;

export const permissionLabels = {
  none: 'Sem acesso',
  read: 'Visualização',
  write: 'Edição',
  admin: 'Administração',
} as const;

export const permissionColors = {
  none: 'text-muted-foreground bg-muted',
  read: 'text-blue-600 bg-blue-50',
  write: 'text-green-600 bg-green-50',
  admin: 'text-yellow-600 bg-yellow-50',
} as const;

// Módulos do sistema
export const systemModules = {
  feed: 'Feed',
  mural: 'Mural',
  treinamentos: 'Treinamentos',
  comunicados: 'Comunicados',
  checklists: 'Checklists',
  reconhecimento: 'Reconhecimento',
  ideias: 'Ideias',
  campanhas: 'Campanhas',
  manuais: 'Manuais',
  midias: 'Mídias',
  pesquisas: 'Pesquisas',
  suporte: 'Suporte',
  busca: 'Busca',
  girabot: 'GiraBot',
  perfil: 'Perfil',
} as const;

// Helper para obter cor de role
export function getRoleColor(role: string): string {
  return roleColors[role as keyof typeof roleColors] || roleColors.colaborador;
}

// Helper para obter label de role
export function getRoleLabel(role: string): string {
  return roleLabels[role as keyof typeof roleLabels] || role;
}

// Helper para obter ícone de permissão
export function getPermissionIcon(level: string): string {
  return permissionIcons[level as keyof typeof permissionIcons] || permissionIcons.none;
}

// Helper para obter label de permissão
export function getPermissionLabel(level: string): string {
  return permissionLabels[level as keyof typeof permissionLabels] || level;
}

// Helper para obter cor de permissão
export function getPermissionColor(level: string): string {
  return permissionColors[level as keyof typeof permissionColors] || permissionColors.none;
}
