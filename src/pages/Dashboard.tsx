import { useWorkspaceStore } from '../stores/workspaceStore';
import { useUiStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { useShallow } from 'zustand/react/shallow';
import { UploadCloud, Clock, Search, FileText, Calendar, MoreVertical, Pencil, Trash, LayoutGrid, List, ArrowDown, ArrowUp, HardDrive, Loader2, Play, RotateCcw, X } from 'lucide-react';
import { ProcessingCenter } from '../components/processing/ProcessingCenter';
import { DocumentRepository } from '../repositories/document.repository';
import { Button } from '../components/ui/Button';
import { useState, useMemo, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '../lib/utils';
import { t } from '../i18n';
import { useLanguage } from '../hooks/useLanguage';
import { getDocumentStage, isDocumentReady, type DocumentStage } from '../types/documents';
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

interface UploadQueueItem {
  id: string;
  file: File;
  progress: number;
  status: 'pending' | 'uploading' | 'error';
  error?: string;
}

function getStageLabel(stage: DocumentStage): string {
  switch (stage) {
    case 'uploading': return t('document.status.uploading');
    case 'uploaded': return t('document.status.uploaded');
    case 'processing': return t('document.status.processing');
    case 'ocr': return t('document.status.ocr');
    case 'analyzing': return t('document.status.analyzing');
    case 'ready': return t('document.status.ready');
    case 'failed': return t('document.status.failed');
  }
}

function getStageStyles(stage: DocumentStage): string {
  switch (stage) {
    case 'ready': return 'bg-emerald-500/10 text-emerald-500';
    case 'failed': return 'bg-rose-500/10 text-rose-500';
    case 'ocr': return 'bg-violet-500/10 text-violet-400';
    case 'analyzing': return 'bg-cyan-500/10 text-cyan-400';
    case 'processing': return 'bg-amber-500/10 text-amber-500';
    default: return 'bg-blue-500/10 text-blue-500';
  }
}

export const Dashboard = () => {
  const { activeWorkspace, workspaces, documents, deleteDocument, renameDocument, retryDocument, fetchWorkspaces, uploadDocument, deleteDocumentsBulk, moveDocumentsBulk, copyDocumentsBulk } = useWorkspaceStore(useShallow(state => ({
    activeWorkspace: state.activeWorkspace,
    workspaces: state.workspaces,
    documents: state.documents,
    deleteDocument: state.deleteDocument,
    renameDocument: state.renameDocument,
    retryDocument: state.retryDocument,
    fetchWorkspaces: state.fetchWorkspaces,
    uploadDocument: state.uploadDocument,
    deleteDocumentsBulk: state.deleteDocumentsBulk,
    moveDocumentsBulk: state.moveDocumentsBulk,
    copyDocumentsBulk: state.copyDocumentsBulk,
  })));
  const { viewMode, setViewMode, sortBy, setSortBy, sortOrder, toggleSortOrder } = useUiStore(useShallow(state => ({
    viewMode: state.viewMode,
    setViewMode: state.setViewMode,
    sortBy: state.sortBy,
    setSortBy: state.setSortBy,
    sortOrder: state.sortOrder,
    toggleSortOrder: state.toggleSortOrder,
  })));
  const { user } = useUserStore(useShallow(state => ({ user: state.user })));
  const navigate = useNavigate();
  useLanguage(); // subscribe to language changes for re-render
  const [isDragging, setIsDragging] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const uploadControllers = useRef(new Map<string, AbortController>());
  const queuedFileKeys = useRef(new Set<string>());
  const uploadChain = useRef(Promise.resolve());

  // Selection state for bulk actions
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const toggleSelected = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const targetWorkspaces = workspaces.filter(w => w.id !== activeWorkspace?.id);

  const deleteSelected = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    if (!window.confirm(`Delete ${ids.length} document(s)?`)) return;
    await deleteDocumentsBulk(ids).catch(() => {});
    clearSelection();
  };

  const moveSelected = async (targetWorkspaceId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await moveDocumentsBulk(ids, targetWorkspaceId).catch(() => {});
    clearSelection();
  };

  const copySelected = async (targetWorkspaceId: string) => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0) return;
    await copyDocumentsBulk(ids, targetWorkspaceId).catch(() => {});
    clearSelection();
  };

  useEffect(() => {
    fetchWorkspaces();
  }, [fetchWorkspaces]);

  // Resolve thumbnail storage paths to signed URLs
  const [thumbnailUrls, setThumbnailUrls] = useState<Record<string, string>>({});
  const thumbnailDocs = documents.filter(d => d.thumbnail_path);
  const thumbnailKey = thumbnailDocs.map(d => d.id).join(',');
  useEffect(() => {
    if (thumbnailDocs.length === 0) return;
    let cancelled = false;
    DocumentRepository.getSignedUrls(thumbnailDocs.map(d => d.thumbnail_path!))
      .then(map => {
        if (!cancelled) setThumbnailUrls(prev => ({ ...prev, ...map }));
      })
      .catch(() => {});
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [thumbnailKey]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  };

  const runQueuedUpload = async (item: UploadQueueItem) => {
    const fileKey = `${item.file.name}:${item.file.size}:${item.file.lastModified}`;
    if (!queuedFileKeys.current.has(fileKey)) return;

    const controller = new AbortController();
    uploadControllers.current.set(item.id, controller);
    setUploadQueue(previous => previous.map(queueItem =>
      queueItem.id === item.id
        ? { ...queueItem, status: 'uploading', progress: 0, error: undefined }
        : queueItem
    ));

    try {
      await uploadDocument(item.file, {
        signal: controller.signal,
        onProgress: (progress) => {
          setUploadQueue(previous => previous.map(queueItem =>
            queueItem.id === item.id ? { ...queueItem, progress } : queueItem
          ));
        },
      });
      queuedFileKeys.current.delete(fileKey);
      setUploadQueue(previous => previous.filter(queueItem => queueItem.id !== item.id));
      toast.success(t('upload.started'), { description: item.file.name });
    } catch (error: unknown) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        queuedFileKeys.current.delete(fileKey);
        setUploadQueue(previous => previous.filter(queueItem => queueItem.id !== item.id));
      } else {
        const message = error instanceof Error ? error.message : t('common.uploadError');
        setUploadQueue(previous => previous.map(queueItem =>
          queueItem.id === item.id
            ? { ...queueItem, status: 'error', error: message }
            : queueItem
        ));
      }
    } finally {
      uploadControllers.current.delete(item.id);
    }
  };

  const scheduleUpload = (item: UploadQueueItem) => {
    uploadChain.current = uploadChain.current.then(() => runQueuedUpload(item));
  };

  const addFilesToQueue = async (files: File[]) => {
    if (!activeWorkspace) {
      toast.error(t('upload.workspaceLoading'));
      return;
    }

    const validFiles: File[] = [];
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      const hasPdfType = file.type === '' || file.type === 'application/pdf';
      const hasPdfExtension = file.name.toLowerCase().endsWith('.pdf');
      if (!hasPdfType || !hasPdfExtension) {
        toast.error(t('common.invalidFileType'), { description: `${file.name}: ${t('common.onlyPdf')}` });
        continue;
      }
      if (file.size > 50 * 1024 * 1024) {
        toast.error(t('common.fileTooLarge'), { description: `${file.name}: ${t('common.fileTooLargeDesc')}` });
        continue;
      }
      if ((await file.slice(0, 5).text()) !== '%PDF-') {
        toast.error(t('common.invalidFileType'), { description: `${file.name}: ${t('upload.invalidContents')}` });
        continue;
      }

      const fileKey = `${file.name}:${file.size}:${file.lastModified}`;
      if (queuedFileKeys.current.has(fileKey)) {
        toast.error(t('upload.duplicateQueue'), { description: file.name });
        continue;
      }
      queuedFileKeys.current.add(fileKey);
      validFiles.push(file.type === 'application/pdf'
        ? file
        : new File([file], file.name, { type: 'application/pdf', lastModified: file.lastModified }));
    }

    if (validFiles.length > 0) {
      const newItems: UploadQueueItem[] = validFiles.map(file => ({
        id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        file,
        progress: 0,
        status: 'pending' as const,
      }));
      setUploadQueue(prev => [...prev, ...newItems]);
      newItems.forEach(scheduleUpload);
    }
  };

  const cancelUpload = (item: UploadQueueItem) => {
    const controller = uploadControllers.current.get(item.id);
    if (controller) {
      controller.abort();
      return;
    }

    queuedFileKeys.current.delete(`${item.file.name}:${item.file.size}:${item.file.lastModified}`);
    setUploadQueue(previous => previous.filter(queueItem => queueItem.id !== item.id));
  };

  const retryUpload = (item: UploadQueueItem) => {
    setUploadQueue(previous => previous.map(queueItem =>
      queueItem.id === item.id
        ? { ...queueItem, status: 'pending', progress: 0, error: undefined }
        : queueItem
    ));
    scheduleUpload({ ...item, status: 'pending', progress: 0, error: undefined });
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    if (!activeWorkspace) {
      toast.error(t('upload.workspaceLoading'));
      return;
    }

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      void addFilesToQueue(Array.from(e.dataTransfer.files));
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      // FileList is live; copy it before clearing the input so every selected PDF survives awaits.
      const selectedFiles = Array.from(e.target.files);
      e.target.value = '';
      void addFilesToQueue(selectedFiles);
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
         {uploadQueue.length > 0 ? (
           <div className="w-full max-w-xl space-y-3 text-left">
             <div className="flex items-center justify-between gap-3">
               <div>
                 <p className="text-sm font-semibold text-foreground">{t('upload.queueTitle')}</p>
                 <p className="text-xs text-muted-foreground">{t('upload.queueDescription')}</p>
               </div>
               <Button
                 type="button"
                 variant="secondary"
                 size="sm"
                 className="h-8 rounded-full text-xs"
                 onClick={() => fileInputRef.current?.click()}
                 disabled={!activeWorkspace}
               >
                 {t('upload.addMore')}
               </Button>
               <input
                 ref={fileInputRef}
                 type="file"
                 className="hidden"
                 accept="application/pdf,.pdf"
                 onChange={handleFileSelect}
                 disabled={!activeWorkspace}
                 multiple
               />
             </div>

             <div className="space-y-2" aria-live="polite">
               {uploadQueue.map(item => (
                 <div key={item.id} className="rounded-xl border border-white/10 bg-background/50 p-3">
                   <div className="flex items-start gap-3">
                     {item.status === 'uploading' ? (
                       <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-accent" />
                     ) : (
                       <FileText className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                     )}
                     <div className="min-w-0 flex-1">
                       <p className="truncate text-sm font-medium">{item.file.name}</p>
                       <p className={cn('mt-0.5 text-xs', item.status === 'error' ? 'text-rose-400' : 'text-muted-foreground')}>
                         {item.status === 'pending' && t('upload.waiting')}
                         {item.status === 'uploading' && t('upload.progress', { progress: item.progress })}
                         {item.status === 'error' && item.error}
                       </p>
                       {item.status === 'uploading' && (
                         <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/10">
                           <div
                             className="h-full bg-accent transition-[width] duration-200"
                             style={{ width: `${item.progress}%` }}
                           />
                         </div>
                       )}
                     </div>
                     {item.status === 'error' ? (
                       <div className="flex items-center gap-1">
                         <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={() => retryUpload(item)}>
                           <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> {t('upload.retry')}
                         </Button>
                         <Button
                           variant="ghost"
                           size="icon"
                           className="h-8 w-8"
                           aria-label={t('upload.dismissFile', { name: item.file.name })}
                           onClick={() => cancelUpload(item)}
                         >
                           <X className="h-4 w-4" />
                         </Button>
                       </div>
                     ) : (
                       <Button
                         variant="ghost"
                         size="icon"
                         className="h-8 w-8"
                         aria-label={t('upload.cancelFile', { name: item.file.name })}
                         onClick={() => cancelUpload(item)}
                       >
                         <X className="h-4 w-4" />
                       </Button>
                     )}
                   </div>
                 </div>
               ))}
             </div>
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
             <Button
               type="button"
               variant="secondary"
               className="relative z-10 mt-2 rounded-full border-white/5 bg-background/50 px-6 hover:bg-background"
               onClick={() => fileInputRef.current?.click()}
               disabled={!activeWorkspace}
             >
               {activeWorkspace ? t('dashboard.browseFiles') : t('upload.workspaceLoading')}
             </Button>
             <input
               ref={fileInputRef}
               type="file"
               className="hidden"
               accept="application/pdf,.pdf"
               onChange={handleFileSelect}
               disabled={!activeWorkspace}
               multiple
             />
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
                     aria-label={t('dashboard.gridView')}
                     title={t('dashboard.gridView')}
                  >
                    <LayoutGrid className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant={viewMode === 'list' ? 'secondary' : 'ghost'} 
                     size="icon"
                     className={cn("h-8 w-8 rounded-md", viewMode === 'list' ? "bg-background shadow-sm" : "")}
                     onClick={() => setViewMode('list')}
                     aria-label={t('dashboard.listView')}
                     title={t('dashboard.listView')}
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

              {selectedIds.size > 0 && (
                <div className="mb-4 flex flex-wrap items-center gap-2 bg-accent/10 border border-accent/30 rounded-2xl px-4 py-2.5 relative z-20">
                  <span className="text-sm font-medium mr-1">{selectedIds.size} selected</span>
                  <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearSelection}>Clear</Button>
                  <div className="flex-1" />
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-8 text-xs">Move to...</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {targetWorkspaces.length === 0 ? (
                        <DropdownMenuItem disabled>No other workspaces</DropdownMenuItem>
                      ) : (
                        targetWorkspaces.map(w => (
                          <DropdownMenuItem key={w.id} onClick={() => moveSelected(w.id)}>{w.name}</DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="secondary" size="sm" className="h-8 text-xs">Copy to...</Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      {targetWorkspaces.length === 0 ? (
                        <DropdownMenuItem disabled>No other workspaces</DropdownMenuItem>
                      ) : (
                        targetWorkspaces.map(w => (
                          <DropdownMenuItem key={w.id} onClick={() => copySelected(w.id)}>{w.name}</DropdownMenuItem>
                        ))
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                  <Button variant="secondary" size="sm" className="h-8 text-xs text-red-500 hover:text-red-500" onClick={deleteSelected}>Delete</Button>
                </div>
              )}

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
                    {processedDocuments.map(doc => {
                      const stage = getDocumentStage(doc);
                      const ready = isDocumentReady(doc);
                      return (
                      <motion.div 
                        layout
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        transition={{ duration: 0.2 }}
                        key={doc.id} 
                        className={cn(
                          "glass-card border border-white/5 rounded-2xl shadow-sm transition-all duration-300 group relative overflow-hidden flex",
                          ready && "cursor-pointer hover:shadow-xl hover:-translate-y-1 hover:border-accent/30",
                          !ready && "cursor-default",
                          viewMode === 'grid' ? "flex-col min-h-[220px]" : "flex-row items-center min-h-20 p-2 pr-4"
                        )} 
                        data-testid={`document-card-${doc.id}`}
                        role={ready ? 'button' : undefined}
                        tabIndex={ready ? 0 : -1}
                        onClick={() => {
                          if (ready) navigate(`/viewer/${doc.id}`);
                        }}
                        onKeyDown={(event) => {
                          if (ready && (event.key === 'Enter' || event.key === ' ')) {
                            event.preventDefault();
                            navigate(`/viewer/${doc.id}`);
                          }
                        }}
                      >
                        {/* Thumbnail Preview Area */}
                        <div className={cn(
                          "shrink-0 relative overflow-hidden bg-gradient-to-br from-secondary to-background flex items-center justify-center",
                          viewMode === 'grid' ? "h-28 w-full border-b border-white/5" : "h-16 w-16 rounded-xl border border-white/5 ml-1 mr-4"
                        )}>
                           <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/50 to-transparent" />
                           {doc.thumbnail_path && thumbnailUrls[doc.thumbnail_path] ? (
                             <img
                               src={thumbnailUrls[doc.thumbnail_path]}
                               alt=""
                               className={cn(
                                 "w-full h-full object-cover",
                                 viewMode === 'grid' ? "w-full h-full" : "w-full h-full rounded-lg"
                               )}
                               loading="lazy"
                             />
                           ) : (
                             <>
                               <div className="absolute inset-0 opacity-10 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-accent/50 to-transparent" />
                               <FileText className={cn("text-muted-foreground/30", viewMode === 'grid' ? "w-10 h-10" : "w-6 h-6")} />
                             </>
                           )}

                          {/* Selection checkbox */}
                          <label
                            className="absolute top-2 left-2 z-30 cursor-pointer"
                            onClick={(e) => e.stopPropagation()}
                          >
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-white/20 bg-background/80 accent-[var(--accent)]"
                              checked={selectedIds.has(doc.id)}
                              onChange={() => toggleSelected(doc.id)}
                            />
                          </label>

                           {/* Hover overlay for grid */}
                           {viewMode === 'grid' && ready && (
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
                                    aria-label="Document actions"
                                    data-testid="doc-actions-btn"
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
                            <span
                              className={cn(
                                "px-1.5 py-0.5 rounded uppercase tracking-wider font-bold mr-2 text-[9px]",
                                getStageStyles(stage),
                              )}
                              data-testid={`document-status-${doc.id}`}
                            >
                              {getStageLabel(stage)}
                            </span>
                            <Calendar className="w-3 h-3 mr-1" />
                            {new Date(doc.created_at).toLocaleDateString()}
                            <span className="mx-1.5 opacity-50">•</span>
                            <HardDrive className="w-3 h-3 mr-1" />
                            {(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB
                          </div>
                          {!ready && stage !== 'failed' && (
                            <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/10">
                              <div
                                className="h-full bg-accent transition-[width] duration-300"
                                style={{ width: `${Math.max(doc.progress ?? 0, 3)}%` }}
                              />
                            </div>
                          )}
                          {stage === 'failed' && (
                            <div className="mt-2 flex items-center gap-2">
                              <p className="min-w-0 flex-1 truncate text-xs text-rose-400" title={doc.processing_error || t('document.processingFailed')}>
                                {doc.processing_error || t('document.processingFailed')}
                              </p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 shrink-0 text-xs"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  retryDocument(doc.id).catch(() => toast.error(t('document.retryFailed')));
                                }}
                              >
                                <RotateCcw className="mr-1 h-3.5 w-3.5" /> {t('upload.retry')}
                              </Button>
                            </div>
                          )}
                        </div>
                      </motion.div>
                      );
                    })}
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
                      <p className="text-sm text-foreground">{t('dashboard.added')} <strong
                        className={cn(
                          'font-medium text-accent',
                          isDocumentReady(doc) && 'cursor-pointer hover:underline',
                        )}
                        onClick={() => {
                          if (isDocumentReady(doc)) navigate(`/viewer/${doc.id}`);
                        }}
                      >{doc.name}</strong></p>
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
