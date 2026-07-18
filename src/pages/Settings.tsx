
import { useState } from 'react';
import { cn } from '../lib/utils';
import { PageContainer } from '../components/ui/PageContainer';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { useUiStore } from '../stores/uiStore';
import { useUserStore } from '../stores/userStore';
import { 
  User, 
  Monitor, 
  Sun, 
  Moon, 
  Bell, 
  Keyboard, 
  Info, 
  Camera,
  Check,
  Shield,
  HelpCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export const Settings = () => {
  const { user } = useUserStore();
  const { theme, setTheme } = useUiStore();
  const [activeTab, setActiveTab] = useState<'profile' | 'appearance' | 'notifications' | 'shortcuts' | 'about'>('profile');
  
  // Profile state mockups (in real app they might connect to a store/action)
  const [name, setName] = useState(user?.name || 'User');
  const [email, setEmail] = useState(user?.email || 'user@example.com');
  const [isSaved, setIsSaved] = useState(false);

  // Notification settings mockups
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [desktopNotifications, setDesktopNotifications] = useState(true);
  const [weeklyDigest, setWeeklyDigest] = useState(false);

  const handleSaveProfile = () => {
    setIsSaved(true);
    setTimeout(() => setIsSaved(false), 3000);
  };

  const tabs = [
    { id: 'profile', label: 'Profile', icon: <User size={16} /> },
    { id: 'appearance', label: 'Appearance', icon: <Monitor size={16} /> },
    { id: 'notifications', label: 'Notifications', icon: <Bell size={16} /> },
    { id: 'shortcuts', label: 'Keyboard Shortcuts', icon: <Keyboard size={16} /> },
    { id: 'about', label: 'About', icon: <Info size={16} /> },
  ] as const;

  return (
    <PageContainer>
      <header className="space-y-1 mb-8">
        <h1 className="text-3xl font-heading font-semibold tracking-tight">Settings</h1>
        <p className="text-muted-foreground">Manage your account preferences, appearance, and keyboard controls.</p>
      </header>

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Navigation Sidebar */}
        <nav className="flex lg:flex-col overflow-x-auto lg:w-64 gap-1 pb-4 lg:pb-0 shrink-0 border-b lg:border-b-0 lg:border-r border-white/5 pr-0 lg:pr-6 custom-scrollbar" aria-label="Settings navigation">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                "flex items-center space-x-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 outline-none focus-visible:ring-2 focus-visible:ring-accent shrink-0",
                activeTab === tab.id
                  ? 'bg-secondary text-foreground shadow-sm'
                  : 'text-muted-foreground hover:text-foreground hover:bg-secondary/40'
              )}
            >
              {tab.icon}
              <span>{tab.label}</span>
            </button>
          ))}
        </nav>

        {/* Settings Workspace Panel */}
        <div className="flex-1 max-w-3xl">
          <AnimatePresence mode="wait">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              transition={{ duration: 0.2 }}
            >
              {activeTab === 'profile' && (
                <Card className="border-white/5 bg-card/40 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-xl">Profile Information</CardTitle>
                    <CardDescription>Update your personal details and public profile avatar.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Avatar edit section */}
                    <div className="flex items-center space-x-6 pb-4 border-b border-white/5">
                      <div className="relative group">
                        <div className="w-20 h-20 rounded-full bg-gradient-to-br from-accent/80 to-accent/40 text-white font-bold flex items-center justify-center text-2xl shadow-lg ring-2 ring-white/10 group-hover:ring-accent transition-all duration-300">
                          {user?.avatar_url ? (
                            <img src={user.avatar_url} alt={name} className="w-full h-full rounded-full object-cover" />
                          ) : (
                            name.charAt(0).toUpperCase()
                          )}
                        </div>
                        <button className="absolute inset-0 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 cursor-pointer" aria-label="Upload photo">
                          <Camera size={18} className="text-white" />
                        </button>
                      </div>
                      <div className="space-y-1">
                        <h4 className="text-sm font-semibold text-foreground">Profile Picture</h4>
                        <p className="text-xs text-muted-foreground">PNG, JPG or GIF up to 2MB.</p>
                        <div className="flex space-x-2 pt-1">
                          <Button size="sm" variant="outline" className="h-8 text-xs border-white/5 bg-secondary/30">Upload</Button>
                          <Button size="sm" variant="ghost" className="h-8 text-xs text-muted-foreground hover:text-foreground">Remove</Button>
                        </div>
                      </div>
                    </div>

                    {/* Inputs */}
                    <div className="space-y-4">
                      <div className="grid gap-1.5">
                        <label htmlFor="name-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Name</label>
                        <input
                          id="name-input"
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="h-10 w-full rounded-lg border border-white/10 bg-background/30 backdrop-blur-sm px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                      <div className="grid gap-1.5">
                        <label htmlFor="email-input" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Email</label>
                        <input
                          id="email-input"
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          className="h-10 w-full rounded-lg border border-white/10 bg-background/30 backdrop-blur-sm px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                      <Button onClick={handleSaveProfile} disabled={isSaved} className="px-6 shadow-md shadow-accent/15">
                        {isSaved ? (
                          <>
                            <Check className="w-4 h-4 mr-2" /> Saved
                          </>
                        ) : 'Save Changes'}
                      </Button>
                      {isSaved && (
                        <span className="text-xs text-accent font-medium">Profile updated successfully!</span>
                      )}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'appearance' && (
                <Card className="border-white/5 bg-card/40 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-xl">Theme & Appearance</CardTitle>
                    <CardDescription>Select your preferred theme and customize display options.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Theme</label>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          { id: 'light', label: 'Light', icon: <Sun size={18} /> },
                          { id: 'dark', label: 'Dark', icon: <Moon size={18} /> },
                          { id: 'system', label: 'System', icon: <Monitor size={18} /> },
                        ].map((item) => (
                          <button
                            key={item.id}
                            onClick={() => setTheme(item.id as 'light' | 'dark' | 'system')}
                            className={`flex flex-col items-center justify-center p-4 rounded-xl border transition-all duration-200 gap-2 focus:outline-none focus:ring-2 focus:ring-accent ${
                              theme === item.id
                                ? 'border-accent bg-accent/5 text-foreground'
                                : 'border-white/5 bg-secondary/20 text-muted-foreground hover:text-foreground hover:bg-secondary/40'
                            }`}
                          >
                            {item.icon}
                            <span className="text-xs font-semibold">{item.label}</span>
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="pt-6 border-t border-white/5 space-y-4">
                      <h4 className="text-sm font-semibold">Workspace Layout</h4>
                      <div className="flex items-center justify-between p-3 rounded-lg bg-secondary/10 border border-white/5">
                        <div>
                          <p className="text-xs font-semibold text-foreground">Compact Sidebar Mode</p>
                          <p className="text-[11px] text-muted-foreground">Show only icons in the left navigation sidebar by default.</p>
                        </div>
                        <div className="flex items-center">
                          {/* Toggle mockup using state / styling */}
                          <span className="text-xs text-muted-foreground font-mono">Managed from sidebar bottom toggle</span>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'notifications' && (
                <Card className="border-white/5 bg-card/40 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-xl">Notification Preferences</CardTitle>
                    <CardDescription>Control which notifications you receive and where they are sent.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-3.5">
                      <div className="flex items-start justify-between p-3.5 rounded-xl bg-secondary/15 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">Email Notifications</p>
                          <p className="text-xs text-muted-foreground">Get updates on processing completions and workspace invites.</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={emailNotifications} 
                          onChange={(e) => setEmailNotifications(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent bg-secondary/50 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-start justify-between p-3.5 rounded-xl bg-secondary/15 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">Desktop Notifications</p>
                          <p className="text-xs text-muted-foreground">Receive real-time in-app alerts on document status changes.</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={desktopNotifications} 
                          onChange={(e) => setDesktopNotifications(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent bg-secondary/50 cursor-pointer"
                        />
                      </div>

                      <div className="flex items-start justify-between p-3.5 rounded-xl bg-secondary/15 border border-white/5">
                        <div className="space-y-0.5">
                          <p className="text-sm font-semibold text-foreground">Weekly Digest</p>
                          <p className="text-xs text-muted-foreground">A weekly email summarizing your analyzed items and generated mind maps.</p>
                        </div>
                        <input 
                          type="checkbox" 
                          checked={weeklyDigest} 
                          onChange={(e) => setWeeklyDigest(e.target.checked)}
                          className="w-4 h-4 rounded border-gray-300 text-accent focus:ring-accent bg-secondary/50 cursor-pointer"
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'shortcuts' && (
                <Card className="border-white/5 bg-card/40 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-xl">Keyboard Shortcuts</CardTitle>
                    <CardDescription>Visual reference of standard application controls for quick navigation.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4">
                      {[
                        { section: "Navigation", keys: [
                          { label: "Open Search / Command Palette", keys: ["⌘", "K"] },
                          { label: "Toggle Sidebar Collapse", keys: ["⌘", "\\"] },
                          { label: "Go to Dashboard", keys: ["G", "D"] },
                          { label: "Go to Settings", keys: ["G", "S"] },
                        ]},
                        { section: "PDF Viewer Controls", keys: [
                          { label: "Next Page", keys: ["→"] },
                          { label: "Previous Page", keys: ["←"] },
                          { label: "Zoom In", keys: ["⌘", "+"] },
                          { label: "Zoom Out", keys: ["⌘", "-"] },
                          { label: "Highlight Text selection", keys: ["H"] },
                          { label: "Ask AI about selection", keys: ["Shift", "A"] },
                        ]}
                      ].map((grp, i) => (
                        <div key={i} className="space-y-2">
                          <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground border-b border-white/5 pb-1">{grp.section}</h4>
                          <div className="space-y-2">
                            {grp.keys.map((sh, k) => (
                              <div key={k} className="flex items-center justify-between text-xs font-medium">
                                <span className="text-muted-foreground">{sh.label}</span>
                                <div className="flex items-center space-x-1">
                                  {sh.keys.map((key, ki) => (
                                    <kbd key={ki} className="inline-flex items-center justify-center px-2 py-0.5 rounded border border-white/10 bg-background/50 font-mono text-[10px] text-foreground shadow-sm">
                                      {key}
                                    </kbd>
                                  ))}
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              )}

              {activeTab === 'about' && (
                <Card className="border-white/5 bg-card/40 backdrop-blur-md">
                  <CardHeader>
                    <CardTitle className="text-xl">About Lumena Workspace</CardTitle>
                    <CardDescription>Application version details, licensing, and diagnostic information.</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex flex-col items-center text-center p-6 bg-secondary/10 rounded-2xl border border-white/5 gap-3">
                      <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-accent/60 text-white font-bold flex items-center justify-center shadow-lg shadow-accent/15 text-lg">L</div>
                      <div>
                        <h4 className="font-heading font-semibold text-lg">Lumena Workspace</h4>
                        <p className="text-xs text-muted-foreground">Version 1.0.0-rc2 (Phase 11 Release)</p>
                      </div>
                    </div>

                    <div className="space-y-3.5 text-xs text-muted-foreground font-medium">
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span>Database Status</span>
                        <span className="text-emerald-500 font-semibold flex items-center gap-1.5"><Shield size={12} /> Connected</span>
                      </div>
                      <div className="flex items-center justify-between border-b border-white/5 pb-2">
                        <span>AI Engine Integration</span>
                        <span className="text-accent font-semibold flex items-center gap-1.5"><Check size={12} /> Premium Active</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>Licensing</span>
                        <span>Commercial Proprietary</span>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-white/5 flex justify-center">
                      <a href="#" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1">
                        <HelpCircle size={14} /> Contact Support Desk
                      </a>
                    </div>
                  </CardContent>
                </Card>
              )}
            </motion.div>
          </AnimatePresence>
        </div>
      </div>
    </PageContainer>
  );
};
``