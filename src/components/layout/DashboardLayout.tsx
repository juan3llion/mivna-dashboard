import { Outlet } from 'react-router-dom';
import { AppSidebar } from './AppSidebar';

export function DashboardLayout() {
  return (
    <div className="min-h-screen flex w-full bg-background">
      <AppSidebar />
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
    </div>
  );
}
