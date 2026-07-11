
import { User, Bell } from 'lucide-react';

export const Topbar = () => {
  return (
    <header className="h-14 border-b border-[var(--border)] bg-[var(--bg)] flex items-center justify-between px-4">
      <div className="flex-1 flex items-center">
        <h2 className="text-lg font-medium text-[var(--text-h)]">Lumena Workspace</h2>
      </div>
      
      <div className="flex items-center space-x-4">
        <button className="text-[var(--text)] hover:text-[var(--text-h)] transition-colors">
          <Bell size={20} />
        </button>
        <div className="w-8 h-8 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center">
          <User size={18} className="text-[var(--text-h)]" />
        </div>
      </div>
    </header>
  );
};
