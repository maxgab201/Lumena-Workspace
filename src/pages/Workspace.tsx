

export const Workspace = () => {
  return (
    <div className="h-full flex flex-col space-y-4">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-heading font-semibold">Active Workspace</h1>
      </header>
      <div className="flex-1 flex gap-4">
        {/* PDF Viewer Placeholder */}
        <div className="flex-[2] border border-[var(--border)] rounded-lg bg-black/5 dark:bg-white/5 flex items-center justify-center">
          <span className="text-[var(--text)]">PDF Viewer Area</span>
        </div>
        {/* Chat / Tools Placeholder */}
        <div className="flex-1 border border-[var(--border)] rounded-lg flex items-center justify-center">
          <span className="text-[var(--text)]">AI Chat & Knowledge Tools</span>
        </div>
      </div>
    </div>
  );
};
