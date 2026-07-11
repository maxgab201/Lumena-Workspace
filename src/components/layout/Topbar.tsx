import { Bell, Search, Command } from 'lucide-react';
import { Button } from '../ui/Button';
import { Avatar, AvatarFallback } from '../ui/Avatar';
import { Tooltip, TooltipContent, TooltipTrigger } from '../ui/Tooltip';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '../ui/DropdownMenu';

export const Topbar = () => {
  return (
    <header className="h-14 border-b border-border bg-card/80 backdrop-blur-md flex items-center justify-between px-4 sticky top-0 z-10 transition-colors">
      <div className="flex-1 flex items-center">
        {/* Search Placeholder */}
        <div className="hidden md:flex items-center space-x-2 bg-secondary/50 hover:bg-secondary border border-border/50 text-muted-foreground px-3 py-1.5 rounded-md text-sm transition-colors cursor-text w-64 group">
          <Search size={16} className="group-hover:text-foreground transition-colors" />
          <span className="flex-1 text-left">Search...</span>
          <kbd className="inline-flex items-center gap-1 rounded border border-border bg-background px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
            <Command size={10} /> K
          </kbd>
        </div>
      </div>
      
      <div className="flex items-center space-x-2">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground">
              <Bell size={18} />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Notifications</TooltipContent>
        </Tooltip>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="icon" className="rounded-full">
              <Avatar className="h-8 w-8 cursor-pointer ring-1 ring-border transition-shadow hover:ring-accent">
                <AvatarFallback className="bg-secondary text-secondary-foreground text-xs font-medium">U</AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <div className="flex items-center justify-start gap-2 p-2">
              <div className="flex flex-col space-y-1 leading-none">
                <p className="font-medium text-sm">User</p>
                <p className="text-xs text-muted-foreground">user@example.com</p>
              </div>
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem>Profile</DropdownMenuItem>
            <DropdownMenuItem>Settings</DropdownMenuItem>
            <DropdownMenuItem>Billing</DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem className="text-destructive focus:bg-destructive focus:text-destructive-foreground">Log out</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
};
