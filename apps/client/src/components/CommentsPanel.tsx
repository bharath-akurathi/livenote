import { useState, useEffect, useCallback, useRef } from 'react';
import { comments as commentsApi } from '../lib/api';
import { useAuthStore } from '../stores/authStore';
import { Button } from './UI/Button';
import { Avatar } from './UI/Avatar';
import { Spinner } from './UI/Spinner';
import { ResizableSidebar } from './UI/ResizableSidebar';
import type { Comment } from '../types';
import {
  X, Send, MessageSquare, CheckCircle2, Circle,
  Reply, Trash2, CornerDownRight,
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import toast from 'react-hot-toast';

interface CommentsProps {
  documentId: string;
  onClose: () => void;
}

export function CommentsPanel({ documentId, onClose }: CommentsProps) {
  const user = useAuthStore((s) => s.user);
  const [allComments, setAllComments] = useState<Comment[]>([]);
  const [loading, setLoading] = useState(true);
  const [newComment, setNewComment] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [replyTo, setReplyTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState('');
  const [filter, setFilter] = useState<'all' | 'open' | 'resolved'>('all');
  const bottomRef = useRef<HTMLDivElement>(null);

  const fetchComments = useCallback(async () => {
    try {
      const { data } = await commentsApi.list(documentId);
      setAllComments(data);
    } catch {
      toast.error('Failed to load comments');
    } finally {
      setLoading(false);
    }
  }, [documentId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  // Separate root comments and replies
  const rootComments = allComments.filter((c) => !c.parent_id);
  const replies = allComments.filter((c) => c.parent_id);

  const getReplies = (parentId: string) =>
    replies.filter((r) => r.parent_id === parentId);

  const filteredRoots = rootComments.filter((c) => {
    if (filter === 'open') return !c.resolved;
    if (filter === 'resolved') return c.resolved;
    return true;
  });

  const handleSubmitComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;
    setSubmitting(true);
    try {
      await commentsApi.create(documentId, { content: newComment.trim() });
      setNewComment('');
      await fetchComments();
      bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    } catch {
      toast.error('Failed to add comment');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReply = async (parentId: string) => {
    if (!replyText.trim()) return;
    try {
      await commentsApi.create(documentId, {
        content: replyText.trim(),
        parent_id: parentId,
      });
      setReplyTo(null);
      setReplyText('');
      await fetchComments();
    } catch {
      toast.error('Failed to reply');
    }
  };

  const handleToggleResolve = async (comment: Comment) => {
    try {
      await commentsApi.update(documentId, comment.id, { resolved: !comment.resolved });
      await fetchComments();
      toast.success(comment.resolved ? 'Comment reopened' : 'Comment resolved');
    } catch {
      toast.error('Failed to update comment');
    }
  };

  const handleDelete = async (commentId: string) => {
    if (!confirm('Delete this comment?')) return;
    try {
      await commentsApi.delete(documentId, commentId);
      await fetchComments();
      toast.success('Comment deleted');
    } catch {
      toast.error('Failed to delete comment');
    }
  };

  return (
    <ResizableSidebar 
      initialWidth={320} 
      minWidth={250} 
      maxWidth={500}
      className="border-l border-gray-200 bg-gray-50 h-full animate-slide-in-right"
      side="left"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
        <h3 className="text-sm font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare size={16} />
          Comments
          {allComments.length > 0 && (
            <span className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full">
              {allComments.length}
            </span>
          )}
        </h3>
        <button
          onClick={onClose}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <X size={16} />
        </button>
      </div>

      {/* Filter tabs */}
      <div className="flex border-b border-gray-200 bg-white px-4">
        {(['all', 'open', 'resolved'] as const).map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`px-3 py-2 text-xs font-medium border-b-2 transition-colors capitalize ${
              filter === f
                ? 'border-brand-500 text-brand-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {/* Comments list */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="md" />
          </div>
        ) : filteredRoots.length === 0 ? (
          <div className="text-center py-8">
            <MessageSquare size={24} className="mx-auto text-gray-300 mb-2" />
            <p className="text-sm text-gray-500">
              {filter === 'all' ? 'No comments yet' : `No ${filter} comments`}
            </p>
          </div>
        ) : (
          filteredRoots.map((comment) => (
            <div
              key={comment.id}
              className={`bg-white rounded-lg border p-3 transition-colors ${
                comment.resolved
                  ? 'border-gray-100 opacity-70'
                  : 'border-gray-200'
              }`}
            >
              {/* Comment header */}
              <div className="flex items-start justify-between mb-2">
                <div className="flex items-center gap-2">
                  <Avatar name={comment.user_name} size="sm" />
                  <div>
                    <p className="text-sm font-medium text-gray-900">{comment.user_name}</p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(new Date(comment.created_at), { addSuffix: true })}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {/* Resolve toggle */}
                  <button
                    onClick={() => handleToggleResolve(comment)}
                    className={`p-1 rounded transition-colors ${
                      comment.resolved
                        ? 'text-emerald-500 hover:bg-emerald-50'
                        : 'text-gray-400 hover:text-emerald-500 hover:bg-emerald-50'
                    }`}
                    title={comment.resolved ? 'Reopen' : 'Resolve'}
                  >
                    {comment.resolved ? <CheckCircle2 size={14} /> : <Circle size={14} />}
                  </button>
                  {/* Delete (only own comments) */}
                  {comment.user_id === user?.id && (
                    <button
                      onClick={() => handleDelete(comment.id)}
                      className="p-1 rounded text-gray-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                      title="Delete"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Comment body */}
              <p className="text-sm text-gray-700 mb-2 leading-relaxed">{comment.content}</p>

              {/* Quoted text if anchored */}
              {comment.range_json?.text && (
                <div className="text-xs bg-amber-50 border-l-2 border-amber-300 px-2 py-1 mb-2 text-amber-800 italic rounded-r">
                  "{comment.range_json.text}"
                </div>
              )}

              {/* Replies */}
              {getReplies(comment.id).length > 0 && (
                <div className="mt-2 space-y-2 pl-3 border-l-2 border-gray-100">
                  {getReplies(comment.id).map((reply) => (
                    <div key={reply.id} className="pt-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Avatar name={reply.user_name} size="sm" />
                        <span className="text-xs font-medium text-gray-700">{reply.user_name}</span>
                        <span className="text-xs text-gray-400">
                          {formatDistanceToNow(new Date(reply.created_at), { addSuffix: true })}
                        </span>
                      </div>
                      <p className="text-sm text-gray-600">{reply.content}</p>
                    </div>
                  ))}
                </div>
              )}

              {/* Reply action */}
              {replyTo === comment.id ? (
                <div className="mt-2 flex gap-1.5">
                  <input
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Reply…"
                    className="flex-1 text-sm px-2.5 py-1.5 rounded-lg border border-gray-300 focus:outline-none focus:ring-1 focus:ring-brand-500"
                    autoFocus
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        handleSubmitReply(comment.id);
                      }
                      if (e.key === 'Escape') {
                        setReplyTo(null);
                        setReplyText('');
                      }
                    }}
                  />
                  <button
                    onClick={() => handleSubmitReply(comment.id)}
                    className="p-1.5 rounded-lg bg-brand-500 text-white hover:bg-brand-600 transition-colors"
                  >
                    <Send size={12} />
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setReplyTo(comment.id)}
                  className="flex items-center gap-1 text-xs text-gray-400 hover:text-brand-500 mt-1 transition-colors"
                >
                  <CornerDownRight size={12} /> Reply
                </button>
              )}
            </div>
          ))
        )}
        <div ref={bottomRef} />
      </div>

      {/* New comment input */}
      <form
        onSubmit={handleSubmitComment}
        className="border-t border-gray-200 bg-white p-3 flex gap-2"
      >
        <input
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Add a comment…"
          className="flex-1 text-sm px-3 py-2 rounded-lg border border-gray-300 focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-500"
          id="new-comment-input"
        />
        <Button
          type="submit"
          size="sm"
          loading={submitting}
          disabled={!newComment.trim()}
          id="submit-comment-btn"
        >
          <Send size={14} />
        </Button>
      </form>
    </ResizableSidebar>
  );
}
