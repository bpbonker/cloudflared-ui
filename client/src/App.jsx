import { useEffect, useState } from 'react';
import { Navigate, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import { api, auth } from './lib/api';
import Login from './pages/Login.jsx';
import Setup from './pages/Setup/Setup.jsx';
import Dashboard from './pages/Dashboard.jsx';
import Subdomains from './pages/Subdomains.jsx';
import Logs from './pages/Logs.jsx';
import Settings from './pages/Settings.jsx';
import Nav from './components/Nav.jsx';
import { FullPageSpinner } from './components/Spinner.jsx';

// Top-level router. We probe /api/setup/status once on every authed view
// load so we can divert the user into the wizard whenever a tunnel hasn't
// been configured yet (e.g. immediately after they uninstall it).
export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/setup/*" element={<RequireAuth><Setup /></RequireAuth>} />
      <Route path="/dashboard" element={<RequireAuth><RequireSetup><Nav><Dashboard /></Nav></RequireSetup></RequireAuth>} />
      <Route path="/subdomains" element={<RequireAuth><RequireSetup><Nav><Subdomains /></Nav></RequireSetup></RequireAuth>} />
      <Route path="/logs" element={<RequireAuth><RequireSetup><Nav><Logs /></Nav></RequireSetup></RequireAuth>} />
      <Route path="/settings" element={<RequireAuth><RequireSetup><Nav><Settings /></Nav></RequireSetup></RequireAuth>} />
      <Route path="*" element={<Navigate to={auth.isSignedIn ? '/dashboard' : '/login'} replace />} />
    </Routes>
  );
}

function RequireAuth({ children }) {
  const location = useLocation();
  if (!auth.isSignedIn) {
    return <Navigate to={`/login?next=${encodeURIComponent(location.pathname)}`} replace />;
  }
  return children;
}

function RequireSetup({ children }) {
  const [state, setState] = useState({ loading: true, configured: false });
  const navigate = useNavigate();

  useEffect(() => {
    let cancelled = false;
    api.get('/api/setup/status')
      .then((r) => !cancelled && setState({ loading: false, configured: r.configured }))
      .catch(() => !cancelled && setState({ loading: false, configured: false }));
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!state.loading && !state.configured) navigate('/setup', { replace: true });
  }, [state, navigate]);

  if (state.loading) return <FullPageSpinner label="Loading…" />;
  if (!state.configured) return null;
  return children;
}
