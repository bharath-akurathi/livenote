import { Link } from 'react-router-dom';
import {
  FileText, Users, Zap, Shield, Globe, Clock,
  ArrowRight, Sparkles, PenTool, MessageSquare,
  GitBranch, ChevronRight, PlayCircle,
} from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { ThemeToggle } from '../components/ThemeToggle';

const FEATURES = [
  {
    icon: <Zap size={24} />,
    title: 'Real-time Collaboration',
    desc: 'Edit documents simultaneously with your team. See live cursors and changes as they happen — no refresh needed.',
    color: 'from-amber-500 to-orange-600',
  },
  {
    icon: <PenTool size={24} />,
    title: 'Rich Text Editor',
    desc: 'Full formatting toolbar, slash commands, headings, lists, code blocks, links, and more — powered by Tiptap.',
    color: 'from-brand-500 to-indigo-600',
  },
  {
    icon: <Users size={24} />,
    title: 'Granular Sharing',
    desc: 'Share via email with viewer, commenter, or editor roles. Or make documents public with a single link.',
    color: 'from-emerald-500 to-teal-600',
  },
  {
    icon: <MessageSquare size={24} />,
    title: 'Threaded Comments',
    desc: 'Add comments, reply in threads, and resolve discussions — all inline alongside your document.',
    color: 'from-violet-500 to-purple-600',
  },
  {
    icon: <GitBranch size={24} />,
    title: 'Version History',
    desc: 'Auto-snapshots as you edit, manual saves, and one-click restore to any previous version.',
    color: 'from-rose-500 to-pink-600',
  },
  {
    icon: <Shield size={24} />,
    title: 'Offline-First',
    desc: 'Keep working without internet. Changes sync automatically via CRDT when you reconnect.',
    color: 'from-cyan-500 to-sky-600',
  },
];

