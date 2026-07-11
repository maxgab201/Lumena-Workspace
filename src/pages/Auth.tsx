
import { Link } from 'react-router-dom';

export const Auth = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex items-center justify-center p-4">
      <div className="w-full max-w-md border border-[var(--border)] rounded-lg p-8 shadow-sm text-center">
        <div className="w-12 h-12 rounded-md bg-[var(--accent)] text-white font-bold flex items-center justify-center mx-auto mb-6 text-xl">L</div>
        <h1 className="text-2xl font-heading font-semibold mb-2">Welcome Back</h1>
        <p className="text-[var(--text)] mb-6">Sign in to your Lumena account</p>
        
        <div className="space-y-3">
          <button className="w-full py-2.5 border border-[var(--border)] rounded-md font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            Continue with GitHub
          </button>
          <button className="w-full py-2.5 border border-[var(--border)] rounded-md font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            Continue with Google
          </button>
        </div>
        
        <div className="mt-6 text-sm text-[var(--text)]">
          <Link to="/" className="hover:underline">Back to Home</Link>
        </div>
      </div>
    </div>
  );
};
