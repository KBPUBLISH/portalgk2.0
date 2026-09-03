import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { MessageSquare, Trash2, Upload } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

const API_URL = import.meta.env.VITE_API_URL || 'https://backendgk2-0.onrender.com';
const POST_MAX = 800;

interface CreatorPost {
  id: string;
  body: string;
  imageUrl?: string;
  likeCount: number;
  commentCount: number;
  createdAt: string;
  status?: string;
}

interface WallNote {
  id: string;
  body: string;
  displayName: string;
  createdAt: string;
  status?: string;
}

const CreatorPosts: React.FC = () => {
  const { getToken } = useAuth();
  const [posts, setPosts] = useState<CreatorPost[]>([]);
  const [wall, setWall] = useState<WallNote[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [body, setBody] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editBody, setEditBody] = useState('');

  const headers = () => ({ Authorization: `Bearer ${getToken()}` });

  const load = async () => {
    try {
      const [postsRes, wallRes] = await Promise.all([
        axios.get(`${API_URL}/api/hub/my-posts`, { headers: headers() }),
        axios.get(`${API_URL}/api/hub/my-wall`, { headers: headers() }),
      ]);
      setPosts(postsRes.data.posts || []);
      setWall(wallRes.data.notes || []);
    } catch (err) {
      console.error('Failed to load posts:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const handleImageUpload = async (file: File) => {
    setUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await axios.post(
        `${API_URL}/api/upload/image?bookId=creator-posts&type=creator-post`,
        formData,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      setImageUrl(res.data.url || '');
    } catch (err) {
      console.error('Upload error:', err);
      setError('Could not upload that photo. Try another image.');
    } finally {
      setUploading(false);
    }
  };

  const handlePublish = async () => {
    if (saving) return;
    setSaving(true);
    setError(null);
    try {
      await axios.post(
        `${API_URL}/api/hub/my-posts`,
        { body, imageUrl },
        { headers: headers() },
      );
      setBody('');
      setImageUrl('');
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not publish this post.');
    } finally {
      setSaving(false);
    }
  };

  const handleSaveEdit = async (id: string) => {
    setSaving(true);
    setError(null);
    try {
      await axios.put(
        `${API_URL}/api/hub/my-posts/${id}`,
        { body: editBody },
        { headers: headers() },
      );
      setEditingId(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not update this post.');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this post? Families will no longer see it.')) return;
    try {
      await axios.delete(`${API_URL}/api/hub/my-posts/${id}`, { headers: headers() });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not delete this post.');
    }
  };

  const handleHideWall = async (id: string) => {
    if (!confirm('Hide this note from your public profile?')) return;
    try {
      await axios.delete(`${API_URL}/api/hub/my-wall/${id}`, { headers: headers() });
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not hide that note.');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Posts</h1>
        <p className="text-gray-500">Share a short update with families on your public profile.</p>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-4">
        <h2 className="font-semibold text-gray-900">New post</h2>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value.slice(0, POST_MAX))}
          rows={4}
          placeholder="A short kid-friendly note for families..."
          className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-800 focus:outline-none focus:ring-2 focus:ring-indigo-500"
        />
        <div className="flex items-center justify-between text-xs text-gray-400">
          <span>{body.length}/{POST_MAX}</span>
          {imageUrl && <span>Photo attached</span>}
        </div>
        {imageUrl && (
          <img src={imageUrl} alt="" className="max-h-48 rounded-lg object-cover" />
        )}
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 cursor-pointer">
            <Upload className="w-4 h-4" />
            {uploading ? 'Uploading...' : 'Add photo'}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              disabled={uploading}
              onChange={(e) => e.target.files?.[0] && void handleImageUpload(e.target.files[0])}
            />
          </label>
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="text-sm text-gray-500 hover:text-gray-700"
            >
              Remove photo
            </button>
          )}
          <button
            type="button"
            disabled={saving || uploading || (!body.trim() && !imageUrl)}
            onClick={() => void handlePublish()}
            className="ml-auto px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
          >
            {saving ? 'Publishing...' : 'Publish'}
          </button>
        </div>
        {error && <p className="text-sm text-red-600">{error}</p>}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900">Your posts</h2>
        {posts.length === 0 && (
          <p className="text-sm text-gray-500">No posts yet. Families will see updates here on your profile.</p>
        )}
        {posts.map((post) => (
          <div key={post.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
            {editingId === post.id ? (
              <div className="space-y-3">
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value.slice(0, POST_MAX))}
                  rows={3}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm"
                />
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => void handleSaveEdit(post.id)}
                    className="px-3 py-1.5 bg-indigo-600 text-white text-sm rounded-lg"
                  >
                    Save
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditingId(null)}
                    className="px-3 py-1.5 text-sm text-gray-600"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <>
                {post.body && <p className="text-gray-800 whitespace-pre-wrap">{post.body}</p>}
                {post.imageUrl && (
                  <img src={post.imageUrl} alt="" className="mt-3 max-h-56 rounded-lg object-cover" />
                )}
                <div className="mt-3 flex items-center justify-between text-xs text-gray-400">
                  <span>
                    {new Date(post.createdAt).toLocaleDateString()} · {post.likeCount} likes · {post.commentCount} comments
                    {post.status && post.status !== 'published' ? ` · ${post.status}` : ''}
                  </span>
                  <div className="flex gap-3">
                    <button
                      type="button"
                      onClick={() => {
                        setEditingId(post.id);
                        setEditBody(post.body);
                      }}
                      className="text-indigo-600 hover:text-indigo-800"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void handleDelete(post.id)}
                      className="text-red-600 hover:text-red-800 inline-flex items-center gap-1"
                    >
                      <Trash2 className="w-3 h-3" /> Delete
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
        ))}
      </div>

      <div className="space-y-3">
        <h2 className="font-semibold text-gray-900 flex items-center gap-2">
          <MessageSquare className="w-4 h-4" /> Profile wall
        </h2>
        <p className="text-sm text-gray-500">Notes families left on your public profile. Hide any that should not stay up.</p>
        {wall.length === 0 && <p className="text-sm text-gray-500">No wall notes yet.</p>}
        {wall.map((note) => (
          <div key={note.id} className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 flex items-start justify-between gap-4">
            <div>
              <p className="text-sm font-medium text-gray-900">{note.displayName}</p>
              <p className="text-sm text-gray-700 mt-1">{note.body}</p>
              <p className="text-xs text-gray-400 mt-2">
                {new Date(note.createdAt).toLocaleDateString()}
                {note.status === 'hidden' ? ' · hidden' : ''}
              </p>
            </div>
            {note.status !== 'hidden' && (
              <button
                type="button"
                onClick={() => void handleHideWall(note.id)}
                className="text-sm text-gray-500 hover:text-red-600 shrink-0"
              >
                Hide
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};

export default CreatorPosts;
