import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/contexts/AuthContext";
import { MandatoryContentGuard } from "@/components/layout/MandatoryContentGuard";
import { RoleSwitcher } from "@/components/dev/RoleSwitcher";

// Pages
import Auth from "./pages/Auth";
import ForgotPassword from "./pages/ForgotPassword";
import Dashboard from "./pages/Dashboard";
import Comunicados from "./pages/Comunicados";
import Notificacoes from "./pages/Notificacoes";
import Suporte from "./pages/Suporte";
import Perfil from "./pages/Perfil";
import Admin from "./pages/Admin";
import AdminUsersSecurity from "./pages/AdminUsersSecurity";
import GiraBot from "./pages/GiraBot";
import Midias from "./pages/Midias";
import Busca from "./pages/Busca";
import Treinamentos from "./pages/Treinamentos";
import Checklists from "./pages/Checklists";
import Manuais from "./pages/Manuais";
import Reconhecimento from "./pages/Reconhecimento";
import Ideias from "./pages/Ideias";
import Campanhas from "./pages/Campanhas";
import Pesquisas from "./pages/Pesquisas";
import Feed from "./pages/Feed";
import Mural from "./pages/Mural";
import ConteudosObrigatorios from "./pages/ConteudosObrigatorios";
import MinhaJornada from "./pages/MinhaJornada";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <AuthProvider>
        <BrowserRouter>
          <MandatoryContentGuard>
            <Routes>
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/auth" element={<Auth />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/conteudos-obrigatorios" element={<ConteudosObrigatorios />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/feed" element={<Feed />} />
              <Route path="/mural" element={<Mural />} />
              <Route path="/comunicados" element={<Comunicados />} />
              <Route path="/notificacoes" element={<Notificacoes />} />
              <Route path="/suporte" element={<Suporte />} />
              <Route path="/girabot" element={<GiraBot />} />
              <Route path="/midias" element={<Midias />} />
              <Route path="/busca" element={<Busca />} />
              <Route path="/treinamentos" element={<Treinamentos />} />
              <Route path="/checklists" element={<Checklists />} />
              <Route path="/manuais" element={<Manuais />} />
              <Route path="/reconhecimento" element={<Reconhecimento />} />
              <Route path="/ideias" element={<Ideias />} />
              <Route path="/campanhas" element={<Campanhas />} />
              <Route path="/pesquisas" element={<Pesquisas />} />
              <Route path="/minha-jornada" element={<MinhaJornada />} />
              <Route path="/perfil" element={<Perfil />} />
              <Route path="/admin" element={<Admin />} />
              <Route path="/admin/seguranca" element={<AdminUsersSecurity />} />
              {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </MandatoryContentGuard>
        </BrowserRouter>
        <Toaster />
        <Sonner />
        <RoleSwitcher />
      </AuthProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
