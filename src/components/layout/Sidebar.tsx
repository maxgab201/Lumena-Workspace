import { NavLink, useLocation } from 'react-router-dom';
import { LayoutDashboard, Settings, CreditCard, Sparkles, Files } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';

export const Sidebar = () => {
  const location = useLocation();

  return (
    <aside className="w-64 border-r border-border h-full flex flex-col bg-background z-10 transition-all duration-300 shadow-[1px_0_0_0_rgba(255,255,255,0.02)]">
      <div className="h-14 flex items-center space-x-3 px-5 border-b border-border bg-background/50 backdrop-blur-sm">
        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-white font-bold text-sm shadow-[0_0_15px_rgba(192,132,252,0.3)]">
          L
        </div>
        <span className="font-heading font-semibold text-foreground tracking-tight text-lg">Lumena</span>
      </div>
      
      <div className="flex-1 px-3 py-4 space-y-6 overflow-y-auto">
        
        <div>
          <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Workspace</p>
          <nav className="space-y-1">
            <SidebarItem to="/dashboard" icon={<LayoutDashboard size={18} strokeWidth={2.5} />} label="Overview" activePath={location.pathname} />
            <SidebarItem to="/workspace" icon={<Files size={18} strokeWidth={2.5} />} label="Documents" activePath={location.pathname} />
            <SidebarItem to="/ai-chat" icon={<Sparkles size={18} strokeWidth={2.5} />} label="AI Assistant" activePath={location.pathname} />
          </nav>
        </div>

        <div>
          <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Account</p>
          <nav className="space-y-1">
            <SidebarItem to="/billing" icon={<CreditCard size={18} strokeWidth={2.5} />} label="Billing" activePath={location.pathname} />
            <SidebarItem to="/settings" icon={<Settings size={18} strokeWidth={2.5} />} label="Settings" activePath={location.pathname} />
          </nav>
        </div>
      </div>

    </aside>
  );
};

function SidebarItem({ to, icon, label, activePath }: { to: string, icon: React.ReactNode, label: string, activePath: string }) {
  const isActive = activePath.startsWith(to) || (to === '/dashboard' && activePath === '/');

  return (
    <NavLink 
      to={to} 
      className={cn(
        "flex items-center space-x-3 px-3 py-2 rounded-lg transition-colors group relative font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isActive 
          ? 'text-foreground' 
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {isActive && (
        <motion.div 
          layoutId="sidebar-active"
          className="absolute inset-0 bg-secondary/80 rounded-lg -z-10"
          initial={false}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      )}
      <div className={cn("transition-colors", isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}>
        {icon}
      </div>
      <span>{label}</span>
    </NavLink>
  );
}
