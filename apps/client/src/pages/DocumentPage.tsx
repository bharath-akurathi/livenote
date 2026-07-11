import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuthStore } from '../stores/authStore';
import { useUIStore } from '../stores/uiStore';
import { ThemeToggle } from '../components/ThemeToggle';
import { useCollaboration } from '../hooks/useCollaboration';
import { docs } from '../lib/api';
import { CollabEditor } from '../components/Editor/CollabEditor';
import { ShareDialog } from '../components/ShareDialog';
import { VersionPanel } from '../components/VersionPanel';
import { CommentsPanel } from '../components/CommentsPanel';
import { Spinner } from '../components/UI/Spinner';
import { Button } from '../components/UI/Button';
import { Avatar } from '../components/UI/Avatar';
import type { Document as DocType } from '../types';
import {
  ArrowLeft, Share2, Clock, Save,
  Cloud, CloudOff, MessageSquare,
} from 'lucide-react';
import toast from 'react-hot-toast';

export function DocumentPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((s) => s.user);
  const { 
    shareDialogOpen, setShareDialogOpen, 
    versionPanelOpen, setVersionPanelOpen, 
    commentsPanelOpen, setCommentsPanelOpen,
    presenceSidebarOpen, setPresenceSidebarOpen
  } = useUIStore();

  const [doc, setDoc] = useState<DocType | null>(null);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const titleTimeout = useRef<ReturnType<typeof setTimeout>>();

  // Load document metadata
  useEffect(() => {
    if (!id) return;
    (async () => {
      try {
        const { data } = await docs.get(id);
        setDoc(data as DocType);
        setTitle(data.title);
      } catch {
        toast.error('Failed to load document');
        navigate('/dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [id, navigate]);

  // Setup collaboration
  const collab = useCollaboration({
    documentId: id || '',
    userName: user?.name || 'Anonymous',
  });

  // Inline title editing with debounce
  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const newTitle = e.target.value;
      setTitle(newTitle);
      if (titleTimeout.current) clearTimeout(titleTimeout.current);
      titleTimeout.current = setTimeout(async () => {
        if (!id || !newTitle.trim()) return;
        try {
          await docs.update(id, { title: newTitle.trim() });
        } catch {
          // silent — title save isn't critical
        }
      }, 500);
    },
    [id]
  );

  // Save version
  const handleSaveVersion = async () => {
    if (!id) return;
    try {
      await docs.saveVersion(id, `Manual save`);
      toast.success('Version saved');
    } catch {
      toast.error('Failed to save version');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!doc) return null;

  const isReadOnly = doc.role === 'viewer';

  return (
    <div className="h-screen bg-canvas flex flex-col overflow-hidden">
      {/* Top bar */}
      <header className="border-b border-line bg-surface z-30 flex-shrink-0">
        <div className="flex items-center justify-between px-4 h-14">
          {/* Left */}
          <div className="flex items-center gap-3 min-w-0 flex-1">
            <button
              onClick={() => navigate('/dashboard')}
              className="p-2 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-muted transition-colors flex-shrink-0"
              title="Back to dashboard"
              id="back-btn"
            >
              <ArrowLeft size={18} />
            </button>
            <input
              value={title}
              onChange={handleTitleChange}
              disabled={isReadOnly}
              className="text-lg font-semibold text-ink bg-transparent border-none outline-none min-w-0 flex-1 hover:bg-surface-muted focus:bg-surface-muted px-2 py-1 rounded-lg transition-colors"
              placeholder="Untitled document"
              id="doc-title-input"
            />
          </div>

          {/* Right */}
          <div className="flex items-center gap-2 flex-shrink-0">
            <ThemeToggle />
            {/* Connection status */}
            <div className="flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-medium">
              {collab.connected ? (
                <>
                  <Cloud size={14} className="text-emerald-500" />
                  <span className="text-emerald-600 hidden sm:inline">
                    {collab.synced ? 'Synced' : 'Syncing…'}
                  </span>
                </>
              ) : (
                <>
                  <CloudOff size={14} className="text-amber-500" />
                  <span className="text-amber-600 hidden sm:inline">Offline</span>
                </>
              )}
            </div>

            {/* Presence avatars */}
            <div 
              className="flex -space-x-2 cursor-pointer hover:opacity-80 transition-opacity" 
              onClick={() => setPresenceSidebarOpen(!presenceSidebarOpen)}
              title="Toggle presence sidebar"
            >
              {Array.from(collab.awarenessUsers.values()).slice(0, 4).map((u, i) => (
                <Avatar key={i} name={u.name} color={u.color} size="sm" className="ring-2 ring-surface" />
              ))}
              {collab.awarenessUsers.size > 4 && (
                <div className="w-6 h-6 rounded-full bg-surface-strong flex items-center justify-center text-[10px] font-bold text-ink-muted ring-2 ring-surface">
                  +{collab.awarenessUsers.size - 4}
                </div>
              )}
            </div>

            {!isReadOnly && (
              <Button variant="ghost" size="sm" onClick={handleSaveVersion} id="save-version-btn">
                <Save size={14} />
                <span className="hidden sm:inline">Save version</span>
              </Button>
            )}

            <Button variant="ghost" size="sm" onClick={() => setCommentsPanelOpen(!commentsPanelOpen)} id="comments-btn">
              <MessageSquare size={14} />
              <span className="hidden sm:inline">Comments</span>
            </Button>

            <Button variant="ghost" size="sm" onClick={() => setVersionPanelOpen(!versionPanelOpen)} id="versions-btn">
              <Clock size={14} />
              <span className="hidden sm:inline">History</span>
            </Button>

            {(doc.role === 'owner' || doc.role === 'editor') && (
              <Button variant="secondary" size="sm" onClick={() => setShareDialogOpen(true)} id="share-btn">
                <Share2 size={14} />
                Share
              </Button>
            )}
          </div>
        </div>
      </header>

      {/* Editor + Version Panel */}
      <div className="flex flex-1 overflow-hidden">
        <div className="flex-1 overflow-auto">
          {collab.provider && collab.ydoc ? (
            <div className="max-w-4xl mx-auto">
              <CollabEditor
                ydoc={collab.ydoc}
                provider={collab.provider}
                userName={user?.name || 'Anonymous'}
                userColor={collab.userColor}
                awarenessUsers={collab.awarenessUsers}
                readOnly={isReadOnly}
              />
            </div>
          ) : (
            <div className="flex items-center justify-center py-20">
              <div className="text-center">
                <Spinner size="lg" className="mx-auto mb-4" />
                <p className="text-ink-muted text-sm">Connecting to collaboration server…</p>
              </div>
            </div>
          )}
        </div>

        {/* Version panel */}
        {versionPanelOpen && (
          <VersionPanel
            documentId={id!}
            onClose={() => setVersionPanelOpen(false)}
          />
        )}

        {/* Comments panel */}
        {commentsPanelOpen && (
          <CommentsPanel
            documentId={id!}
            onClose={() => setCommentsPanelOpen(false)}
          />
        )}
      </div>

      {/* Share dialog */}
      {shareDialogOpen && (
        <ShareDialog
          documentId={id!}
          isPublic={doc.is_public}
          isOwner={doc.role === 'owner'}
          onClose={() => setShareDialogOpen(false)}
        />
      )}
    </div>
  );
}
