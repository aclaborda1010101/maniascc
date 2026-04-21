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
import { ThemeProvider } from "next-themes";
import { TopProgressBar } from "@/components/TopProgressBar";
import NotFound from "./pages/NotFound";

// Importadores nombrados → permiten prefetch desde el sidebar.
// Vite cachea el módulo, así que llamar varias veces no descarga dos veces.
export const importLogin = () => import("./pages/Login");
export const importDashboard = () => import("./pages/Dashboard");
export const importProyectos = () => import("./pages/Proyectos");
export const importProyectoDetail = () => import("./pages/ProyectoDetail");
export const importLocales = () => import("./pages/Locales");
export const importLocalDetail = () => import("./pages/LocalDetail");
export const importOperadores = () => import("./pages/Operadores");
export const importOperadorDetail = () => import("./pages/OperadorDetail");
export const importContactos = () => import("./pages/Contactos");
export const importContactoDetail = () => import("./pages/ContactoDetail");
export const importDocumentos = () => import("./pages/Documentos");
export const importMatching = () => import("./pages/Matching");
export const importNotificaciones = () => import("./pages/Notificaciones");
export const importLocationAnalysis = () => import("./pages/LocationAnalysis");
export const importDossierValidation = () => import("./pages/DossierValidation");
export const importTenantMixOptimizer = () => import("./pages/TenantMixOptimizer");
export const importNegotiationBriefing = () => import("./pages/NegotiationBriefing");
export const importAsistenteIA = () => import("./pages/AsistenteIA");
export const importPatrones = () => import("./pages/Patrones");
export const importAdmin = () => import("./pages/Admin");
export const importPlayground = () => import("./pages/Playground");
export const importConsumo = () => import("./pages/Consumo");
export const importAjustes = () => import("./pages/Ajustes");
export const importGeneradorDocumentos = () => import("./pages/GeneradorDocumentos");
export const importConocimiento = () => import("./pages/Conocimiento");

const Login = lazy(importLogin);
const Dashboard = lazy(importDashboard);
const Proyectos = lazy(importProyectos);
const ProyectoDetail = lazy(importProyectoDetail);
const Locales = lazy(importLocales);
const LocalDetail = lazy(importLocalDetail);
const Operadores = lazy(importOperadores);
const OperadorDetail = lazy(importOperadorDetail);
const Contactos = lazy(importContactos);
const ContactoDetail = lazy(importContactoDetail);
const Documentos = lazy(importDocumentos);
const Matching = lazy(importMatching);
const Notificaciones = lazy(importNotificaciones);
const LocationAnalysis = lazy(importLocationAnalysis);
const DossierValidation = lazy(importDossierValidation);
const TenantMixOptimizer = lazy(importTenantMixOptimizer);
const NegotiationBriefing = lazy(importNegotiationBriefing);
const AsistenteIA = lazy(importAsistenteIA);
const Patrones = lazy(importPatrones);
const Admin = lazy(importAdmin);
const Playground = lazy(importPlayground);
const Consumo = lazy(importConsumo);
const Ajustes = lazy(importAjustes);
const GeneradorDocumentos = lazy(importGeneradorDocumentos);
const Conocimiento = lazy(importConocimiento);

// Mapa ruta → prefetch, consumido por AppSidebar.
export const routePrefetchMap: Record<string, () => Promise<unknown>> = {
  "/dashboard": importDashboard,
  "/asistente": importAsistenteIA,
  "/oportunidades": importProyectos,
  "/generador": importGeneradorDocumentos,
  "/activos": importLocales,
  "/operadores": importOperadores,
  "/contactos": importContactos,
  "/documentos": importDocumentos,
  "/conocimiento": importConocimiento,
  "/localizacion": importLocationAnalysis,
  "/validacion-dossier": importDossierValidation,
  "/tenant-mix": importTenantMixOptimizer,
  "/negociacion-ia": importNegotiationBriefing,
  "/consumo": importConsumo,
  "/patrones": importPatrones,
  "/playground": importPlayground,
  "/ajustes": importAjustes,
};

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

const App = () => (
  <ThemeProvider attribute="class" defaultTheme="light" enableSystem={false}>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <Suspense fallback={<TopProgressBar />}>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<ProtectedRoute><NotificationProvider><AppLayout /></NotificationProvider></ProtectedRoute>}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/oportunidades" element={<Proyectos />} />
                  <Route path="/oportunidades/:id" element={<ProyectoDetail />} />
                  <Route path="/operadores" element={<Operadores />} />
                  <Route path="/operadores/:id" element={<OperadorDetail />} />
                  <Route path="/contactos" element={<Contactos />} />
                  <Route path="/contactos/:id" element={<ContactoDetail />} />
                  <Route path="/documentos" element={<Documentos />} />
                  <Route path="/activos" element={<Locales />} />
                  <Route path="/activos/:id" element={<LocalDetail />} />
                  <Route path="/matching/:localId" element={<Matching />} />
                  <Route path="/notificaciones" element={<Notificaciones />} />
                  <Route path="/localizacion" element={<LocationAnalysis />} />
                  <Route path="/validacion-dossier" element={<DossierValidation />} />
                  <Route path="/tenant-mix" element={<TenantMixOptimizer />} />
                  <Route path="/negociacion-ia" element={<NegotiationBriefing />} />
                  <Route path="/asistente" element={<AsistenteIA />} />
                  <Route path="/patrones" element={<Patrones />} />
                  <Route path="/playground" element={<Playground />} />
                  <Route path="/consumo" element={<Consumo />} />
                  <Route path="/ajustes" element={<Ajustes />} />
                  <Route path="/generador" element={<GeneradorDocumentos />} />
                  <Route path="/conocimiento" element={<Conocimiento />} />
                  <Route path="/importar" element={<Navigate to="/contactos" replace />} />
                  <Route path="/notificaciones" element={<Navigate to="/dashboard" replace />} />
                  {/* Retrocompatibilidad */}
                  <Route path="/busqueda" element={<Navigate to="/asistente" replace />} />
                  <Route path="/proyectos" element={<Navigate to="/oportunidades" replace />} />
                  <Route path="/proyectos/:id" element={<Navigate to="/oportunidades" replace />} />
                  <Route path="/locales" element={<Navigate to="/activos" replace />} />
                  <Route path="/locales/:id" element={<Navigate to="/activos" replace />} />
                  <Route path="/auditoria" element={<Navigate to="/ajustes" replace />} />
                  <Route path="/admin" element={<Navigate to="/ajustes" replace />} />
                </Route>
                <Route path="*" element={<NotFound />} />
              </Routes>
            </Suspense>
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
