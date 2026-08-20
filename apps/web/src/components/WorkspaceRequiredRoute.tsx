import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

export function WorkspaceRequiredRoute() {
  const { agent } = useAuth();
  return agent?.workspaceId ? <Outlet /> : <Navigate to="/workspaces" replace />;
}
