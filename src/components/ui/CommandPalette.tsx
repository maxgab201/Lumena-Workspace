import { useEffect, useRef, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { useUiStore } from '../../stores/uiStore';
import { useWorkspaceStore } from '../../stores/workspaceStore';
import {
  Search,
  FileText,
  Settings,
  CreditCard,
  LayoutDashboard,
  ArrowRight,
  Command,
  Keyboard,
} from 'lucide-react';

interface PaletteItem {
  id: string;
  label: string;
  description?: string;
  icon: React.ReactNode;
  action: () => void;
  category: 'navigation' | 'document' | 'action';
}

export const CommandPalette = () => {
  const { commandPaletteOpen, setCommandPaletteOpen } = useUiStore();
  const { documents } = useWorkspaceStore();
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  // Build palette items
  const allItems = useMemo<PaletteItem[]>(() => {
    const navItems: PaletteItem[] = [
      {
        id: 'nav-dashboard',
        label: 'Go to Dashboard',
        description: 'View your documents',
        icon: <LayoutDashboard size={16} />,
        action: () => navigate('/dashboard'),
        category: 'navigation',
      },
      {
        id: 'nav-settings',
        label: 'Go to Settings',
        description: 'Manage preferences',
        icon: <Settings size={16} />,
        action: () => navigate('/settings'),
        category: 'navigation',
      },
      {
        id: 'nav-billing',
        label: 'Go to Billing',
        description: 'Credits & subscription',
        icon: <CreditCard size={16} />,
        action: () => navigate('/billing'),
        category: 'navigation',
      },
      {
        id: 'nav-shortcuts',
        label: 'Keyboard Shortcuts',
        description: 'View all shortcuts',
        icon: <Keyboard size={16} />,
        action: () => navigate('/settings?tab=shortcuts'),
        category: 'navigation',
      },
    ];

    const docItems: PaletteItem[] = documents.map((doc) => ({
      id: `doc-${doc.id}`,
      label: doc.name,
      description: `${(doc.size_bytes / (1024 * 1024)).toFixed(1)} MB`,
      icon: <FileText size={16} />,
      action: () => navigate(`/viewer/${doc.id}`),
      category: 'document' as const,
    }));

    return [...navItems, ...docItems];
  }, [documents, navigate]);

  // Filtered items
  const filteredItems = useMemo(() => {
    if (!query.trim()) return allItems;
    const lowerQuery = query.toLowerCase();
    return allItems.filter(
      (item) =>
        item.label.toLowerCase().includes(lowerQuery) ||
        item.description?.toLowerCase().includes(lowerQuery)
    );
  }, [allItems, query]);

  // Reset state when opening
  useEffect(() => {
    if (commandPaletteOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [commandPaletteOpen]);

  // Global keyboard shortcut
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setCommandPaletteOpen(!commandPaletteOpen);
      }
      if (e.key === 'Escape' && commandPaletteOpen) {
        setCommandPaletteOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [commandPaletteOpen, setCommandPaletteOpen]);

  // Arrow key navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, filteredItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === 'Enter' && filteredItems[selectedIndex]) {
      e.preventDefault();
      filteredItems[selectedIndex].action();
      setCommandPaletteOpen(false);
    }
  };

  // Reset index when query changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Group items by category
  const groupedItems = useMemo(() => {
    const groups: Record<string, PaletteItem[]> = {};
    filteredItems.forEach((item) => {
      if (!groups[item.category]) groups[item.category] = [];
      groups[item.category].push(item);
    });
    return groups;
  }, [filteredItems]);

  const categoryLabels: Record<string, string> = {
    navigation: 'Navigation',
    document: 'Documents',
    action: 'Actions',
  };

  let globalIndex = -1;

  return (
    <AnimatePresence>
      {commandPaletteOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]"
            onClick={() => setCommandPaletteOpen(false)}
          />

          {/* Palette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -20 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg z-[101]"
            data-testid="command-palette"
          >
            <div className="mx-4 rounded-2xl border border-white/10 bg-background/90 backdrop-blur-2xl shadow-2xl shadow-black/40 overflow-hidden">
              {/* Search Input */}
              <div className="flex items-center gap-3 px-4 py-3 border-b border-white/5">
                <Search size={18} className="text-muted-foreground shrink-0" />
                <input
                  ref={inputRef}
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Search documents, navigate..."
                  className="flex-1 bg-transparent text-foreground text-sm placeholder:text-muted-foreground outline-none"
                  data-testid="command-palette-input"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded bg-secondary/50 border border-white/10 px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground">
                  ESC
                </kbd>
              </div>

              {/* Results */}
              <div className="max-h-72 overflow-y-auto py-2 custom-scrollbar">
                {filteredItems.length === 0 ? (
                  <div className="px-4 py-8 text-center text-muted-foreground text-sm">
                    No results found for "{query}"
                  </div>
                ) : (
                  Object.entries(groupedItems).map(([category, items]) => (
                    <div key={category}>
                      <div className="px-4 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-widest">
                        {categoryLabels[category] || category}
                      </div>
                      {items.map((item) => {
                        globalIndex++;
                        const isSelected = globalIndex === selectedIndex;
                        const currentIndex = globalIndex;
                        return (
                          <button
                            key={item.id}
                            className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors group ${
                              isSelected
                                ? 'bg-accent/10 text-accent'
                                : 'text-foreground hover:bg-secondary/50'
                            }`}
                            onClick={() => {
                              item.action();
                              setCommandPaletteOpen(false);
                            }}
                            onMouseEnter={() => setSelectedIndex(currentIndex)}
                            data-testid={`palette-item-${item.id}`}
                          >
                            <div
                              className={`shrink-0 ${
                                isSelected ? 'text-accent' : 'text-muted-foreground'
                              }`}
                            >
                              {item.icon}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium truncate">{item.label}</div>
                              {item.description && (
                                <div className="text-xs text-muted-foreground truncate">
                                  {item.description}
                                </div>
                              )}
                            </div>
                            <ArrowRight
                              size={14}
                              className={`shrink-0 transition-opacity ${
                                isSelected ? 'opacity-100 text-accent' : 'opacity-0'
                              }`}
                            />
                          </button>
                        );
                      })}
                    </div>
                  ))
                )}
              </div>

              {/* Footer */}
              <div className="flex items-center justify-between px-4 py-2 border-t border-white/5 text-[10px] text-muted-foreground">
                <div className="flex items-center gap-3">
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-secondary/50 border border-white/10 px-1 py-0.5 font-mono">↑↓</kbd>
                    Navigate
                  </span>
                  <span className="flex items-center gap-1">
                    <kbd className="rounded bg-secondary/50 border border-white/10 px-1 py-0.5 font-mono">↵</kbd>
                    Select
                  </span>
                </div>
                <span className="flex items-center gap-1">
                  <Command size={10} />
                  K to toggle
                </span>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
