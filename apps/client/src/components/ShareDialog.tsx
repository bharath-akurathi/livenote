import { useState, useEffect, useCallback } from 'react';
import { docs } from '../lib/api';
import { Modal } from './UI/Modal';
import { Button } from './UI/Button';
import { Input } from './UI/Input';
import { Avatar } from './UI/Avatar';
import type { Collaborator } from '../types';
import { UserPlus, Trash2, Globe, Lock, Copy, Check } from 'lucide-react';
import toast from 'react-hot-toast';

interface ShareDialogProps {
  documentId: string;
  isPublic: boolean;
  isOwner: boolean;
  onClose: () => void;
}

export function ShareDialog({ documentId, isPublic, isOwner, onClose }: ShareDialogProps) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'viewer' | 'commenter' | 'editor'>('viewer');
  const [loading, setLoading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const [publicState, setPublicState] = useState(isPublic);
  const [copied, setCopied] = useState(false);

  const fetchCollaborators = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await docs.collaborators(documentId);
      setCollaborators(data);
    } catch {
      toast.error('Failed to load collaborators');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchCollaborators();
  }, [fetchCollaborators]);

  const handleShare = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSharing(true);
    try {
      await docs.share(documentId, { email: email.trim(), role });
      setEmail('');
      await fetchCollaborators();
      toast.success(`Shared with ${email}`);
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to share');
    } finally {
      setSharing(false);
    }
  };

  const handleRemove = async (userId: string, userName: string) => {
    try {
      await docs.unshare(documentId, userId);
      setCollaborators((c) => c.filter((u) => u.id !== userId));
      toast.success(`Removed ${userName}`);
    } catch {
      toast.error('Failed to remove collaborator');
    }
  };

  const togglePublic = async () => {
    try {
      const newState = !publicState;
      await docs.update(documentId, { is_public: newState });
      setPublicState(newState);
      toast.success(newState ? 'Anyone with the link can view' : 'Link sharing disabled');
    } catch {
      toast.error('Failed to update sharing');
    }
  };

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/doc/${documentId}`);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <Modal open={true} onClose={onClose} title="Share document" size="md">
      {/* Share by email */}
      {isOwner && (
        <form onSubmit={handleShare} className="flex gap-2 mb-6">
          <div className="flex-1">
            <Input
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Add people by email"
              type="email"
              id="share-email-input"
            />
          </div>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as typeof role)}
            className="px-3 py-2 rounded-lg border border-line-strong text-sm bg-surface text-ink focus:outline-none focus:ring-2 focus:ring-brand-500/30"
            id="share-role-select"
          >
            <option value="viewer">Viewer</option>
            <option value="commenter">Commenter</option>
            <option value="editor">Editor</option>
          </select>
          <Button type="submit" loading={sharing} size="md" id="share-submit-btn">
            <UserPlus size={14} />
          </Button>
        </form>
      )}

      {/* Collaborators list */}
      <div className="space-y-2 mb-6">
        <p className="text-xs font-semibold text-ink-subtle uppercase tracking-wider">
          People with access
        </p>
        {loading ? (
          <p className="text-sm text-ink-muted py-4 text-center">Loading…</p>
        ) : collaborators.length === 0 ? (
          <p className="text-sm text-ink-muted py-4 text-center">No collaborators yet</p>
        ) : (
          collaborators.map((c) => (
            <div key={c.id} className="flex items-center justify-between py-2">
              <div className="flex items-center gap-3">
                <Avatar name={c.name} size="sm" />
                <div>
                  <p className="text-sm font-medium text-ink">{c.name}</p>
                  <p className="text-xs text-ink-muted">{c.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs px-2 py-0.5 rounded-full bg-surface-strong text-ink-muted capitalize">
                  {c.role}
                </span>
                {isOwner && (
                  <button
                    onClick={() => handleRemove(c.id, c.name)}
                    className="p-1 rounded text-ink-subtle hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            </div>
          ))
        )}
      </div>

      {/* Link sharing */}
      <div className="border-t border-line pt-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            {publicState ? (
              <Globe size={16} className="text-brand-500" />
            ) : (
              <Lock size={16} className="text-ink-subtle" />
            )}
            <div>
              <p className="text-sm font-medium text-ink">
                {publicState ? 'Anyone with the link' : 'Restricted'}
              </p>
              <p className="text-xs text-ink-muted">
                {publicState ? 'Can view this document' : 'Only people with access'}
              </p>
            </div>
          </div>
          {isOwner && (
            <Button variant="ghost" size="sm" onClick={togglePublic}>
              {publicState ? 'Restrict' : 'Enable'}
            </Button>
          )}
        </div>
        <Button variant="secondary" size="sm" onClick={copyLink} className="w-full">
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy link'}
        </Button>
      </div>
    </Modal>
  );
}
