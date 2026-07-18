import { Bell, Search, Command, Menu, ChevronRight } from 'lucide-react';
import { useNavigate, useLocation, useParams } from 'react-router-dom';
import { Button } from '../ui/Button';
import { Avatar, AvatarFallback, AvatarImage } from '../ui/Avatar';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';
import { useUserStore } from '../../stores/userStore';
import { useUiStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import { useState } from 'react';

export const Topbar = () => {
  const { user, profile, signOut } = useUserStore();
  const { setCommandPaletteOpen, setMobileSidebarOpen } = useUiStore();
  const { documents } = useWorkspaceStore();
  const navigate = useNavigate();
  const location = useLocation();
  const params = useParams();
  const [notifOpen, setNotifOpen] = useState(false);

  const handleLogout = async () => {
    try {
      await signOut();
    } catch (error) {
      console.error('Logout failed', error);
    }
  };

  const userName = profile?.name || user?.email?.split('@')[0] || 'User';
  const initial = userName.charAt(0).toUpperCase();

  // Build breadcrumb
  const getBreadcrumbs = () => {
    const path = location.pathname;
    if (path === '/dashboard') return [{ label: 'Documents', href: '/dashboard' }];
    if (path === '/settings') return [{ label: 'Settings', href: '/settings' }];
    if (path === '/billing') return [{ label: 'Billing', href: '/billing' }];
    if (path.startsWith('/viewer/')) {
      const docId = params.documentId;
      const doc = documents.find(d => d.id === docId);
      return [
        { label: 'Documents', href: '/dashboard' },
        { label: doc?.name || 'Document', href: path },
      ];
    }
    return [];
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <header className="h-14 border-b border-border/60 bg-background/80 backdrop-blur-xl flex items-center justify-between px-4 md:px-6 sticky top-0 z-40 transition-colors" data-testid="topbar">
      <div className="flex-1 flex items-center gap-3">
        {/* Mobile hamburger */}
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden text-muted-foreground hover:text-foreground w-9 h-9"
          onClick={() => setMobileSidebarOpen(true)}
          aria-label="Open menu"
          data-testid="mobile-menu-btn"
        >
          <Menu size={20} />
        </Button>

        {/* Breadcrumb */}
        <nav className="hidden sm:flex items-center gap-1 text-sm" aria-label="Breadcrumb">
          {breadcrumbs.map((crumb, i) => (
            <span key={crumb.href} className="flex items-center gap-1">
              {i > 0 && <ChevronRight size={14} className="text-muted-foreground/50" />}
              <button
                onClick={() => navigate(crumb.href)}
                className={`font-medium transition-colors ${
                  i === breadcrumbs.length - 1
                    ? 'text-foreground'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {crumb.label}
              </button>
            </span>
          ))}
        </nav>

        {/* Search / Command Palette trigger */}
        <button
          className="hidden md:flex items-center space-x-2 bg-secondary/40 hover:bg-secondary/80 border border-white/5 text-muted-foreground px-3 py-1.5 rounded-lg text-sm transition-all cursor-pointer w-56 lg:w-72 group shadow-sm ml-auto"
          onClick={() => setCommandPaletteOpen(true)}
          data-testid="search-trigger"
          aria-label="Open command palette"
        >
          <Search size={16} className="group-hover:text-foreground transition-colors" />
          <span className="flex-1 text-left font-medium">Search...</span>
          <kbd className="inline-flex items-center gap-1 rounded bg-background/50 border border-white/10 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
            <Command size={10} /> K
          </kbd>
        </button>
      </div>
      
      <div className="flex items-center space-x-2 ml-3">
        {/* Notifications */}
        <DropdownMenu open={notifOpen} onOpenChange={setNotifOpen}>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-full w-9 h-9"
              aria-label="Notifications"
              data-testid="notifications-btn"
            >
              <Bell size={18} />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-72 mt-1 border-white/10 shadow-2xl p-0">
            <div className="px-4 py-3 border-b border-white/5">
              <p className="text-sm font-semibold">Notifications</p>
            </div>
            <div className="px-4 py-8 text-center">
              <Bell size={28} className="mx-auto text-muted-foreground/30 mb-3" />
              <p className="text-sm text-muted-foreground font-medium">No notifications yet</p>
              <p className="text-xs text-muted-foreground/60 mt-1">We'll notify you when something important happens.</p>
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

        <div className="h-4 w-px bg-border mx-1 hidden sm:block" />

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9" aria-label="User menu" data-testid="user-menu-btn">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/50 transition-all hover:ring-accent shadow-sm">
                <AvatarImage src={profile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.email}`} />
                <AvatarFallback className="bg-gradient-to-b from-secondary to-background text-foreground text-xs font-medium">{initial}</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 border-white/10 shadow-2xl">
            <div className="flex items-center justify-start gap-3 p-3">
               <Avatar className="h-9 w-9">
                <AvatarImage src={profile?.avatar_url || `https://api.dicebear.com/7.x/notionists/svg?seed=${user?.email}`} />
                <AvatarFallback className="bg-accent/20 text-accent text-xs font-bold">{initial}</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5 leading-none">
                <span className="font-medium">{profile?.name || user?.email?.split('@')[0]}</span>
                <p className="text-xs text-muted-foreground line-clamp-1">{user?.email || ''}</p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/settings')}>Settings</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer" onSelect={() => navigate('/billing')}>Billing</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer" onSelect={handleLogout}>Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
