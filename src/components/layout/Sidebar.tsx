import { NavLink, useLocation } from 'react-router-dom';
import { Settings, Files, Folder, Map, Layers, Podcast, Presentation, Image as ImageIcon, ChevronDown, Plus, Edit2, Trash2, CreditCard, PanelLeftClose } from 'lucide-react';
import { cn } from '../../lib/utils';
import { motion } from 'framer-motion';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useUiStore } from '../../stores/uiStore';
import { useState } from 'react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { Modal as Dialog, ModalContent as DialogContent, ModalHeader as DialogHeader, ModalTitle as DialogTitle, ModalDescription as DialogDescription } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip';

export const Sidebar = () => {
  const location = useLocation();
  const { workspaces, activeWorkspaceId, setActiveWorkspace, createWorkspace, renameWorkspace, deleteWorkspace } = useWorkspaceStore();
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  
  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId);
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [isRenameOpen, setIsRenameOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [newName, setNewName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleCreate = async () => {
    if (!newName.trim()) return;
    setIsSubmitting(true);
    try {
      await createWorkspace(newName.trim());
      setIsCreateOpen(false);
      setNewName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRename = async () => {
    if (!newName.trim() || !activeWorkspace) return;
    setIsSubmitting(true);
    try {
      await renameWorkspace(activeWorkspace.id, newName.trim());
      setIsRenameOpen(false);
      setNewName('');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activeWorkspace) return;
    setIsSubmitting(true);
    try {
      await deleteWorkspace(activeWorkspace.id);
      setIsDeleteOpen(false);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <aside className={`${sidebarCollapsed ? 'w-16' : 'w-64'} border-r border-border h-full flex flex-col bg-background z-10 transition-all duration-300 shadow-[1px_0_0_0_rgba(255,255,255,0.02)]`}>
        {/* Workspace Switcher */}
        {!sidebarCollapsed ? (
          <div className="h-14 flex items-center px-4 border-b border-border bg-background/50 backdrop-blur-sm">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="flex items-center justify-between w-full p-1.5 rounded-lg hover:bg-secondary/80 transition-colors focus:outline-none focus:ring-2 focus:ring-accent group">
                  <div className="flex items-center space-x-2.5 truncate">
                    <div className="w-6 h-6 rounded bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-white font-bold text-xs shadow-sm shrink-0">
                      {activeWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
                    </div>
                    <span className="font-medium text-sm text-foreground truncate">{activeWorkspace?.name || 'Workspace'}</span>
                  </div>
                  <ChevronDown className="w-4 h-4 text-muted-foreground group-hover:text-foreground transition-colors shrink-0" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="start" className="w-56 mt-1 border-white/10 shadow-2xl">
                <div className="px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Workspaces
                </div>
                {workspaces.map(w => (
                  <DropdownMenuItem key={w.id} className="cursor-pointer flex items-center justify-between" onSelect={() => setActiveWorkspace(w.id)}>
                    <span className="truncate">{w.name}</span>
                    {w.id === activeWorkspaceId && <div className="w-1.5 h-1.5 rounded-full bg-accent" />}
                  </DropdownMenuItem>
                ))}
                <DropdownMenuSeparator className="bg-white/5" />
                <DropdownMenuItem className="cursor-pointer" onSelect={() => { setNewName(''); setIsCreateOpen(true); }}>
                  <Plus className="w-4 h-4 mr-2" /> Create Workspace
                </DropdownMenuItem>
                {activeWorkspace && (
                  <>
                    <DropdownMenuItem className="cursor-pointer" onSelect={() => { setNewName(activeWorkspace.name); setIsRenameOpen(true); }}>
                      <Edit2 className="w-4 h-4 mr-2" /> Rename Workspace
                    </DropdownMenuItem>
                    <DropdownMenuItem className="cursor-pointer text-destructive focus:bg-destructive/10 focus:text-destructive" onSelect={() => setIsDeleteOpen(true)}>
                      <Trash2 className="w-4 h-4 mr-2" /> Delete Workspace
                    </DropdownMenuItem>
                  </>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        ) : (
          <div className="h-14 flex items-center justify-center border-b border-border bg-background/50 backdrop-blur-sm">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent to-accent/70 flex items-center justify-center text-white font-bold text-xs shadow-sm">
              {activeWorkspace?.name?.charAt(0)?.toUpperCase() || 'W'}
            </div>
          </div>
        )}
        
        <div className="flex-1 px-2 py-4 space-y-6 overflow-y-auto custom-scrollbar">
          
          <div>
            <nav className="space-y-0.5">
              <SidebarItem to="/dashboard" icon={<Files size={18} strokeWidth={2} />} label="Documents" activePath={location.pathname} collapsed={sidebarCollapsed} />
            </nav>
          </div>

          {!sidebarCollapsed && (
            <>
              <div>
                <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2 flex items-center group cursor-default">
                  <span>Knowledge</span>
                </p>
                <nav className="space-y-0.5">
                  <SidebarItem to="/collections" icon={<Folder size={18} strokeWidth={2} />} label="Collections" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                  <SidebarItem to="/mindmaps" icon={<Map size={18} strokeWidth={2} />} label="Mind Maps" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                  <SidebarItem to="/flashcards" icon={<Layers size={18} strokeWidth={2} />} label="Flashcards" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                </nav>
              </div>

              <div>
                <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-widest mb-2">Media</p>
                <nav className="space-y-0.5">
                  <SidebarItem to="/podcasts" icon={<Podcast size={18} strokeWidth={2} />} label="Podcasts" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                  <SidebarItem to="/presentations" icon={<Presentation size={18} strokeWidth={2} />} label="Presentations" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                  <SidebarItem to="/infographics" icon={<ImageIcon size={18} strokeWidth={2} />} label="Infographics" activePath={location.pathname} comingSoon collapsed={sidebarCollapsed} />
                </nav>
              </div>
            </>
          )}

        </div>

        <div className="p-2 border-t border-border bg-background/50 space-y-0.5">
          <SidebarItem to="/billing" icon={<CreditCard size={18} strokeWidth={2} />} label="Billing" activePath={location.pathname} collapsed={sidebarCollapsed} />
          <SidebarItem to="/settings" icon={<Settings size={18} strokeWidth={2} />} label="Settings" activePath={location.pathname} collapsed={sidebarCollapsed} />
          
          {/* Collapse toggle */}
          <button
            onClick={toggleSidebar}
            className="w-full flex items-center justify-center px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-secondary/50 transition-colors"
            aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            data-testid="sidebar-collapse-btn"
          >
            <PanelLeftClose size={16} className={`transition-transform duration-300 ${sidebarCollapsed ? 'rotate-180' : ''}`} />
            {!sidebarCollapsed && <span className="ml-3 text-sm font-medium">Collapse</span>}
          </button>
        </div>
      </aside>

      {/* Create Workspace Dialog */}
      <Dialog open={isCreateOpen} onOpenChange={setIsCreateOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Create Workspace</DialogTitle>
            <DialogDescription>Create a new workspace to organize your knowledge.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="Workspace Name" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsCreateOpen(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={!newName.trim() || isSubmitting}>Create</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Rename Workspace Dialog */}
      <Dialog open={isRenameOpen} onOpenChange={setIsRenameOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Rename Workspace</DialogTitle>
            <DialogDescription>Change the name of your current workspace.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <input 
              value={newName} 
              onChange={e => setNewName(e.target.value)} 
              placeholder="Workspace Name" 
              className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              autoFocus
            />
          </div>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsRenameOpen(false)}>Cancel</Button>
            <Button onClick={handleRename} disabled={!newName.trim() || isSubmitting}>Rename</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Workspace Dialog */}
      <Dialog open={isDeleteOpen} onOpenChange={setIsDeleteOpen}>
        <DialogContent className="sm:max-w-[425px]">
          <DialogHeader>
            <DialogTitle>Delete Workspace</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete <strong>{activeWorkspace?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2 mt-4">
            <Button variant="outline" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={isSubmitting || workspaces.length <= 1}>
              {workspaces.length <= 1 ? "Cannot Delete Last Workspace" : "Delete Workspace"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

function SidebarItem({ to, icon, label, activePath, comingSoon, collapsed }: { to: string, icon: React.ReactNode, label: string, activePath: string, comingSoon?: boolean, collapsed?: boolean }) {
  const isActive = activePath.startsWith(to) || (to === '/dashboard' && activePath === '/');

  if (comingSoon) {
    const item = (
      <div className={cn(
        "flex items-center px-3 py-2 rounded-lg text-muted-foreground/50 opacity-70 cursor-not-allowed select-none group relative",
        collapsed ? "justify-center" : "justify-between"
      )}>
        <div className="flex items-center space-x-3">
          <div className="text-muted-foreground/40">{icon}</div>
          {!collapsed && <span className="text-sm font-medium">{label}</span>}
        </div>
        {!collapsed && <span className="text-[9px] font-bold uppercase tracking-widest bg-secondary/30 px-1.5 py-0.5 rounded text-muted-foreground/60">Soon</span>}
      </div>
    );

    if (collapsed) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            {item}
          </TooltipTrigger>
          <TooltipContent side="right" sideOffset={10}>
            {label} <span className="ml-1 text-[10px] uppercase text-muted-foreground">Soon</span>
          </TooltipContent>
        </Tooltip>
      );
    }
    return item;
  }

  const item = (
    <NavLink 
      to={to} 
      className={cn(
        "flex items-center px-3 py-2 rounded-lg transition-colors group relative font-medium text-sm outline-none focus-visible:ring-2 focus-visible:ring-accent",
        isActive 
          ? 'text-foreground' 
          : 'text-muted-foreground hover:text-foreground',
        collapsed ? "justify-center" : "space-x-3"
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
      <div className={cn("transition-colors flex items-center justify-center", isActive ? "text-accent" : "text-muted-foreground group-hover:text-foreground")}>
        {icon}
      </div>
      {!collapsed && <span>{label}</span>}
    </NavLink>
  );

  if (collapsed) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          {item}
        </TooltipTrigger>
        <TooltipContent side="right" sideOffset={10}>
          {label}
        </TooltipContent>
      </Tooltip>
    );
  }

  return item;
}
