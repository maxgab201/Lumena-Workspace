import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Settings, CreditCard } from 'lucide-react';
import { cn } from '../../lib/utils';

export const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-border h-full flex flex-col bg-card z-10 transition-all duration-300">
      <div className="h-14 flex items-center space-x-2 px-4 border-b border-border">
        <div className="w-7 h-7 rounded bg-accent flex items-center justify-center text-accent-foreground font-bold text-sm shadow-sm">
          L
        </div>
        <span className="font-heading font-semibold text-foreground tracking-tight">Lumena</span>
      </div>
      
      <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
        <p className="px-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-2 mt-4">Main Menu</p>
        <SidebarItem to="/dashboard" icon={<LayoutDashboard size={18} />} label="Dashboard" />
        <SidebarItem to="/workspace" icon={<FolderOpen size={18} />} label="Workspace" />
      </nav>

      <div className="p-3 border-t border-border space-y-1 bg-card/50">
        <SidebarItem to="/billing" icon={<CreditCard size={18} />} label="Billing" />
        <SidebarItem to="/settings" icon={<Settings size={18} />} label="Settings" />
      </div>
    </aside>
  );
};

function SidebarItem({ to, icon, label }: { to: string, icon: React.ReactNode, label: string }) {
  return (
    <NavLink 
      to={to} 
      className={({isActive}) => cn(
        "flex items-center space-x-3 px-3 py-2 rounded-md transition-colors group relative font-medium text-sm",
        isActive 
          ? 'bg-accent/15 text-accent font-semibold' 
          : 'text-muted-foreground hover:bg-secondary hover:text-foreground'
      )}
    >
      {({ isActive }) => (
        <>
          <div className={cn("transition-colors", isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}>
            {icon}
          </div>
          <span>{label}</span>
          {isActive && (
            <span className="absolute right-2 w-1.5 h-1.5 rounded-full bg-accent animate-in fade-in" />
          )}
        </>
      )}
    </NavLink>
  );
}
