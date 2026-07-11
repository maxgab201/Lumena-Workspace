
import { Link } from 'react-router-dom';

export const Legal = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] py-12 px-4">
      <div className="max-w-3xl mx-auto space-y-6">
        <Link to="/" className="text-[var(--accent)] hover:underline">&larr; Back to Home</Link>
        <h1 className="text-4xl font-heading font-semibold">Terms and Privacy</h1>
        <div className="prose prose-neutral dark:prose-invert">
          <p className="text-[var(--text)]">
            This is a placeholder for the legal documentation, including Terms of Service, Privacy Policy, and Cookie Policy.
          </p>
        </div>
      </div>
    </div>
  );
};
