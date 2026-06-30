import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { docs } from '../lib/api';
import { Button } from '../components/UI/Button';
import { Spinner } from '../components/UI/Spinner';
import { Avatar } from '../components/UI/Avatar';
import type { Document } from '../types';
import {
  Plus, Search, FileText, MoreVertical, Trash2,
  LogOut, Clock,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

export function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const logout = useAuthStore((s) => s.logout);
  const navigate = useNavigate();

  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const [menuOpen, setMenuOpen] = useState<string | null>(null);

  const fetchDocs = useCallback(async () => {
    try {
      const { data } = await docs.list({ search: search || undefined });
      setDocuments(data.documents);
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  }, [search]);

  useEffect(() => {
    fetchDocs();
  }, [fetchDocs]);

  const handleCreate = async () => {
    setCreating(true);
    try {
      const { data } = await docs.create();
      navigate(`/doc/${data.id}`);
    } catch {
      toast.error('Failed to create document');
    } finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!confirm('Delete this document? This cannot be undone.')) return;
    try {
      await docs.delete(id);
      setDocuments((d) => d.filter((doc) => doc.id !== id));
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
    setMenuOpen(null);
  };

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-20">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 bg-brand-500 rounded-xl flex items-center justify-center">
                <FileText size={20} className="text-white" />
              </div>
              <span className="text-lg font-bold text-gray-900 hidden sm:block">
                LiveNote
              </span>
            </div>

            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Avatar name={user?.name || 'U'} size="sm" />
                <span className="text-sm font-medium text-gray-700 hidden sm:block">
                  {user?.name}
                </span>
              </div>
              <button
                onClick={handleLogout}
                className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
                title="Sign out"
                id="logout-btn"
              >
                <LogOut size={18} />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Top bar */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">My Documents</h1>
            <p className="text-gray-500 text-sm mt-1">
              {documents.length} document{documents.length !== 1 ? 's' : ''}
            </p>
          </div>
          <div className="flex items-center gap-3 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search documents…"
                className="w-full sm:w-64 pl-9 pr-4 py-2 rounded-lg border border-gray-300 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500 bg-white"
                id="search-docs"
              />
            </div>
            <Button onClick={handleCreate} loading={creating} id="create-doc-btn">
              <Plus size={16} />
              <span className="hidden sm:inline">New document</span>
            </Button>
          </div>
        </div>

        {/* Document grid */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Spinner size="lg" />
          </div>
        ) : documents.length === 0 ? (
          <div className="text-center py-20">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-gray-100 rounded-2xl mb-4">
              <FileText size={28} className="text-gray-400" />
            </div>
            <h3 className="text-lg font-semibold text-gray-700 mb-1">No documents yet</h3>
            <p className="text-gray-500 text-sm mb-6">Create your first document to get started</p>
            <Button onClick={handleCreate} loading={creating}>
              <Plus size={16} /> Create document
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {documents.map((doc) => (
              <div
                key={doc.id}
                onClick={() => navigate(`/doc/${doc.id}`)}
                className="group relative bg-white border border-gray-200 rounded-xl p-5 cursor-pointer hover:border-brand-300 hover:shadow-md hover:shadow-brand-500/5 transition-all duration-200"
                id={`doc-card-${doc.id}`}
              >
                {/* Doc icon */}
                <div className="w-10 h-10 bg-brand-50 rounded-lg flex items-center justify-center mb-3 group-hover:bg-brand-100 transition-colors">
                  <FileText size={20} className="text-brand-500" />
                </div>

                {/* Title */}
                <h3 className="font-semibold text-gray-900 mb-1 truncate">
                  {doc.title}
                </h3>

                {/* Meta */}
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <Clock size={12} />
                  <span>{formatDistanceToNow(new Date(doc.updated_at), { addSuffix: true })}</span>
                  {doc.role !== 'owner' && (
                    <span className="px-1.5 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-medium uppercase">
                      {doc.role}
                    </span>
                  )}
                </div>

                {doc.owner_name && doc.role !== 'owner' && (
                  <p className="text-xs text-gray-400 mt-1">by {doc.owner_name}</p>
                )}

                {/* Actions */}
                {doc.role === 'owner' && (
                  <div className="absolute top-3 right-3">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setMenuOpen(menuOpen === doc.id ? null : doc.id);
                      }}
                      className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 opacity-0 group-hover:opacity-100 transition-all"
                    >
                      <MoreVertical size={16} />
                    </button>

                    {menuOpen === doc.id && (
                      <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg py-1 w-36 z-10 animate-fade-in">
                        <button
                          onClick={(e) => handleDelete(doc.id, e)}
                          className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50"
                        >
                          <Trash2 size={14} /> Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
