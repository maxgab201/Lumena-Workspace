import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TooltipProvider } from '../ui/Tooltip';

export const AppLayout = () => {
  return (
    <TooltipProvider>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-6 relative z-0">
            <div className="absolute inset-0 bg-secondary/20 pointer-events-none -z-10" />
            <Outlet />
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};
