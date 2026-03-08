import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { NotificationProvider } from "@/contexts/NotificationContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Proyectos = lazy(() => import("./pages/Proyectos"));
const ProyectoDetail = lazy(() => import("./pages/ProyectoDetail"));
const Locales = lazy(() => import("./pages/Locales"));
const LocalDetail = lazy(() => import("./pages/LocalDetail"));
const Operadores = lazy(() => import("./pages/Operadores"));
const OperadorDetail = lazy(() => import("./pages/OperadorDetail"));
const Contactos = lazy(() => import("./pages/Contactos"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Busqueda = lazy(() => import("./pages/Busqueda"));
const Auditoria = lazy(() => import("./pages/Auditoria"));
const Matching = lazy(() => import("./pages/Matching"));
const Notificaciones = lazy(() => import("./pages/Notificaciones"));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-accent border-t-transparent" />
    </div>
  );
}

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/login" element={<Login />} />
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route element={<ProtectedRoute><NotificationProvider><AppLayout /></NotificationProvider></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/proyectos" element={<Proyectos />} />
                <Route path="/proyectos/:id" element={<ProyectoDetail />} />
                <Route path="/operadores" element={<Operadores />} />
                <Route path="/operadores/:id" element={<OperadorDetail />} />
                <Route path="/contactos" element={<Contactos />} />
                <Route path="/documentos" element={<Documentos />} />
                <Route path="/busqueda" element={<Busqueda />} />
                <Route path="/auditoria" element={<Auditoria />} />
                <Route path="/locales" element={<Locales />} />
                <Route path="/locales/:id" element={<LocalDetail />} />
                <Route path="/matching/:localId" element={<Matching />} />
              </Route>
              <Route path="*" element={<NotFound />} />
            </Routes>
          </Suspense>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
