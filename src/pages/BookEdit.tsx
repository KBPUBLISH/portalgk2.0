import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';

const BookEdit: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();

    // Form state
    const [title, setTitle] = useState('');
    const [author, setAuthor] = useState('');
    const [description, setDescription] = useState('');
    const [coverImage, setCoverImage] = useState('');
    const [minAge, setMinAge] = useState<number | ''>('');
    const [category, setCategory] = useState('Other');
    const [status, setStatus] = useState('draft');
    const [loading, setLoading] = useState(false);
    const [fetching, setFetching] = useState(true);

    // Load existing book data
    useEffect(() => {
        const fetchBook = async () => {
            if (!bookId) return;
            try {
                const res = await axios.get(`http://localhost:5001/api/books/${bookId}`);
                const b = res.data;
                setTitle(b.title || '');
                setAuthor(b.author || '');
                setDescription(b.description || '');
                setCoverImage(b.coverImage || '');
                setMinAge(b.minAge ?? '');
                setCategory(b.category || 'Other');
                setStatus(b.status || 'draft');
            } catch (err) {
                console.error('Failed to fetch book:', err);
            } finally {
                setFetching(false);
            }
        };
        fetchBook();
    }, [bookId]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookId) return;
        setLoading(true);
        try {
            const payload = {
                title,
                author,
                description,
                coverImage,
                minAge: minAge === '' ? undefined : minAge,
                category,
                status,
            };
            await axios.put(`http://localhost:5001/api/books/${bookId}`, payload);
            navigate('/books');
        } catch (err) {
            console.error('Error updating book:', err);
        } finally {
            setLoading(false);
        }
    };

    if (fetching) {
        return <div className="p-6 text-center">Loading book data...</div>;
    }

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4">
            <div className="w-full max-w-2xl bg-white/30 backdrop-blur-lg rounded-xl shadow-xl p-8 space-y-6">
                <h2 className="text-3xl font-extrabold text-white text-center drop-shadow-md">Edit Book</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Title</label>
                        <input
                            type="text"
                            value={title}
                            onChange={e => setTitle(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Author</label>
                        <input
                            type="text"
                            value={author}
                            onChange={e => setAuthor(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                            required
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Description</label>
                        <textarea
                            rows={4}
                            value={description}
                            onChange={e => setDescription(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Cover Image URL</label>
                        <input
                            type="url"
                            value={coverImage}
                            onChange={e => setCoverImage(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Minimum Age</label>
                        <input
                            type="number"
                            min={0}
                            max={18}
                            value={minAge}
                            onChange={e => setMinAge(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Category</label>
                        <select
                            value={category}
                            onChange={e => setCategory(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        >
                            <option value="Bible Stories">Bible Stories</option>
                            <option value="Prayers">Prayers</option>
                            <option value="Songs">Songs</option>
                            <option value="Devotionals">Devotionals</option>
                            <option value="Activities">Activities</option>
                            <option value="Other">Other</option>
                        </select>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Status</label>
                        <select
                            value={status}
                            onChange={e => setStatus(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        >
                            <option value="draft">Draft</option>
                            <option value="published">Published</option>
                            <option value="archived">Archived</option>
                        </select>
                    </div>
                    <div className="flex justify-center">
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-6 py-3 rounded-full shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-purple-600 transition disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : <><Plus className="w-5 h-5" /> Save Changes</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default BookEdit;
