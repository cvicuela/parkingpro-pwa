import { useEffect, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { AuthProvider, useAuth } from './context/AuthContext';
import { TerminalProvider, useTerminal } from './context/TerminalContext';
import { SetupProvider, useSetup } from './context/SetupContext';
import { startTimeService, stopTimeService } from './services/timeService';
import Layout from './components/Layout';
import TerminalSelector from './components/TerminalSelector';
import OfflineIndicator from './components/OfflineIndicator';
import LoginPage from './pages/LoginPage';
import SetupWizardPage from './pages/SetupWizardPage';

// Lazy load all page components for smaller initial bundle
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ClientesPage = lazy(() => import('./pages/ClientesPage'));
const VehiculosPage = lazy(() => import('./pages/VehiculosPage'));
const PlanesPage = lazy(() => import('./pages/PlanesPage'));
const SuscripcionesPage = lazy(() => import('./pages/SuscripcionesPage'));
const ControlAccesoPage = lazy(() => import('./pages/ControlAccesoPage'));
const PagosPage = lazy(() => import('./pages/PagosPage'));
const ReportesPage = lazy(() => import('./pages/ReportesPage'));
const ConfigPage = lazy(() => import('./pages/ConfigPage'));
const CajaPage = lazy(() => import('./pages/CajaPage'));
const FacturasPage = lazy(() => import('./pages/FacturasPage'));
const AuditPage = lazy(() => import('./pages/AuditPage'));
const CajaHistorialPage = lazy(() => import('./pages/CajaHistorialPage'));
const RFIDPage = lazy(() => import('./pages/RFIDPage'));
const DispositivosPage = lazy(() => import('./pages/DispositivosPage'));
const GastosPage = lazy(() => import('./pages/GastosPage'));
const ReportesFiscalesPage = lazy(() => import('./pages/ReportesFiscalesPage'));
const NCFPage = lazy(() => import('./pages/NCFPage'));
const NotificacionesPage = lazy(() => import('./pages/NotificacionesPage'));
const IncidentesPage = lazy(() => import('./pages/IncidentesPage'));
const DescuentosPage = lazy(() => import('./pages/DescuentosPage'));

function ProfileCompletionGuard({ children }) {
  const { user, isProfileIncomplete } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (user && isProfileIncomplete() && location.pathname !== '/config') {
      toast.warn('Completa tu perfil para continuar', { toastId: 'profile-incomplete', autoClose: 6000 });
      navigate('/config', { replace: true });
    }
  }, [user, location.pathname]);

  return children;
}

function ProtectedRoute({ children, roles, allowIncompleteProfile }) {
  const { user, loading, profileComplete } = useAuth();
  const { terminal, loading: terminalLoading } = useTerminal();
  const { needsSetup, loading: setupLoading } = useSetup();

  if (loading || setupLoading) return <div className="flex items-center justify-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;
  if (!user) return <Navigate to="/login" replace />;

  // Redirect admin/super_admin to setup wizard if first-time setup is needed
  if (needsSetup && ['admin', 'super_admin'].includes(user.role)) {
    return <Navigate to="/setup" replace />;
  }

  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  // Redirect to config if profile is incomplete (unless we're already on config)
  if (!profileComplete && !allowIncompleteProfile) {
    return <Navigate to="/config" replace />;
  }

  // Show terminal selector if user is authenticated but no terminal is selected yet
  if (!terminalLoading && terminal === null) {
    return <TerminalSelector />;
  }

  return children;
}

function AppRoutes() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route path="/setup" element={user ? <SetupWizardPage /> : <Navigate to="/login" replace />} />
      <Route path="/" element={<ProtectedRoute><ProfileCompletionGuard><Layout /></ProfileCompletionGuard></ProtectedRoute>}>
        <Route index element={<DashboardPage />} />
        <Route path="clientes" element={<ClientesPage />} />
        <Route path="vehiculos" element={<VehiculosPage />} />
        <Route path="planes" element={<PlanesPage />} />
        <Route path="suscripciones" element={<SuscripcionesPage />} />
        <Route path="acceso" element={<ControlAccesoPage />} />
        <Route path="caja" element={<CajaPage />} />
        <Route path="pagos" element={<PagosPage />} />
        <Route path="facturas" element={<FacturasPage />} />
        <Route path="caja/historial" element={<ProtectedRoute roles={['admin','super_admin']}><CajaHistorialPage /></ProtectedRoute>} />
        <Route path="gastos" element={<ProtectedRoute roles={['admin','super_admin']}><GastosPage /></ProtectedRoute>} />
        <Route path="descuentos" element={<ProtectedRoute roles={['admin','super_admin']}><DescuentosPage /></ProtectedRoute>} />
        <Route path="reportes" element={<ProtectedRoute roles={['admin','super_admin']}><ReportesPage /></ProtectedRoute>} />
        <Route path="fiscal" element={<ProtectedRoute roles={['admin','super_admin']}><ReportesFiscalesPage /></ProtectedRoute>} />
        <Route path="ncf" element={<ProtectedRoute roles={['admin','super_admin']}><NCFPage /></ProtectedRoute>} />
        <Route path="notificaciones" element={<ProtectedRoute roles={['admin','super_admin']}><NotificacionesPage /></ProtectedRoute>} />
        <Route path="incidentes" element={<ProtectedRoute><IncidentesPage /></ProtectedRoute>} />
        <Route path="auditoria" element={<ProtectedRoute roles={['admin','super_admin']}><AuditPage /></ProtectedRoute>} />
        <Route path="config" element={<ProtectedRoute roles={['admin','super_admin']} allowIncompleteProfile><ConfigPage /></ProtectedRoute>} />
        <Route path="rfid" element={<ProtectedRoute roles={['admin','super_admin']}><RFIDPage /></ProtectedRoute>} />
        <Route path="dispositivos" element={<ProtectedRoute roles={['admin','super_admin']}><DispositivosPage /></ProtectedRoute>} />
      </Route>
    </Routes>
  );
}

export default function App() {
  useEffect(() => {
    startTimeService();
    return () => stopTimeService();
  }, []);

  return (
    <BrowserRouter>
      <AuthProvider>
        <SetupProvider>
          <TerminalProvider>
            <AppRoutes />
            <ToastContainer position="top-right" autoClose={3000} hideProgressBar={false} theme="colored" />
            <OfflineIndicator />
          </TerminalProvider>
        </SetupProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}
