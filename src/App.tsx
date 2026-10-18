import React from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./AuthContext";
import Layout from "./components/Layout";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import SeguimientoPage from "./pages/SeguimientoPage";
import ExpedientesPage from "./pages/ExpedientesPage";
import ExpedienteDetailPage from "./pages/ExpedienteDetailPage";
import AsignacionesPage from "./pages/AsignacionesPage";
import VisitasPage from "./pages/VisitasPage";
import VisitaDetailPage from "./pages/VisitaDetailPage";
import UsuariosPage from "./pages/UsuariosPage";
import SeguridadPage from "./pages/SeguridadPage";
import PrivacyPage from "./pages/PrivacyPage";
import NotFoundPage from "./pages/NotFoundPage";
import EmpresasPage from "./pages/EmpresasPage";

function Protected({ children, adminOnly = false, universalOnly = false }: { children: React.ReactNode; adminOnly?: boolean; universalOnly?: boolean }) {
  const { user, loading, empresaElegida } = useAuth();
  if (loading) return <div className="login-screen" />;
  if (!user) return <Navigate to="/login" replace />;
  const esUniversal = user.rol === "UNIVERSAL";
  if (universalOnly && !esUniversal) return <Navigate to="/" replace />;
  // El administrador universal sin empresa elegida solo puede estar en el catálogo de empresas.
  if (esUniversal && !empresaElegida && !universalOnly) return <Navigate to="/empresas" replace />;
  if (adminOnly && user.rol !== "ADMINISTRADOR" && !esUniversal) return <Navigate to="/" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/privacidad" element={<PrivacyPage />} />
      <Route path="/" element={<Protected><DashboardPage /></Protected>} />
      <Route path="/seguimiento" element={<Protected><SeguimientoPage /></Protected>} />
      <Route path="/expedientes" element={<Protected><ExpedientesPage /></Protected>} />
      <Route path="/expedientes/:id" element={<Protected><ExpedienteDetailPage /></Protected>} />
      <Route path="/asignaciones" element={<Protected><AsignacionesPage /></Protected>} />
      <Route path="/visitas" element={<Protected><VisitasPage /></Protected>} />
      <Route path="/visitas/:id" element={<Protected><VisitaDetailPage /></Protected>} />
      <Route path="/usuarios" element={<Protected adminOnly><UsuariosPage /></Protected>} />
      <Route path="/seguridad" element={<Protected><SeguridadPage /></Protected>} />
      <Route path="/empresas" element={<Protected universalOnly><EmpresasPage /></Protected>} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
