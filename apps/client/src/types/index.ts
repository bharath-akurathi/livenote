export interface User {
  id: string;
  email: string;
  name: string;
  avatarUrl?: string;
}

export interface Document {
  id: string;
  title: string;
  owner_id: string;
  owner_name: string;
  role: 'owner' | 'editor' | 'commenter' | 'viewer';
  is_public: boolean;
  content_json?: object;
  created_at: string;
  updated_at: string;
}

export interface Version {
  id: string;
  label: string | null;
  auto: boolean;
  created_by_name: string | null;
  created_at: string;
  content_json?: object;
}

export interface Collaborator {
  id: string;
  name: string;
  email: string;
  role: 'viewer' | 'commenter' | 'editor';
}

export interface Comment {
  id: string;
  content: string;
  range_json: { from: number; to: number; text?: string } | null;
  parent_id: string | null;
  resolved: boolean;
  user_id: string;
  user_name: string;
  user_email: string;
  created_at: string;
  updated_at: string;
}

// Awareness state from Yjs (ephemeral user presence)
export interface AwarenessUser {
  name: string;
  color: string;
  cursor?: { anchor: number; head: number } | null;
}
