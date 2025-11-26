import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Plus } from 'lucide-react';

const PageEditor: React.FC = () => {
    const { bookId } = useParams<{ bookId: string }>();
    const navigate = useNavigate();

    // Core form state
    const [pageNumber, setPageNumber] = useState<number>(1);
    const [backgroundType, setBackgroundType] = useState<'image' | 'video'>('image');
    const [backgroundFile, setBackgroundFile] = useState<File | null>(null);
    const [scrollFile, setScrollFile] = useState<File | null>(null);
    const [textBoxes, setTextBoxes] = useState<string>('[]'); // JSON array as string
    const [loading, setLoading] = useState(false);

    // Preview URLs (object URLs for instant preview)
    const [backgroundPreview, setBackgroundPreview] = useState<string | null>(null);
    const [scrollPreview, setScrollPreview] = useState<string | null>(null);

    // Cleanup object URLs on unmount
    useEffect(() => {
        return () => {
            if (backgroundPreview) URL.revokeObjectURL(backgroundPreview);
            if (scrollPreview) URL.revokeObjectURL(scrollPreview);
        };
    }, [backgroundPreview, scrollPreview]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!bookId) return;
        setLoading(true);
        try {
            // Upload background (image or video)
            let backgroundUrl = '';
            if (backgroundFile) {
                const formData = new FormData();
                formData.append('file', backgroundFile);
                const endpoint = backgroundType === 'image' ? '/api/upload/image' : '/api/upload/video';
                const uploadRes = await axios.post(`http://localhost:5001${endpoint}`, formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                backgroundUrl = uploadRes.data.url;
            }

            // Upload scroll overlay (always image)
            let scrollUrl = '';
            if (scrollFile) {
                const formData = new FormData();
                formData.append('file', scrollFile);
                const uploadRes = await axios.post('http://localhost:5001/api/upload/image', formData, {
                    headers: { 'Content-Type': 'multipart/form-data' },
                });
                scrollUrl = uploadRes.data.url;
            }

            const pagePayload = {
                bookId,
                pageNumber,
                backgroundUrl,
                backgroundType,
                scrollUrl,
                scrollHeight: 200,
                textBoxes: JSON.parse(textBoxes),
            };

            await axios.post('http://localhost:5001/api/pages', pagePayload);
            navigate('/books');
        } catch (err) {
            console.error('Error creating page:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-indigo-600 via-purple-600 to-pink-500 p-4">
            <div className="w-full max-w-2xl bg-white/30 backdrop-blur-lg rounded-xl shadow-xl p-8 space-y-6">
                <h2 className="text-3xl font-extrabold text-white text-center drop-shadow-md">Create New Page</h2>
                <form onSubmit={handleSubmit} className="space-y-5">
                    {/* Page Number */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Page Number</label>
                        <input
                            type="number"
                            min={1}
                            value={pageNumber}
                            onChange={e => setPageNumber(parseInt(e.target.value, 10) || 1)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                            required
                        />
                    </div>

                    {/* Background Type */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Background Type</label>
                        <select
                            value={backgroundType}
                            onChange={e => setBackgroundType(e.target.value as any)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                        >
                            <option value="image">Image</option>
                            <option value="video">Video</option>
                        </select>
                    </div>

                    {/* Background File */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Background File</label>
                        <input
                            type="file"
                            accept={backgroundType === 'image' ? 'image/*' : 'video/*'}
                            onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setBackgroundFile(file);
                                if (file) {
                                    const url = URL.createObjectURL(file);
                                    setBackgroundPreview(url);
                                } else {
                                    setBackgroundPreview(null);
                                }
                            }}
                            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
                        />
                        {backgroundPreview && (
                            <div className="mt-3">
                                {backgroundType === 'image' ? (
                                    <img src={backgroundPreview} alt="Background preview" className="max-w-full h-48 object-cover rounded-md" />
                                ) : (
                                    <video src={backgroundPreview} controls className="max-w-full h-48 object-cover rounded-md" />
                                )}
                            </div>
                        )}
                    </div>

                    {/* Scroll Overlay */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Scroll Overlay Image (optional)</label>
                        <input
                            type="file"
                            accept="image/*"
                            onChange={e => {
                                const file = e.target.files?.[0] || null;
                                setScrollFile(file);
                                if (file) {
                                    const url = URL.createObjectURL(file);
                                    setScrollPreview(url);
                                } else {
                                    setScrollPreview(null);
                                }
                            }}
                            className="w-full text-white file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-500 file:text-white hover:file:bg-indigo-600"
                        />
                        {scrollPreview && (
                            <div className="mt-3">
                                <img src={scrollPreview} alt="Scroll preview" className="max-w-full h-24 object-contain rounded-md" />
                            </div>
                        )}
                    </div>

                    {/* Text Boxes JSON */}
                    <div>
                        <label className="block text-sm font-medium text-white mb-1">Text Boxes (JSON array)</label>
                        <textarea
                            rows={5}
                            value={textBoxes}
                            onChange={e => setTextBoxes(e.target.value)}
                            className="w-full rounded-md border border-white/30 bg-white/10 text-white placeholder-gray-200 focus:outline-none focus:ring-2 focus:ring-indigo-300 px-3 py-2 transition"
                            placeholder='[{"text":"Hello","x":100,"y":150,"alignment":"center"}]'
                        />
                    </div>

                    {/* Submit Button */}
                    <div className="flex justify-center">
                        <button
                            type="submit"
                            disabled={loading}
                            className="inline-flex items-center gap-2 bg-gradient-to-r from-indigo-500 to-purple-500 text-white font-semibold px-6 py-3 rounded-full shadow-md hover:shadow-lg hover:from-indigo-600 hover:to-purple-600 transition disabled:opacity-50"
                        >
                            {loading ? 'Saving...' : <><Plus className="w-5 h-5" /> Save Page</>}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default PageEditor;
