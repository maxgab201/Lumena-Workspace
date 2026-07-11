
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, FolderOpen, Settings, CreditCard } from 'lucide-react';

export const Sidebar = () => {
  return (
    <aside className="w-64 border-r border-[var(--border)] h-full flex flex-col bg-[var(--bg)]">
      <div className="p-4 flex items-center space-x-2 border-b border-[var(--border)]">
        <div className="w-8 h-8 rounded-md bg-[var(--accent)] flex items-center justify-center text-white font-bold">
          L
        </div>
        <span className="font-heading font-medium text-[var(--text-h)]">Lumena</span>
      </div>
      
      <nav className="flex-1 p-4 space-y-1">
        <NavLink 
          to="/dashboard" 
          className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <LayoutDashboard size={18} />
          <span>Dashboard</span>
        </NavLink>
        
        <NavLink 
          to="/workspace" 
          className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <FolderOpen size={18} />
          <span>Workspace</span>
        </NavLink>
      </nav>

      <div className="p-4 border-t border-[var(--border)] space-y-1">
        <NavLink 
          to="/billing" 
          className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <CreditCard size={18} />
          <span>Billing</span>
        </NavLink>
        <NavLink 
          to="/settings" 
          className={({isActive}) => `flex items-center space-x-3 px-3 py-2 rounded-md transition-colors ${isActive ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-black/5 dark:hover:bg-white/5'}`}
        >
          <Settings size={18} />
          <span>Settings</span>
        </NavLink>
      </div>
    </aside>
  );
};
