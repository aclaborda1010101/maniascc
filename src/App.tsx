import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "@/hooks/useAuth";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import { AppLayout } from "@/components/AppLayout";
import NotFound from "./pages/NotFound";

const Login = lazy(() => import("./pages/Login"));
const Dashboard = lazy(() => import("./pages/Dashboard"));
const Locales = lazy(() => import("./pages/Locales"));
const LocalDetail = lazy(() => import("./pages/LocalDetail"));
const Operadores = lazy(() => import("./pages/Operadores"));
const OperadorDetail = lazy(() => import("./pages/OperadorDetail"));
const Matching = lazy(() => import("./pages/Matching"));
const Busqueda = lazy(() => import("./pages/Busqueda"));
const Documentos = lazy(() => import("./pages/Documentos"));
const Farmacias = lazy(() => import("./pages/Farmacias"));
const LocationAnalysis = lazy(() => import("./pages/LocationAnalysis"));
const DossierValidation = lazy(() => import("./pages/DossierValidation"));
const TenantMixOptimizer = lazy(() => import("./pages/TenantMixOptimizer"));
const NegotiationBriefing = lazy(() => import("./pages/NegotiationBriefing"));

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
              <Route element={<ProtectedRoute><AppLayout /></ProtectedRoute>}>
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/locales" element={<Locales />} />
                <Route path="/locales/:id" element={<LocalDetail />} />
                <Route path="/operadores" element={<Operadores />} />
                <Route path="/operadores/:id" element={<OperadorDetail />} />
                <Route path="/matching/:localId" element={<Matching />} />
                <Route path="/busqueda" element={<Busqueda />} />
                <Route path="/documentos" element={<Documentos />} />
                <Route path="/farmacias" element={<Farmacias />} />
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
