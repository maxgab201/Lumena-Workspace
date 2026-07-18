import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Button } from '../components/ui/Button';
import { AuthRepository } from '../repositories/auth.repository';
import { motion } from 'framer-motion';
import { Mail, Lock, ArrowRight, AlertCircle, CheckCircle2 } from 'lucide-react';

export const Auth = () => {
  const navigate = useNavigate();
  const [isSignUp, setIsSignUp] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setInfoMessage(null);

    try {
      if (isForgotPassword) {
        await AuthRepository.resetPasswordForEmail(email, `${window.location.origin}/reset-password`);
        setInfoMessage('Password reset link has been sent to your email.');
      } else if (isSignUp) {
        await AuthRepository.signUp(email, password, {
          emailRedirectTo: `${window.location.origin}/dashboard`,
        });
        setInfoMessage('Check your email for the confirmation link to complete registration.');
      } else {
        await AuthRepository.signInWithPassword(email, password);
        navigate('/dashboard');
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication.');
    } finally {
      setLoading(false);
    }
  };

  const handleOAuthLogin = async (provider: 'github' | 'google') => {
    setLoading(true);
    setError(null);
    try {
      await AuthRepository.signInWithOAuth(provider, `${window.location.origin}/dashboard`);
    } catch (err: any) {
      setError(err.message || `Failed to sign in with ${provider}.`);
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center px-6 relative selection:bg-accent/30 selection:text-accent-foreground overflow-hidden">
      {/* Background Decorative Blur */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none z-0">
        <div className="absolute -top-1/2 -left-1/2 w-[150%] h-[150%] bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-accent/10 via-background to-background opacity-60" />
        <div className="absolute top-1/4 right-1/4 w-96 h-96 bg-accent/20 rounded-full blur-[120px]" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md z-10 space-y-8"
      >
        <div className="text-center space-y-2">
          <Link to="/" className="inline-flex items-center space-x-2.5 mx-auto">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-accent to-accent/60 text-white font-bold flex items-center justify-center shadow-lg shadow-accent/20 text-xl">
              L
            </div>
            <span className="font-heading font-semibold text-2xl tracking-tight text-foreground">Lumena</span>
          </Link>
          <h2 className="text-3xl font-heading font-bold tracking-tight text-foreground pt-4">
            {isForgotPassword
              ? 'Reset your password'
              : isSignUp
              ? 'Create your account'
              : 'Sign in to Lumena'}
          </h2>
          <p className="text-sm text-muted-foreground">
            {isForgotPassword
              ? 'Enter your email to receive a password reset link'
              : isSignUp
              ? 'Start building your personal knowledge engine'
              : 'Welcome back! Enter your details to access your workspace'}
          </p>
        </div>

        <div className="bg-card/40 backdrop-blur-xl border border-white/5 rounded-3xl p-8 shadow-2xl">
          {error && (
            <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-sm text-red-400 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {infoMessage && (
            <div className="mb-6 p-4 rounded-xl bg-accent/10 border border-accent/20 text-sm text-accent flex items-start gap-3">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5" />
              <span>{infoMessage}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label htmlFor="email" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Email Address
              </label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full h-11 pl-10 pr-4 rounded-xl border border-white/10 bg-background/30 backdrop-blur-sm text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>

            {!isForgotPassword && (
              <div className="space-y-1.5">
                <div className="flex justify-between items-center">
                  <label htmlFor="password" className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    Password
                  </label>
                  {!isSignUp && (
                    <button
                      type="button"
                      onClick={() => setIsForgotPassword(true)}
                      className="text-xs text-accent hover:underline focus:outline-none"
                    >
                      Forgot password?
                    </button>
                  )}
                </div>
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
            )}

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 rounded-xl bg-accent hover:bg-accent/90 text-white font-semibold shadow-lg shadow-accent/15 flex items-center justify-center gap-2"
            >
              {loading ? 'Processing...' : isForgotPassword ? 'Send Reset Link' : isSignUp ? 'Sign Up' : 'Sign In'}
              <ArrowRight className="w-4 h-4" />
            </Button>
          </form>

          {!isForgotPassword && (
            <>
              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/5" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-background px-3 text-muted-foreground font-semibold tracking-wider">Or continue with</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin('github')}
                  disabled={loading}
                  className="h-11 rounded-xl border-white/10 hover:bg-white/5 flex items-center justify-center gap-2"
                >
                  GitHub
                </Button>
                <Button
                  variant="outline"
                  onClick={() => handleOAuthLogin('google')}
                  disabled={loading}
                  className="h-11 rounded-xl border-white/10 hover:bg-white/5 flex items-center justify-center gap-2"
                >
                  Google
                </Button>
              </div>
            </>
          )}
        </div>

        <div className="text-center">
          <button
            onClick={() => {
              if (isForgotPassword) {
                setIsForgotPassword(false);
              } else {
                setIsSignUp(!isSignUp);
                setError(null);
                setInfoMessage(null);
              }
            }}
            className="text-sm text-muted-foreground hover:text-foreground font-medium transition-colors"
          >
            {isForgotPassword
              ? 'Back to sign in'
              : isSignUp
              ? 'Already have an account? Sign in'
              : "Don't have an account? Sign up"}
          </button>
        </div>
      </motion.div>
    </div>
  );
};
