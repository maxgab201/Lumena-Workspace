import { useState } from 'react';
import { X, CheckSquare, Square } from 'lucide-react';
import { Button } from '../ui/Button';
import { t } from '../../i18n';

interface PageSelectionDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onProcess: (selectedPages: number[]) => void;
  totalPages: number;
  isLoading?: boolean;
}

export const PageSelectionDialog = ({
  isOpen,
  onClose,
  onProcess,
  totalPages,
  isLoading = false,
}: PageSelectionDialogProps) => {
  const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());

  const allSelected = selectedPages.size === totalPages;

  const togglePage = (pageNum: number) => {
    setSelectedPages((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(pageNum)) {
        newSet.delete(pageNum);
      } else {
        newSet.add(pageNum);
      }
      return newSet;
    });
  };

  const selectAll = () => {
    const allPages = new Set(Array.from({ length: totalPages }, (_, i) => i + 1));
    setSelectedPages(allPages);
  };

  const clearAll = () => {
    setSelectedPages(new Set());
  };

  const handleProcess = () => {
    if (selectedPages.size === 0) return;
    onProcess(Array.from(selectedPages).sort((a, b) => a - b));
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-background border border-white/10 rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[80vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/10">
          <div>
            <h2 className="text-xl font-heading font-semibold">{t('pageSelection.title')}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t('pageSelection.subtitle', { count: selectedPages.size, total: totalPages })}
            </p>
          </div>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            className="h-8 w-8"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>

        {/* Page Grid */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((pageNum) => {
              const isSelected = selectedPages.has(pageNum);
              return (
                <button
                  key={pageNum}
                  onClick={() => togglePage(pageNum)}
                  className={`relative aspect-[3/4] rounded-lg border-2 transition-all duration-200 flex flex-col items-center justify-center gap-1 ${
                    isSelected
                      ? 'border-accent bg-accent/10 text-accent'
                      : 'border-white/10 bg-secondary/20 hover:border-white/20 text-muted-foreground'
                  }`}
                >
                  {isSelected ? (
                    <CheckSquare className="h-5 w-5" />
                  ) : (
                    <Square className="h-5 w-5 opacity-40" />
                  )}
                  <span className="text-xs font-medium">{pageNum}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-white/10">
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              disabled={allSelected}
            >
              {t('pageSelection.selectAll')}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={clearAll}
              disabled={selectedPages.size === 0}
            >
              {t('pageSelection.clearAll')}
            </Button>
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={onClose}>
              {t('pageSelection.cancel')}
            </Button>
            <Button
              onClick={handleProcess}
              disabled={selectedPages.size === 0 || isLoading}
            >
              {isLoading ? t('pageSelection.processing') : t('pageSelection.process')}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
