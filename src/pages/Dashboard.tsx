

export const Dashboard = () => {
  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-3xl font-heading font-semibold">Dashboard</h1>
        <p className="text-[var(--text)]">Overview of your workspaces and recent activity.</p>
      </header>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="p-6 border border-[var(--border)] rounded-lg bg-[var(--bg)] shadow-sm">
          <h3 className="font-medium text-[var(--text-h)] mb-2">Recent Workspace</h3>
          <p className="text-sm">Machine Learning Notes</p>
        </div>
      </div>
    </div>
  );
};
