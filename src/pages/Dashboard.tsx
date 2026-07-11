import { useWorkspaceStore } from '../stores/workspaceStore';
import { UploadCloud, MessageSquare, Clock, Search, File, Loader2, FileText, Calendar, MoreVertical, Pencil, Trash } from 'lucide-react';
import { Button } from '../components/ui/Button';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../components/ui/DropdownMenu';

export const Dashboard = () => {
  const { workspaces, activeWorkspaceId, documents, uploadDocument, deleteDocument, renameDocument } = useWorkspaceStore();
  const navigate = useNavigate();
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

  const processUpload = async (file: File) => {
    if (file.type !== 'application/pdf') {
      toast.error('Invalid file type', { description: 'Only PDF files are supported.' });
      return;
    }
    if (file.size > 50 * 1024 * 1024) {
      toast.error('File too large', { description: 'File exceeds the 50MB limit.' });
      return;
    }

    try {
      setIsUploading(true);
      await uploadDocument(file);
      toast.success('Document uploaded successfully');
    } catch (error) {
      console.error('Failed to upload document', error);
      toast.error('Upload failed', { description: 'An error occurred while uploading the document.' });
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      processUpload(e.dataTransfer.files[0]);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      processUpload(e.target.files[0]);
    }
  };

  // The Empty State and Upload Zone
  const renderUploadZone = () => (
    <div className="flex-1 flex flex-col items-center justify-center max-w-lg mx-auto text-center relative z-10">
      {!documents.length && (
        <>
          <div className="w-20 h-20 bg-gradient-to-br from-accent/20 to-accent/5 rounded-2xl flex items-center justify-center mb-6 shadow-inner shadow-white/5 border border-white/5">
             <File className="w-10 h-10 text-accent/80" />
          </div>
          <h2 className="text-3xl font-heading font-semibold tracking-tight mb-3">
            Create your knowledge workspace
          </h2>
          <p className="text-muted-foreground text-sm mb-8 leading-relaxed">
            Upload your PDFs to instantly analyze, query, and extract insights. Lumena transforms static documents into an interactive intelligence layer.
          </p>
        </>
      )}

      {/* Drag & Drop Zone */}
      <div 
        className={`w-full border-2 border-dashed rounded-2xl p-8 transition-all duration-300 relative overflow-hidden group ${
          isDragging ? 'border-accent bg-accent/5' : 'border-white/10 hover:border-white/20 hover:bg-white/[0.02]'
        } ${documents.length ? 'mb-8' : ''}`}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
         {isUploading ? (
           <div className="flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-8 h-8 text-accent animate-spin" />
             <p className="text-sm font-medium animate-pulse">Uploading document...</p>
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
               <input type="file" className="hidden" accept=".pdf" onChange={handleFileSelect} disabled={isUploading} />
             </label>
           </div>
         )}
      </div>
    </div>
  );

  return (
    <div className="h-full flex gap-4 overflow-hidden">
      
      {/* Center Panel: Documents & Upload */}
      <div className="flex-[2] bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden shadow-sm flex flex-col relative">
        <header className="h-14 border-b border-white/5 flex items-center px-6 shrink-0 bg-background/50 backdrop-blur-md z-10">
           <h1 className="text-lg font-heading font-semibold tracking-tight">Documents</h1>
        </header>

        <div className="flex-1 overflow-y-auto p-6 md:p-10 flex flex-col relative">
          {/* Decorative Background Elements */}
          <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-blob" />
          <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none animate-blob" style={{ animationDelay: '3s' }} />

          {documents.length > 0 ? (
            <div className="relative z-10 flex flex-col h-full">
              {renderUploadZone()}
              
              <div className="mt-8">
                <h3 className="text-sm font-medium text-muted-foreground mb-4">Workspace Documents</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {documents.map(doc => (
                    <div key={doc.id} className="bg-card/30 backdrop-blur-sm border border-white/5 p-4 rounded-xl shadow-sm hover:border-white/10 transition-colors group cursor-pointer flex flex-col h-[140px] relative" onClick={() => navigate(`/viewer/${doc.id}`)}>
                      <div className="flex items-start justify-between mb-2">
                        <div className="w-10 h-10 rounded-lg bg-secondary flex items-center justify-center shrink-0">
                          <FileText className="w-5 h-5 text-accent" />
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={`text-xs px-2 py-1 rounded-md font-medium ${
                            doc.status === 'ready' ? 'bg-green-500/10 text-green-500' :
                            doc.status === 'processing' ? 'bg-yellow-500/10 text-yellow-500' :
                            doc.status === 'error' ? 'bg-red-500/10 text-red-500' :
                            'bg-blue-500/10 text-blue-500'
                          }`}>
                            {doc.status.charAt(0).toUpperCase() + doc.status.slice(1)}
                          </span>
                          
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="h-7 w-7 text-muted-foreground hover:text-foreground relative z-20"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                }}
                                aria-label="More options"
                              >
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-40">
                              <DropdownMenuItem 
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const newName = window.prompt('Enter new document name:', doc.name);
                                  if (newName && newName.trim() !== doc.name) {
                                    const finalName = newName.trim().endsWith('.pdf') ? newName.trim() : `${newName.trim()}.pdf`;
                                    renameDocument(doc.id, finalName).catch(() => toast.error('Failed to rename document'));
                                  }
                                }}
                              >
                                <Pencil className="w-4 h-4 mr-2" />
                                Rename
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem 
                                className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (window.confirm('Are you sure you want to delete this document?')) {
                                    deleteDocument(doc.id, doc.file_path).catch(() => toast.error('Failed to delete document'));
                                  }
                                }}
                              >
                                <Trash className="w-4 h-4 mr-2" />
                                Delete
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      </div>
                      <p className="font-medium text-sm line-clamp-2 mt-auto group-hover:text-accent transition-colors" title={doc.name}>
                        {doc.name}
                      </p>
                      <div className="flex items-center text-xs text-muted-foreground mt-2">
                        <Calendar className="w-3 h-3 mr-1" />
                        {new Date(doc.created_at).toLocaleDateString()}
                        <span className="mx-2">•</span>
                        {(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            renderUploadZone()
          )}
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
              className="w-full bg-card/40 backdrop-blur-sm border border-white/5 rounded-xl pl-9 pr-4 py-2.5 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-sm"
            />
          </div>
        </div>

        {/* AI Assistant Placeholder */}
        <div className="flex-1 flex flex-col bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl shadow-sm overflow-hidden">
          <div className="h-12 border-b border-white/5 flex items-center px-4 shrink-0 bg-background/30 backdrop-blur-sm">
            <MessageSquare className="w-4 h-4 text-accent mr-2" />
            <span className="text-sm font-medium">Workspace Assistant</span>
          </div>
          
          <div className="flex-1 p-4 flex items-center justify-center text-center">
             <div className="space-y-3">
               <div className="w-12 h-12 bg-accent/10 rounded-full flex items-center justify-center mx-auto">
                 <MessageSquare className="w-6 h-6 text-accent" />
               </div>
               <p className="text-sm font-medium">
                 {documents.length > 0 ? "Assistant is ready" : "No documents selected"}
               </p>
               <p className="text-xs text-muted-foreground max-w-[200px] mx-auto">
                 {documents.length > 0 
                   ? "Select a document to start asking questions or extracting insights."
                   : "Upload a document to start chatting with your knowledge base."}
               </p>
             </div>
          </div>
        </div>

        {/* Recent Activity Mock */}
        <div className="flex-[0.8] bg-card/40 backdrop-blur-md border border-white/5 rounded-2xl shadow-sm overflow-hidden flex flex-col">
          <div className="h-12 border-b border-white/5 flex items-center px-4 shrink-0 bg-background/30 backdrop-blur-sm">
            <Clock className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-sm font-medium">Recent Activity</span>
          </div>
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {documents.slice(0, 3).map(doc => (
              <div key={`act-${doc.id}`} className="flex gap-3">
                 <div className="w-2 h-2 mt-1.5 rounded-full bg-accent shrink-0" />
                 <div>
                    <p className="text-sm text-foreground">Uploaded <strong>{doc.name}</strong></p>
                    <p className="text-xs text-muted-foreground mt-0.5">Recently</p>
                 </div>
              </div>
            ))}
            <div className="flex gap-3">
               <div className="w-2 h-2 mt-1.5 rounded-full bg-secondary shrink-0" />
               <div>
                  <p className="text-sm text-foreground">Workspace <strong>{activeWorkspace?.name}</strong> active</p>
                  <p className="text-xs text-muted-foreground mt-0.5">Current session</p>
               </div>
            </div>
          </div>
        </div>

      </div>

    </div>
  );
};
