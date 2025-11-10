import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { supabase } from '@/integrations/supabase/client';

export default function Auth() {
  const navigate = useNavigate();
  const { signIn, signUp, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);

  // Login state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Signup state
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPassword, setSignupPassword] = useState('');
  const [signupName, setSignupName] = useState('');
  const [signupPhone, setSignupPhone] = useState('');
  const [signupCpf, setSignupCpf] = useState('');
  const [signupUnitCode, setSignupUnitCode] = useState('');
  const [signupRole, setSignupRole] = useState<'colaborador' | 'franqueado' | 'admin'>('colaborador');
  const [receiveWhatsapp, setReceiveWhatsapp] = useState(false);

  useEffect(() => {
    if (user) {
      navigate('/dashboard');
    }
  }, [user, navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    const { error } = await signIn(loginEmail, loginPassword);
    
    if (!error) {
      navigate('/dashboard');
    }
    
    setIsLoading(false);
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    
    await signUp(signupEmail, signupPassword, signupName, {
      phone: signupPhone,
      cpf: signupCpf,
      unit_code: signupUnitCode,
      role: signupRole,
    });
    
    // Update WhatsApp preference if user provided phone
    if (signupPhone && receiveWhatsapp) {
      setTimeout(async () => {
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
          await supabase
            .from('profiles')
            .update({ receive_whatsapp_notifications: true })
            .eq('id', user.id);
        }
      }, 2000);
    }
    
    setIsLoading(false);
  };

  const formatCpf = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, 11);
  };

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, '');
    return numbers.slice(0, 13);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/20 via-secondary/20 to-accent/20 p-4">
      <Card className="w-full max-w-md shadow-2xl">
        <CardHeader className="space-y-1 text-center">
          <div className="mx-auto w-20 h-20 rounded-full gradient-primary flex items-center justify-center mb-4">
            <span className="text-4xl font-bold text-white">CP</span>
          </div>
          <CardTitle className="text-2xl font-bold">Cresci e Perdi</CardTitle>
          <CardDescription>Intranet Corporativa</CardDescription>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="login" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="login">Entrar</TabsTrigger>
              <TabsTrigger value="signup">Cadastrar</TabsTrigger>
            </TabsList>
            
            <TabsContent value="login">
              <form onSubmit={handleLogin} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="login-email">Email</Label>
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="login-password">Senha</Label>
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Entrando...' : 'Entrar'}
                </Button>
                
                <div className="text-center">
                  <Link 
                    to="/forgot-password" 
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueci minha senha
                  </Link>
                </div>
              </form>
            </TabsContent>
            
            <TabsContent value="signup">
              <form onSubmit={handleSignup} className="space-y-4 max-h-[60vh] overflow-y-auto pr-2">
                <div className="space-y-2">
                  <Label htmlFor="signup-name">Nome completo</Label>
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder="Seu nome"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                  />
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-email">Email</Label>
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="seu@email.com"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-cpf">CPF *</Label>
                  <Input
                    id="signup-cpf"
                    type="text"
                    placeholder="00000000000"
                    value={signupCpf}
                    onChange={(e) => setSignupCpf(formatCpf(e.target.value))}
                    required
                    maxLength={11}
                  />
                  <p className="text-xs text-muted-foreground">Apenas números</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-phone">WhatsApp</Label>
                  <Input
                    id="signup-phone"
                    type="text"
                    placeholder="5511999999999"
                    value={signupPhone}
                    onChange={(e) => setSignupPhone(formatPhone(e.target.value))}
                    maxLength={13}
                  />
                  <p className="text-xs text-muted-foreground">Código do país + DDD + número</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-unit-code">Código da Unidade *</Label>
                  <Input
                    id="signup-unit-code"
                    type="text"
                    placeholder="Ex: 1221"
                    value={signupUnitCode}
                    onChange={(e) => setSignupUnitCode(e.target.value)}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signup-role">Tipo de Usuário *</Label>
                  <Select
                    value={signupRole}
                    onValueChange={(value: any) => setSignupRole(value)}
                    required
                  >
                    <SelectTrigger id="signup-role">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="colaborador">Colaborador</SelectItem>
                      <SelectItem value="franqueado">Franqueado</SelectItem>
                      <SelectItem value="admin">Administrador</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                
                <div className="space-y-2">
                  <Label htmlFor="signup-password">Senha</Label>
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder="••••••••"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                  />
                  <p className="text-xs text-muted-foreground">Mínimo 6 caracteres</p>
                </div>

                {signupPhone && (
                  <div className="flex items-center space-x-2">
                    <Checkbox
                      id="receive-whatsapp"
                      checked={receiveWhatsapp}
                      onCheckedChange={(checked) => setReceiveWhatsapp(checked as boolean)}
                    />
                    <Label
                      htmlFor="receive-whatsapp"
                      className="text-sm font-normal cursor-pointer"
                    >
                      Receber notificações e senha via WhatsApp
                    </Label>
                  </div>
                )}
                
                <Button type="submit" className="w-full" disabled={isLoading}>
                  {isLoading ? 'Criando conta...' : 'Criar conta'}
                </Button>
              </form>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
