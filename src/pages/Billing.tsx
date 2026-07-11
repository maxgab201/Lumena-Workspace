

export const Billing = () => {
  return (
    <div className="max-w-4xl space-y-6">
      <h1 className="text-3xl font-heading font-semibold">Billing & Credits</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="border border-[var(--border)] rounded-lg p-6 space-y-2">
          <h2 className="text-xl font-medium">Current Plan: Free</h2>
          <p className="text-[var(--text)]">You are currently on the free tier.</p>
          <button className="mt-4 px-4 py-2 bg-[var(--accent)] text-white rounded-md">Upgrade to Pro</button>
        </div>
      </div>
    </div>
  );
};
