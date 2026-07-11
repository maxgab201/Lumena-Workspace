import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Topbar } from './Topbar';
import { TooltipProvider } from '../ui/Tooltip';
import { AnimatePresence, motion } from 'framer-motion';

export const AppLayout = () => {
  const location = useLocation();

  return (
    <TooltipProvider delayDuration={300}>
      <div className="flex h-screen w-full overflow-hidden bg-background text-foreground selection:bg-accent/30 selection:text-accent-foreground">
        <Sidebar />
        <div className="flex-1 flex flex-col h-full overflow-hidden relative">
          <Topbar />
          <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-0">
            <AnimatePresence mode="wait">
              <motion.div
                key={location.pathname}
                initial={{ opacity: 0, y: 10, filter: 'blur(4px)' }}
                animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
                exit={{ opacity: 0, y: -10, filter: 'blur(4px)' }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                className="h-full"
              >
                <Outlet />
              </motion.div>
            </AnimatePresence>
          </main>
        </div>
      </div>
    </TooltipProvider>
  );
};
