import { Bell, Search, Command } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';

export const Topbar = () => {
  return (
    <header className="h-14 border-b border-border/60 bg-background/80 backdrop-blur-xl flex items-center justify-between px-6 sticky top-0 z-40 transition-colors">
      <div className="flex-1 flex items-center">
        {/* Premium Search Placeholder */}
        <button className="hidden md:flex items-center space-x-2 bg-secondary/40 hover:bg-secondary/80 border border-white/5 text-muted-foreground px-3 py-1.5 rounded-lg text-sm transition-all cursor-text w-72 group shadow-sm">
          <Search size={16} className="group-hover:text-foreground transition-colors" />
          <span className="flex-1 text-left font-medium">Search knowledge...</span>
          <kbd className="inline-flex items-center gap-1 rounded bg-background/50 border border-white/10 px-1.5 font-mono text-[10px] font-medium text-muted-foreground shadow-sm">
            <Command size={10} /> K
          </kbd>
        </button>
      </div>
      
      <div className="flex items-center space-x-3">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground hover:bg-secondary/50 rounded-full w-9 h-9">
              <Bell size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" sideOffset={5}>Notifications</TooltipContent>
        </Tooltip>

        <div className="h-4 w-px bg-border mx-1" />

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full w-9 h-9">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border/50 transition-all hover:ring-accent shadow-sm">
                <AvatarFallback className="bg-gradient-to-b from-secondary to-background text-foreground text-xs font-medium">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56 mt-1 border-white/10 shadow-2xl">
            <div className="flex items-center justify-start gap-3 p-3">
               <Avatar className="h-9 w-9">
                <AvatarFallback className="bg-accent/20 text-accent text-xs font-bold">U</AvatarFallback>
              </Avatar>
              <div className="flex flex-col space-y-0.5 leading-none">
                <p className="font-semibold text-sm">User</p>
                <p className="text-xs text-muted-foreground">user@lumena.app</p>
              </div>
            </div>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="cursor-pointer">Profile</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Settings</DropdownMenuItem>
            <DropdownMenuItem className="cursor-pointer">Billing</DropdownMenuItem>
            <DropdownMenuSeparator className="bg-white/5" />
            <DropdownMenuItem className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
