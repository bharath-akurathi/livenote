import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { ThemeToggle } from '../components/ThemeToggle';
import { Button } from '../components/UI/Button';
import { Input } from '../components/UI/Input';
import { FileText, ArrowLeft } from 'lucide-react';
import toast from 'react-hot-toast';
import { getErrorMessage } from '../lib/error-utils';

export function RegisterPage() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const register = useAuthStore((s) => s.register);
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password.length < 8) {
      toast.error('Password must be at least 8 characters');
      return;
    }
    setLoading(true);
    try {
      await register(email, name, password);
      navigate('/dashboard');
      toast.success('Account created! Welcome to LiveNote.');
    } catch (err: any) {
      toast.error(getErrorMessage(err, 'Registration failed'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex bg-canvas">
      {/* Left side — branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-gradient-to-br from-emerald-500 via-teal-600 to-cyan-700 items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute top-20 left-20 w-72 h-72 bg-white rounded-full blur-3xl" />
          <div className="absolute bottom-20 right-20 w-96 h-96 bg-white rounded-full blur-3xl" />
        </div>
        <div className="relative text-center text-white px-12">
          <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl backdrop-blur-sm mb-8">
            <FileText size={40} className="text-white" />
          </div>
          <h1 className="text-4xl font-bold mb-4">Join LiveNote</h1>
          <p className="text-lg text-white/80 max-w-md">
            Start creating and collaborating on documents in real-time.
          </p>
        </div>
      </div>

      {/* Right side — form */}
      <div className="flex-1 flex items-center justify-center px-6 py-12 relative">
        <Link to="/" className="absolute top-6 left-6 p-2 text-ink-subtle hover:text-ink bg-surface-muted hover:bg-surface-strong rounded-lg transition-colors flex items-center gap-2">
          <ArrowLeft size={18} />
          <span className="text-sm font-medium hidden sm:inline">Back to home</span>
        </Link>
        <div className="absolute top-6 right-6">
          <ThemeToggle />
        </div>
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 bg-emerald-500 rounded-xl flex items-center justify-center">
              <FileText size={22} className="text-white" />
            </div>
            <span className="text-xl font-bold text-ink">LiveNote</span>
          </div>

          <h2 className="text-2xl font-bold text-ink mb-1">Create an account</h2>
          <p className="text-ink-muted mb-8">Get started with collaborative editing</p>

          <form onSubmit={handleSubmit} className="space-y-4">
            <Input
              label="Full name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="John Doe"
              required
              autoFocus
              id="register-name"
            />
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              required
              id="register-email"
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Min. 8 characters"
              required
              minLength={8}
              id="register-password"
            />
            <Button type="submit" loading={loading} className="w-full" size="lg">
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-ink-muted mt-6">
            Already have an account?{' '}
            <Link to="/login" className="text-brand-500 font-medium hover:text-brand-600">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
