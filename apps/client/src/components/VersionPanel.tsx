import { useState, useEffect, useCallback } from 'react';
import { docs } from '../lib/api';
import { Button } from './UI/Button';
import { Spinner } from './UI/Spinner';
import { ResizableSidebar } from './UI/ResizableSidebar';
import type { Version } from '../types';
import { X, RotateCcw, Clock, Tag, Zap } from 'lucide-react';
import { formatDistanceToNow, format } from 'date-fns';
import toast from 'react-hot-toast';

interface VersionPanelProps {
  documentId: string;
  onClose: () => void;
}

export function VersionPanel({ documentId, onClose }: VersionPanelProps) {
  const [versions, setVersions] = useState<Version[]>([]);
  const [loading, setLoading] = useState(true);
  const [restoring, setRestoring] = useState<string | null>(null);

  const fetchVersions = useCallback(async () => {
    try {
      const { data } = await docs.versions(documentId);
      setVersions(data);
    } catch {
      toast.error('Failed to load versions');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchVersions();
  }, [fetchVersions]);

  const handleRestore = async (versionId: string) => {
    if (!confirm('Restore this version? Current content will be saved as a backup.')) return;
    setRestoring(versionId);
    try {
      await docs.restoreVersion(documentId, versionId);
      toast.success('Version restored! Reload to see changes.');
      // Give the user a moment to read the toast, then reload
      setTimeout(() => window.location.reload(), 1500);
    } catch {
      toast.error('Failed to restore version');
    } finally {
      setRestoring(null);
    }
  };

  return (
    <ResizableSidebar 
      initialWidth={320} 
      minWidth={250} 
      maxWidth={500}
      className="border-l border-line bg-surface h-full animate-slide-in-right"
      side="left"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
        <h3 className="text-sm font-semibold text-ink flex items-center gap-2">
          <Clock size={16} />
          Version history
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-ink-subtle hover:text-ink hover:bg-surface-muted transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Versions list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : versions.length === 0 ? (
          <div className="text-center py-8">
            <Clock size={24} className="mx-auto text-ink-subtle mb-2" />
            <p className="text-sm text-ink-muted">No versions yet</p>
            <p className="text-xs text-ink-subtle mt-1">Versions are created automatically as you edit</p>
          </div>
        ) : (
          versions.map((ver) => (
            <div
              key={ver.id}
              className="bg-surface-muted rounded-lg border border-line p-3 hover:border-brand-400 transition-colors group"
            >
              <div className="flex items-start justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  {ver.auto ? (
                    <Zap size={12} className="text-amber-500" />
                  ) : (
                    <Tag size={12} className="text-brand-500" />
                  )}
                  <span className="text-sm font-medium text-ink truncate">
                    {ver.label || (ver.auto ? 'Auto-save' : 'Manual save')}
                  </span>
                </div>
              </div>

              <div className="text-xs text-ink-muted mb-2 space-y-0.5">
                <p>{format(new Date(ver.created_at), 'MMM d, yyyy h:mm a')}</p>
                <p>{formatDistanceToNow(new Date(ver.created_at), { addSuffix: true })}</p>
                {ver.created_by_name && (
                  <p className="text-ink-subtle">by {ver.created_by_name}</p>
                )}
              </div>

              <Button
                variant="ghost"
                size="sm"
                onClick={() => handleRestore(ver.id)}
                loading={restoring === ver.id}
                className="w-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <RotateCcw size={12} /> Restore
              </Button>
            </div>
          ))
        )}
      </div>
    </ResizableSidebar>
  );
}
