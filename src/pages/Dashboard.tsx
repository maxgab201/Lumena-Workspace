import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUiStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { UploadCloud, MessageSquare, Clock, Search, FileText, Calendar, MoreVertical, Pencil, Trash, LayoutGrid, List, ArrowDown, ArrowUp, HardDrive, Loader2, Play } from 'lucide-react';
import { ProcessingCenter } from '../components/processing/ProcessingCenter';
import { Button } from '../components/ui/Button';
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { t } from '../i18n';
import { useLanguage } from '../hooks/useLanguage';
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
} from '../components/ui/DropdownMenu';

export const Dashboard = () => {
  const { activeWorkspace, documents, uploadDocument, deleteDocument, renameDocument } = useWorkspaceStore();
  const { viewMode, setViewMode, sortBy, setSortBy, sortOrder, toggleSortOrder } = useUiStore();
  const { user } = useUserStore();
  const navigate = useNavigate();
  useLanguage(); // subscribe to language changes for re-render
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

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
    } catch (error: any) {
      console.error('Failed to upload document', error);
      const msg = error?.message || error?.error?.message || 'Error desconocido al subir el archivo.';
      toast.error('Upload failed', { description: msg });
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

  // Filter and sort documents
  const processedDocuments = useMemo(() => {
    let result = [...documents];
    
    // Search
    if (searchQuery) {
      result = result.filter(d => d.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }

    // Sort
    result.sort((a, b) => {
      let comparison = 0;
      switch (sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'date':
          comparison = new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
          break;
        case 'size':
          comparison = a.size_bytes - b.size_bytes;
          break;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return result;
  }, [documents, searchQuery, sortBy, sortOrder]);

  // The Empty State and Upload Zone
  const renderUploadZone = () => (
    <div className={cn("flex-1 flex flex-col items-center justify-center max-w-2xl mx-auto text-center relative z-10 w-full", documents.length > 0 ? "mb-10" : "")}>
      {!documents.length && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-8">
          <div className="w-24 h-24 bg-gradient-to-br from-accent/20 to-accent/5 rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-[0_0_40px_rgba(var(--accent-hsl),0.1)] border border-white/5 relative group">
             <div className="absolute inset-0 bg-accent/20 rounded-3xl blur-xl group-hover:blur-2xl transition-all opacity-50" />
             <FileText className="w-12 h-12 text-accent relative z-10" strokeWidth={1.5} />
          </div>
          <h2 className="text-3xl md:text-4xl font-heading font-bold tracking-tight mb-4">
            {t('dashboard.buildKnowledge')}
          </h2>
          <p className="text-muted-foreground text-base max-w-lg mx-auto leading-relaxed">
            {t('dashboard.uploadDescription')}
          </p>
        </motion.div>
      )}

      {/* Drag & Drop Zone */}
      <div 
        className={cn(
          "w-full border-2 border-dashed rounded-3xl p-10 transition-all duration-300 relative overflow-hidden group flex flex-col items-center justify-center min-h-[220px]",
          isDragging ? 'border-accent bg-accent/10 shadow-[0_0_30px_rgba(var(--accent-hsl),0.1)] scale-[1.02]' : 'border-white/10 hover:border-accent/40 hover:bg-secondary/20'
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
         {isUploading ? (
           <div className="flex flex-col items-center justify-center space-y-4">
             <Loader2 className="w-10 h-10 text-accent animate-spin" />
             <p className="text-sm font-medium animate-pulse text-foreground">{t('dashboard.processing')}</p>
             <p className="text-xs text-muted-foreground">{t('dashboard.processingDetail')}</p>
           </div>
         ) : (
           <div className="flex flex-col items-center justify-center space-y-4">
             <div className="w-16 h-16 rounded-full bg-background border border-white/5 flex items-center justify-center group-hover:scale-110 transition-transform shadow-lg">
               <UploadCloud className="w-7 h-7 text-muted-foreground group-hover:text-accent transition-colors" />
             </div>
             <div className="space-y-1">
               <p className="text-base font-medium text-foreground">{t('dashboard.clickToUpload')}</p>
               <p className="text-xs text-muted-foreground">{t('dashboard.supportedFiles')}</p>
             </div>
             <label className="cursor-pointer pointer-events-auto mt-2">
               <Button variant="secondary" className="relative z-10 rounded-full px-6 bg-background/50 hover:bg-background border-white/5">
                 {t('dashboard.browseFiles')}
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
      <div className="flex-[2] bg-card/20 backdrop-blur-md border border-white/5 rounded-3xl overflow-hidden shadow-sm flex flex-col relative min-w-0">
        
        {/* Dashboard Header / Welcome Banner */}
        <header className="px-8 pt-8 pb-4 shrink-0 relative z-10">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-heading font-bold tracking-tight text-foreground">
                {t('dashboard.welcome', { name: user?.email?.split('@')[0] || 'Researcher' })}
              </h1>
              <p className="text-muted-foreground mt-1">
                {t('dashboard.docCount', { count: documents.length })} <strong className="text-foreground">{activeWorkspace?.name}</strong>
              </p>
            </div>

            {documents.length > 0 && (
              <div className="flex items-center space-x-2 bg-secondary/30 p-1.5 rounded-lg border border-white/5">
                <div className="flex items-center">
                  <Button 
                    variant={viewMode === 'grid' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-md", viewMode === 'grid' ? "bg-background shadow-sm" : "")}
                    onClick={() => setViewMode('grid')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                    size="icon" 
                    className={cn("h-8 w-8 rounded-md", viewMode === 'list' ? "bg-background shadow-sm" : "")}
                    onClick={() => setViewMode('list')}
                  >
                    <List className="w-4 h-4" />
                  </Button>
                </div>
                <div className="w-px h-5 bg-white/10 mx-1" />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="sm" className="h-8 text-xs font-medium px-2 hover:bg-background">
                      Sort by {sortBy.charAt(0).toUpperCase() + sortBy.slice(1)}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuLabel>Sort by</DropdownMenuLabel>
                    <DropdownMenuRadioGroup value={sortBy} onValueChange={(v) => setSortBy(v as any)}>
                      <DropdownMenuRadioItem value="date">Date Added</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="name">Name</DropdownMenuRadioItem>
                      <DropdownMenuRadioItem value="size">File Size</DropdownMenuRadioItem>
                    </DropdownMenuRadioGroup>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={toggleSortOrder}>
                      <div className="flex items-center w-full">
                        <span>{sortOrder === 'asc' ? 'Ascending' : 'Descending'}</span>
                        {sortOrder === 'asc' ? <ArrowUp size={14} className="ml-auto" /> : <ArrowDown size={14} className="ml-auto" />}
                      </div>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            )}
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8 flex flex-col relative custom-scrollbar">
          {/* Decorative Background Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-accent/5 rounded-full blur-[100px] pointer-events-none animate-blob" />
          <div className="absolute bottom-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-[100px] pointer-events-none animate-blob" style={{ animationDelay: '3s' }} />

          {documents.length > 0 ? (
            <div className="relative z-10 flex flex-col h-full">
              
              <div className="mb-6 flex flex-col md:flex-row md:items-center justify-between gap-4">
                 <div className="relative w-full max-w-sm">
                   <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                   <input
                     placeholder={t('dashboard.searchPlaceholder')}
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-background/50 backdrop-blur-sm border border-white/10 rounded-full pl-9 pr-4 py-2 text-sm focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all shadow-sm"
                   />
                 </div>
              </div>

              {renderUploadZone()}
              
              {processedDocuments.length === 0 ? (
                <div className="py-12 text-center text-muted-foreground">
                  <Search className="w-8 h-8 mx-auto mb-3 opacity-20" />
                  <p>{t('dashboard.noResults', { query: searchQuery })}</p>
                </div>
              ) : (
                <motion.div 
                  layout
                  className={cn(
                    "grid gap-4",
                    viewMode === 'grid' 
                      ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4" 
                      : "grid-cols-1"
                  )}
                >
                  <AnimatePresence>
                    {processedDocuments.map(doc => (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={doc.id} 
                        className={cn(
                          "glass-card border border-white/5 rounded-2xl shadow-sm hover:shadow-xl hover:-translate-y-1 hover:border-accent/30 transition-all duration-300 group cursor-pointer relative overflow-hidden flex",
                          viewMode === 'grid' ? "flex-col h-[220px]" : "flex-row items-center h-20 p-2 pr-4"
                        )} 
                        onClick={() => navigate(`/viewer/${doc.id}`)}
                      >
                        {/* Thumbnail Preview Area */}
                        <div className={cn(
                          "shrink-0 relative overflow-hidden bg-gradient-to-br from-secondary to-background flex items-center justify-center",
                          viewMode === 'grid' ? "h-28 w-full border-b border-white/5" : "h-16 w-16 rounded-xl border border-white/5 ml-1 mr-4"
                        )}>
                           <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/50 to-transparent" />
                           <FileText className={cn("text-muted-foreground/30", viewMode === 'grid' ? "w-10 h-10" : "w-6 h-6")} />
                           
                           {/* Hover overlay for grid */}
                           {viewMode === 'grid' && (
                             <div className="absolute inset-0 bg-background/40 backdrop-blur-[2px] opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                               <div className="w-10 h-10 rounded-full bg-accent text-white flex items-center justify-center shadow-lg transform translate-y-2 group-hover:translate-y-0 transition-all">
                                 <Play size={16} className="ml-1" fill="currentColor" />
                               </div>
                             </div>
                           )}
                        </div>

                        {/* Content Area */}
                        <div className={cn("flex-1 min-w-0 flex flex-col justify-center", viewMode === 'grid' ? "p-4" : "")}>
                          <div className="flex items-start justify-between">
                            <p className="font-semibold text-sm line-clamp-1 group-hover:text-accent transition-colors truncate" title={doc.name}>
                              {doc.name}
                            </p>
                            
                            {/* Dropdown Menu */}
                            <div className={cn(viewMode === 'grid' ? "" : "ml-4 shrink-0")}>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button 
                                    variant="ghost" 
                                    size="icon" 
                                    className="h-6 w-6 text-muted-foreground hover:text-foreground relative z-20 hover:bg-secondary/50 rounded-md"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                    }}
                                  >
                                    <MoreVertical className="h-3.5 w-3.5" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="w-40 border-white/10 bg-background/95 backdrop-blur-xl">
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
                                    <Pencil className="w-4 h-4 mr-2" /> Rename
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator className="bg-white/10" />
                                  <DropdownMenuItem 
                                    className="text-red-500 focus:bg-red-500/10 focus:text-red-500"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (window.confirm('Are you sure you want to delete this document?')) {
                                        deleteDocument(doc.id).catch(() => toast.error('Failed to delete document'));
                                      }
                                    }}
                                  >
                                    <Trash className="w-4 h-4 mr-2" /> Delete
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                            </div>
                          </div>

                          <div className="flex items-center text-[11px] text-muted-foreground mt-1.5 font-medium">
                            <span className={cn(
                              "px-1.5 py-0.5 rounded uppercase tracking-wider font-bold mr-2 text-[9px]",
                              doc.status === 'ready' ? 'bg-emerald-500/10 text-emerald-500' :
                              doc.status === 'processing' ? 'bg-amber-500/10 text-amber-500' :
                              doc.status === 'error' ? 'bg-rose-500/10 text-rose-500' :
                              'bg-blue-500/10 text-blue-500'
                            )}>
                              {doc.status}
                            </span>
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(doc.created_at).toLocaleDateString()}
                            <span className="mx-1.5 opacity-50">•</span>
                            <HardDrive className="w-3 h-3 mr-1" />
                            {(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>
                </motion.div>
              )}
            </div>
          ) : (
            <div className="h-full flex items-center justify-center">
              {renderUploadZone()}
            </div>
          )}
        </div>
      </div>

      {/* Right Sidebar: Context & Assistant (Desktop only) */}
      <div className="flex-1 hidden lg:flex flex-col gap-4 overflow-hidden min-w-[320px] max-w-[380px]">
        
        {/* Assistant Promotion / Tip */}
        <div className="shrink-0 bg-gradient-to-br from-accent/20 to-accent/5 border border-accent/20 rounded-3xl p-6 relative overflow-hidden group shadow-lg shadow-accent/5">
          <div className="absolute top-0 right-0 w-32 h-32 bg-accent/20 rounded-full blur-2xl transform translate-x-10 -translate-y-10 group-hover:bg-accent/30 transition-colors" />
          <div className="relative z-10">
            <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-md shadow-accent/20 mb-4">
              <MessageSquare size={18} fill="currentColor" />
            </div>
            <h3 className="font-heading font-semibold text-lg mb-1">{t('dashboard.globalSearch')}</h3>
            <p className="text-sm text-muted-foreground/90 leading-relaxed mb-4">
              {t('dashboard.globalSearchDesc')} <kbd className="font-mono text-xs px-1.5 py-0.5 bg-background rounded border border-white/10 text-foreground">⌘ K</kbd> {t('dashboard.globalSearchKey')}
            </p>
            <Button variant="secondary" size="sm" className="w-full bg-background hover:bg-background/80 border-white/5 shadow-sm text-xs h-9 rounded-full">
              {t('dashboard.tryGlobalSearch')}
            </Button>
          </div>
        </div>

        <ProcessingCenter />

        {/* Recent Activity */}
        <div className="flex-1 glass-card border border-white/5 rounded-3xl shadow-sm overflow-hidden flex flex-col">
          <div className="h-14 border-b border-white/5 flex items-center px-6 shrink-0 bg-background/30 backdrop-blur-sm">
            <Clock className="w-4 h-4 text-muted-foreground mr-2" />
            <span className="text-sm font-semibold">{t('dashboard.recentActivity')}</span>
          </div>
          <div className="flex-1 p-6 overflow-y-auto space-y-5 custom-scrollbar">
            {documents.length === 0 ? (
              <div className="text-center text-muted-foreground text-sm py-4">{t('dashboard.noActivity')}</div>
            ) : (
              documents.slice(0, 5).map(doc => (
                <div key={`act-${doc.id}`} className="flex gap-4 relative before:absolute before:left-[5px] before:top-4 before:bottom-[-20px] before:w-[2px] before:bg-white/5 last:before:hidden">
                   <div className="w-3 h-3 mt-1 rounded-full bg-accent shrink-0 shadow-[0_0_10px_rgba(var(--accent-hsl),0.5)] z-10 ring-4 ring-background" />
                   <div>
                      <p className="text-sm text-foreground">{t('dashboard.added')} <strong className="font-medium text-accent hover:underline cursor-pointer" onClick={() => navigate(`/viewer/${doc.id}`)}>{doc.name}</strong></p>
                      <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                        <Clock size={10} /> {new Date(doc.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                      </p>
                   </div>
                </div>
              ))
            )}
            <div className="flex gap-4 z-10 relative">
               <div className="w-3 h-3 mt-1 rounded-full bg-secondary shrink-0 ring-4 ring-background" />
               <div>
                  <p className="text-sm text-foreground">{t('dashboard.workspaceInitialized')} <strong>{activeWorkspace?.name}</strong></p>
                  <p className="text-xs text-muted-foreground mt-1">{t('dashboard.sessionStart')}</p>
               </div>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
};