export function LandingPage() {
  const user = useAuthStore((s) => s.user);

  return (
    <div className="min-h-screen bg-canvas">
      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <nav className="fixed top-0 w-full z-50 bg-surface/80 backdrop-blur-lg border-b border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-xl flex items-center justify-center shadow-md shadow-brand-500/20">
                <FileText size={18} className="text-white" />
              </div>
              <span className="text-xl font-bold bg-gradient-to-r from-gray-900 to-gray-600 dark:from-ink dark:to-ink-subtle bg-clip-text text-transparent">
                LiveNote
              </span>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <a href="#features" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">Features</a>
              <a href="#demo" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">Demo</a>
              <a href="#how-it-works" className="text-sm font-medium text-ink-muted hover:text-ink transition-colors">How it works</a>
            </div>
            <div className="flex items-center gap-3">
              <ThemeToggle />
              {user ? (
                <Link
                  to="/dashboard"
                  className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-brand-500 to-indigo-600 rounded-xl hover:from-brand-600 hover:to-indigo-700 shadow-md shadow-brand-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/30"
                >
                  Go to Dashboard
                </Link>
              ) : (
                <>
                  <Link
                    to="/login"
                    className="px-4 py-2 text-sm font-medium text-ink-muted hover:text-ink transition-colors"
                  >
                    Sign in
                  </Link>
                  <Link
                    to="/register"
                    className="px-5 py-2.5 text-sm font-medium text-white bg-gradient-to-r from-brand-500 to-indigo-600 rounded-xl hover:from-brand-600 hover:to-indigo-700 shadow-md shadow-brand-500/25 transition-all duration-200 hover:shadow-lg hover:shadow-brand-500/30"
                  >
                    Get started free
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="pt-32 pb-20 sm:pt-40 sm:pb-28 relative overflow-hidden">
        {/* Decorative background */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-brand-100/40 via-indigo-100/20 to-transparent rounded-full blur-3xl" />
          <div className="absolute top-40 left-20 w-72 h-72 bg-emerald-100/30 rounded-full blur-3xl" />
          <div className="absolute top-60 right-20 w-80 h-80 bg-violet-100/30 rounded-full blur-3xl" />
        </div>

        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-muted border border-line text-brand-600 dark:text-brand-400 text-sm font-medium mb-8 animate-fade-in">
            <Sparkles size={14} />
            Real-time collaborative editing
          </div>

          <h1 className="text-5xl sm:text-6xl lg:text-7xl font-extrabold tracking-tight text-ink leading-[1.1] mb-6 animate-slide-up">
            Write together,
            <br />
            <span className="bg-gradient-to-r from-brand-500 via-indigo-500 to-violet-500 bg-clip-text text-transparent">
              in real time.
            </span>
          </h1>

          <p className="text-lg sm:text-xl text-ink-muted max-w-2xl mx-auto mb-10 leading-relaxed animate-slide-up" style={{ animationDelay: '100ms' }}>
            LiveNote is a modern document editor built for teams. Collaborate live with rich formatting,
            threaded comments, version history, and offline support.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-slide-up" style={{ animationDelay: '200ms' }}>
            {user ? (
              <Link
                to="/dashboard"
                className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-brand-500 to-indigo-600 rounded-2xl hover:from-brand-600 hover:to-indigo-700 shadow-lg shadow-brand-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
              >
                Go to Dashboard
                <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            ) : (
              <>
                <Link
                  to="/register"
                  className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-white bg-gradient-to-r from-brand-500 to-indigo-600 rounded-2xl hover:from-brand-600 hover:to-indigo-700 shadow-lg shadow-brand-500/25 transition-all duration-300 hover:shadow-xl hover:shadow-brand-500/30 hover:-translate-y-0.5"
                >
                  Start writing for free
                  <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                </Link>
                <Link
                  to="/login"
                  className="inline-flex items-center gap-2 px-8 py-3.5 text-base font-medium text-ink-muted bg-surface border border-line rounded-2xl hover:bg-surface-muted hover:border-ink-subtle transition-all duration-200"
                >
                  I have an account
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      {/* ── Editor Preview ──────────────────────────────────────────────────── */}
      <section className="pb-20 sm:pb-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-2xl border border-line bg-surface shadow-2xl shadow-gray-200/50 overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-surface-muted border-b border-line">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-surface rounded-lg border border-line text-xs text-ink-subtle font-mono">
                  livenote.app/doc/getting-started
                </div>
              </div>
            </div>
            {/* Fake editor */}
            <div className="p-6 sm:p-10">
              {/* Toolbar */}
              <div className="flex items-center gap-1 pb-4 mb-6 border-b border-line">
                {['B', 'I', 'U', 'S', 'H1', 'H2', '•', '1.', '"', '</>'].map((btn) => (
                  <div key={btn} className="px-2 py-1 rounded text-xs font-medium text-ink-subtle bg-surface-muted hover:bg-surface-strong transition-colors cursor-default">
                    {btn}
                  </div>
                ))}
              </div>
              {/* Content */}
              <h1 className="text-3xl font-bold text-ink mb-4">Welcome to LiveNote 🚀</h1>
              <p className="text-ink-muted mb-3 leading-relaxed">
                This is a <span className="font-semibold text-ink">collaborative document</span> that you can edit
                in real-time with your team. Try formatting with the toolbar above or type{' '}
                <code className="bg-surface-muted text-brand-600 px-1.5 py-0.5 rounded text-sm font-mono">/</code>{' '}
                for slash commands.
              </p>
              <blockquote className="border-l-4 border-brand-300 pl-4 italic text-ink-muted mb-4">
                "The best ideas emerge when people think together." — LiveNote Team
              </blockquote>
              {/* Fake cursors */}
              <div className="flex items-center gap-4 mt-6 pt-4 border-t border-line">
                <div className="flex -space-x-2">
                  <div className="w-7 h-7 rounded-full bg-blue-500 ring-2 ring-surface flex items-center justify-center text-[10px] font-bold text-white">BA</div>
                  <div className="w-7 h-7 rounded-full bg-emerald-500 ring-2 ring-surface flex items-center justify-center text-[10px] font-bold text-white">SK</div>
                  <div className="w-7 h-7 rounded-full bg-amber-500 ring-2 ring-surface flex items-center justify-center text-[10px] font-bold text-white">MK</div>
                </div>
                <span className="text-xs text-ink-subtle">3 people editing</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Demo Video ──────────────────────────────────────────────────────── */}
      <section id="demo" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-surface-muted border border-line text-brand-600 dark:text-brand-400 text-sm font-medium mb-5">
              <PlayCircle size={14} />
              See it in action
            </div>
            <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
              Watch LiveNote{' '}
              <span className="bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">
                come to life
              </span>
            </h2>
            <p className="text-lg text-ink-muted max-w-2xl mx-auto">
              A quick look at real-time collaboration, presence, and editing - all in the browser.
            </p>
          </div>

          <div className="relative rounded-2xl border border-line bg-surface shadow-2xl shadow-gray-200/50 overflow-hidden">
            {/* Fake browser chrome */}
            <div className="flex items-center gap-2 px-4 py-3 bg-surface-muted border-b border-line">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-red-400" />
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <div className="w-3 h-3 rounded-full bg-emerald-400" />
              </div>
              <div className="flex-1 flex justify-center">
                <div className="px-4 py-1 bg-surface rounded-lg border border-line text-xs text-ink-subtle font-mono">
                  livenote.app/demo
                </div>
              </div>
            </div>
            {/* Video */}
            <div className="aspect-video w-full bg-black">
              <iframe
                src="https://drive.google.com/file/d/1_FDz-8-TCxXdwSYIQWxq8qMRF2t6o57O/preview"
                title="LiveNote demo"
                className="w-full h-full"
                allow="autoplay; encrypted-media; picture-in-picture"
                allowFullScreen
              />
            </div>
          </div>
        </div>
      </section>

      {/* ── Features Grid ───────────────────────────────────────────────────── */}
      <section id="features" className="py-20 sm:py-28 bg-surface-muted">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
              Everything you need to{' '}
              <span className="bg-gradient-to-r from-brand-500 to-indigo-500 bg-clip-text text-transparent">
                collaborate
              </span>
            </h2>
            <p className="text-lg text-ink-muted max-w-2xl mx-auto">
              Built from the ground up for modern teams that value seamless, real-time collaboration.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="group relative bg-surface rounded-2xl border border-line p-6 hover:border-ink-subtle hover:shadow-lg transition-all duration-300"
              >
                <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${f.color} flex items-center justify-center mb-4 text-white shadow-sm group-hover:scale-110 group-hover:shadow-md transition-all duration-300`}>
                  {f.icon}
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">{f.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{f.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 sm:py-28">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-ink mb-4">
              Up and running in seconds
            </h2>
            <p className="text-lg text-ink-muted">No installation needed. Just sign up and start writing.</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {[
              {
                step: '01',
                title: 'Create an account',
                desc: 'Sign up with your email in under 10 seconds. No credit card required.',
                icon: <Users size={28} />,
              },
              {
                step: '02',
                title: 'Create a document',
                desc: 'Click "New document" and start writing with rich text formatting.',
                icon: <PenTool size={28} />,
              },
              {
                step: '03',
                title: 'Invite collaborators',
                desc: 'Share via email or link. Everyone can edit in real-time together.',
                icon: <Globe size={28} />,
              },
            ].map((item) => (
              <div key={item.step} className="text-center group">
                <div className="relative inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-surface-muted border border-line mb-5 group-hover:scale-110 transition-transform duration-300">
                  <span className="text-brand-500">{item.icon}</span>
                  <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-brand-500 text-white text-[10px] font-bold flex items-center justify-center shadow-md">
                    {item.step}
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-ink mb-2">{item.title}</h3>
                <p className="text-sm text-ink-muted leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-20 sm:py-28">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="relative rounded-3xl bg-gradient-to-br from-brand-500 via-indigo-600 to-violet-700 p-10 sm:p-16 text-center overflow-hidden">
            {/* Decorative */}
            <div className="absolute inset-0 opacity-10">
              <div className="absolute top-10 left-10 w-60 h-60 bg-white rounded-full blur-3xl" />
              <div className="absolute bottom-10 right-10 w-80 h-80 bg-white rounded-full blur-3xl" />
            </div>

            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">
                Ready to collaborate?
              </h2>
              <p className="text-lg text-white/80 max-w-xl mx-auto mb-8">
                Join teams already writing smarter with LiveNote. Free to get started.
              </p>
              <Link
                to={user ? "/dashboard" : "/register"}
                className="group inline-flex items-center gap-2 px-8 py-3.5 text-base font-semibold text-brand-600 bg-white rounded-2xl hover:bg-gray-50 shadow-lg transition-all duration-200 hover:-translate-y-0.5 hover:shadow-xl"
              >
                {user ? "Go to Dashboard" : "Create your first document"}
                <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="py-10 border-t border-line">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 bg-gradient-to-br from-brand-500 to-indigo-600 rounded-lg flex items-center justify-center">
                <FileText size={14} className="text-white" />
              </div>
              <span className="text-sm font-bold text-ink">LiveNote</span>
            </div>
            <p className="text-sm text-ink-subtle">
              © {new Date().getFullYear()} LiveNote. Built with ❤️ for collaborative teams.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
