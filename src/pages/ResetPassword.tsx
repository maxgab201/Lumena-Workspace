import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AuthRepository } from '../repositories/auth.repository';
import { motion } from 'framer-motion';
import { Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const ResetPassword = () => {
  const navigate = useNavigate();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setLoading(true);
    setError(null);

    try {
      await AuthRepository.updateUser({ password });
      setSuccess(true);
      setTimeout(() => {
        navigate('/dashboard');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Failed to reset password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-6 relative selection:bg-accent/30 selection:text-accent-foreground overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-background to-background opacity-60" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 space-y-8"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center space-x-2.5 mx-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/60 text-white font-bold flex items-center justify-center shadow-lg shadow-accent/20 text-xl">
              L
            </div>
            <span className="font-heading font-semibold text-2xl tracking-tight text-foreground">Lumena</span>
          </div>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground pt-4">
            Reset Password
          </h2>
          <p className="text-sm text-muted-foreground">
            Enter your new secure password below.
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {success ? (
            <div className="p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent flex flex-col items-center gap-3 text-center">
              <CheckCircle2 className="w-8 h-8 text-accent animate-bounce" />
              <p className="font-semibold">Password updated successfully!</p>
              <p className="text-xs text-muted-foreground">Redirecting you to dashboard in a moment...</p>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="space-y-1.5">
                <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  New Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    id="password"
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="confirmPassword" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Confirm Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-11 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/15 flex items-center justify-center gap-2"
              >
                {loading ? 'Updating...' : 'Update Password'}
                <ArrowRight className="w-4 h-4" />
              </Button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
};
