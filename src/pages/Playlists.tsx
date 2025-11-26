import React, { useEffect, useState } from 'react';
import { Plus } from 'lucide-react';
import axios from 'axios';

interface Playlist {
    _id: string;
    title: string;
    status: string;
    items: any[];
}

const Playlists: React.FC = () => {
    const [playlists, setPlaylists] = useState<Playlist[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchPlaylists = async () => {
            try {
                const response = await axios.get('http://localhost:5001/api/playlists');
                setPlaylists(response.data);
            } catch (error) {
                console.error('Error fetching playlists:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchPlaylists();
    }, []);

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-3xl font-bold text-gray-800">Playlists</h1>
                <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700 transition-colors">
                    <Plus className="w-5 h-5" />
                    Add Playlist
                </button>
            </div>

            {loading ? (
                <p>Loading playlists...</p>
            ) : playlists.length === 0 ? (
                <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
                    <p className="text-gray-500">No playlists found. Create your first one!</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {playlists.map((playlist) => (
                        <div key={playlist._id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                            <h2 className="text-xl font-semibold text-gray-800">{playlist.title}</h2>
                            <p className="text-gray-600">{playlist.items.length} tracks</p>
                            <span className={`inline-block mt-4 px-3 py-1 rounded-full text-sm ${playlist.status === 'published' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                                }`}>
                                {playlist.status}
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};

export default Playlists;
