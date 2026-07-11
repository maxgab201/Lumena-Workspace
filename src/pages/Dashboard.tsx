import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUserStore } from '../stores/userStore';
import { UploadCloud, MessageSquare, Clock, Search, File, Loader2 } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useState } from 'react';

export const Dashboard = () => {
  const { workspaces, activeWorkspaceId } = useWorkspaceStore();
  const { user } = useUserStore();
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);

  const activeWorkspace = workspaces.find(w => w.id === activeWorkspaceId) || workspaces[0];

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // Mock upload
      setIsUploading(true);
      setTimeout(() => setIsUploading(false), 2000);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // Mock upload
      setIsUploading(true);
      setTimeout(() => setIsUploading(false), 2000);
    }
  };

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      
      {/* Center Panel: Empty State & Upload */}
      <div className="flex-[2] bg-card border border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
        <header className="h-14 border-b border-white/5 flex items-center px-6 shrink-0 bg-background/50 backdrop-blur-sm z-10">
           <h1 className="text-lg font-heading font-semibold tracking-tight">Documents</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col relative">
          
          {/* Decorative Background Elements */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none" />

          {/* Premium Empty State */}
          <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto text-center relative z-10">
             
             <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center mb-6 shadow-inner shadow-white/5 border border-white/5">
                <File className="w-10 h-10 text-accent/80" />
             </div>

             <h2 className="text-3xl font-heading font-semibold tracking-tight mb-3">
               Create your knowledge workspace
             </h2>
             <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
               Upload your PDFs to instantly analyze, query, and extract insights. Lumena transforms static documents into an interactive intelligence layer.
             </p>

             {/* Drag & Drop Zone */}
             <div 
               className={`w-full border-2 border-dashed rounded-2xl p-8 transition-all duration-300 relative overflow-hidden group ${
                 isDragging ? 'border-accent bg-accent/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
               }`}
               onDragOver={handleDragOver}
               onDragLeave={handleDragLeave}
               onDrop={handleDrop}
             >
                {isUploading ? (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <Loader2 className="w-8 h-8 text-accent animate-spin" />
                    <p className="text-sm font-medium animate-pulse">Processing document...</p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center space-y-4">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center group-hover:scale-110 transition-transform">
                      <UploadCloud className="w-5 h-5 text-muted-foreground group-hover:text-foreground transition-colors" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Click to upload or drag and drop</p>
                      <p className="text-xs text-muted-foreground mt-1">PDF up to 50MB</p>
                    </div>
                    <label className="cursor-pointer">
                      <Button variant="secondary" size="sm" className="mt-2 relative z-10 pointer-events-none">
                        Browse Files
                      </Button>
                      <input type="file" className="hidden" accept=".pdf" onChange={handleFileSelect} />
                    </label>
                  </div>
                )}
             </div>

          </div>
        </div>
      </div>

      {/* Right Sidebar: AI Assistant & Context */}
      <div className="flex-1 hidden lg:flex flex-col gap-4 overflow-hidden min-w-[320px] max-w-[400px]">
        
        {/* Search Placeholder */}
        <div className="shrink-0">
          <div className="relative">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
            <input 
              placeholder="Search in workspace..." 
              className="w-full bg-card border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-sm"
            />
          </div>
        </div>

        {/* AI Assistant Placeholder */}
        <div className="flex-1 flex flex-col bg-card border border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-12 border-b border-white/5 flex items-center px-4 shrink-0 bg-background/30">
            <MessageSquare className="w-4 h-4 text-accent mr-2" />
            <span className="text-sm font-medium">Workspace Assistant</span>
          </div>
          
          <div className="flex-1 p-4 flex items-center justify-center text-center">
             <div className="space-y-3">
               <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                 <MessageSquare className="w-6 h-6 text-accent" />
               </div>
               <p className="text-sm font-medium">No documents selected</p>
               <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                 Upload a document to start chatting with your knowledge base.
               </p>
             </div>
          </div>
        </div>

        {/* Recent Activity Mock */}
        <div className="flex-[0.8] bg-card border border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="h-12 border-b border-white/5 flex items-center px-4 shrink-0 bg-background/30">
            <Clock className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium">Recent Activity</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            <div className="flex gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-accent shrink-0" />
               <div>
                  <p className="text-sm text-foreground">Workspace <strong>{activeWorkspace?.name}</strong> created</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Just now</p>
               </div>
            </div>
            <div className="flex gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-secondary shrink-0" />
               <div>
                  <p className="text-sm text-foreground">Logged in via {user?.email?.includes('gmail') ? 'Google' : 'GitHub'}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">A few minutes ago</p>
               </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
