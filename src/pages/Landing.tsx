
import { Link } from 'react-router-dom';

export const Landing = () => {
  return (
    <div className="min-h-screen bg-[var(--bg)] flex flex-col items-center justify-center p-4">
      <div className="max-w-3xl text-center space-y-6">
        <h1 className="text-5xl md:text-6xl font-heading font-bold text-[var(--text-h)] tracking-tight">
          Where documents become knowledge
        </h1>
        <p className="text-xl text-[var(--text)] max-w-2xl mx-auto">
          Transform your PDFs and research into an interactive learning environment with AI-powered insights, mind maps, and structured knowledge extraction.
        </p>
        <div className="pt-4 flex items-center justify-center space-x-4">
          <Link to="/auth" className="px-6 py-3 bg-[var(--accent)] text-white rounded-md font-medium hover:opacity-90 transition-opacity">
            Get Started
          </Link>
          <Link to="/dashboard" className="px-6 py-3 border border-[var(--border)] rounded-md font-medium hover:bg-black/5 dark:hover:bg-white/5 transition-colors">
            View Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
};
