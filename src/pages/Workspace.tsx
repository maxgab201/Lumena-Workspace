import { Button } from '../components/ui/Button';
import { Search, List, MessageSquare, ChevronDown, PanelRightClose, Maximize2 } from 'lucide-react';

export const Workspace = () => {
  return (
    <div className="h-full flex flex-col space-y-3 overflow-hidden">
      
      {/* Workspace Header / Toolbar */}
      <header className="flex items-center justify-between shrink-0 bg-card border border-white/5 rounded-xl px-4 py-2 shadow-sm">
        <div className="flex items-center space-x-4">
           <div className="flex items-center space-x-2">
              <span className="font-heading font-semibold tracking-tight text-sm">Machine Learning Concepts</span>
              <Button variant="ghost" size="icon" className="w-6 h-6"><ChevronDown className="w-3 h-3" /></Button>
           </div>
           <div className="h-4 w-px bg-border" />
           <div className="flex items-center space-x-1">
             <Button variant="ghost" size="sm" className="h-7 text-xs"><List className="w-3 h-3 mr-2" /> Outline</Button>
           </div>
        </div>
        
        <div className="flex items-center space-x-2">
           <div className="relative">
             <Search className="absolute left-2.5 top-1.5 h-3.5 w-3.5 text-muted-foreground" />
             <input placeholder="Search in document..." className="bg-secondary/50 border border-white/5 rounded-md pl-8 pr-3 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-accent w-48" />
           </div>
           <Button variant="ghost" size="icon" className="w-8 h-8"><Maximize2 className="w-4 h-4 text-muted-foreground" /></Button>
           <Button variant="secondary" size="icon" className="w-8 h-8 border-white/5"><PanelRightClose className="w-4 h-4" /></Button>
        </div>
      </header>

      <div className="flex-1 flex gap-3 min-h-0">
        
        {/* PDF Viewer Placeholder */}
        <div className="flex-[2] bg-white text-black rounded-xl overflow-hidden shadow-sm flex flex-col border border-white/10">
           <div className="h-10 bg-[#f4f4f5] border-b border-[#e4e4e7] flex items-center justify-center shrink-0">
              <span className="text-xs font-medium text-[#71717a]">PDF Viewer Controls (Zoom, Pages)</span>
           </div>
           <div className="flex-1 flex items-center justify-center">
              <div className="w-[80%] h-[90%] bg-white border border-[#e4e4e7] shadow-lg flex items-center justify-center">
                 <span className="text-[#a1a1aa] font-medium text-sm">PDF Page Rendering Area</span>
              </div>
           </div>
        </div>

        {/* AI Chat / Assistant Sidebar */}
        <div className="flex-1 flex flex-col overflow-hidden bg-card border border-white/5 rounded-xl shadow-sm">
          <div className="h-12 border-b border-white/5 flex items-center justify-between px-4 shrink-0">
            <div className="flex items-center space-x-2">
               <MessageSquare className="w-4 h-4 text-accent" />
               <span className="text-sm font-medium">Assistant</span>
            </div>
            <Button variant="ghost" size="sm" className="h-7 text-xs text-muted-foreground">Clear Context</Button>
          </div>
          
          <div className="flex-1 flex flex-col p-4 overflow-y-auto space-y-4">
             {/* Chat Bubbles */}
             <div className="self-end bg-accent/10 text-foreground border border-accent/20 px-3 py-2 rounded-2xl rounded-tr-sm text-sm max-w-[85%]">
               Could you summarize page 4?
             </div>
             <div className="self-start bg-secondary text-foreground px-3 py-2 rounded-2xl rounded-tl-sm text-sm max-w-[85%]">
               Page 4 discusses the differences between supervised and unsupervised learning, highlighting that supervised learning uses labeled datasets while unsupervised learning attempts to find patterns in unlabeled data.
             </div>
          </div>

          {/* Input Area */}
          <div className="p-3 border-t border-white/5 shrink-0 bg-background/50">
             <div className="relative">
                <textarea 
                  rows={2} 
                  placeholder="Ask a question..." 
                  className="w-full resize-none bg-background border border-white/10 rounded-xl px-3 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-colors"
                />
                <Button size="sm" className="absolute right-2 bottom-2 h-7 rounded-lg">Send</Button>
             </div>
             <p className="text-[10px] text-muted-foreground text-center mt-2">AI can make mistakes. Verify important information.</p>
          </div>
        </div>

      </div>
    </div>
  );
};
