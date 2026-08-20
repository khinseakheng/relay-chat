import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function ProtectedRoute() {
  const { agent, initializing } = useAuth();
  if (initializing) {
    return (
      <div className="grid h-screen flex-1 place-items-center bg-slate-50 text-sm text-slate-400">
        Restoring session…
      </div>
    );
  }
  return agent ? <Outlet /> : <Navigate to="/login" replace />;
}
