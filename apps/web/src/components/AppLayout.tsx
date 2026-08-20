import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function AppLayout() {
  return (
    <div className="flex h-screen min-w-[760px] overflow-hidden bg-white text-ink">
      <AppSidebar />
      <Outlet />
    </div>
  );
}
