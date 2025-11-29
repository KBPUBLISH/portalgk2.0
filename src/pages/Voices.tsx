import React, { useEffect, useState } from 'react';
import { Volume2, Play, Pause, RefreshCw, XCircle } from 'lucide-react';
import axios from 'axios';

interface Voice {
    _id?: string;
    voiceId: string;
    name: string;
    category: string;
    previewUrl?: string;
    enabled: boolean;
    description?: string;
    ageGroup?: string;
    language?: string;
}

const Voices: React.FC = () => {
    const [voices, setVoices] = useState<Voice[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncing, setSyncing] = useState(false);
    const [playingPreview, setPlayingPreview] = useState<string | null>(null);
    const [previewAudio, setPreviewAudio] = useState<HTMLAudioElement | null>(null);

    useEffect(() => {
        fetchVoices();
        return () => {
            if (previewAudio) {
                previewAudio.pause();
                previewAudio.src = '';
            }
        };
    }, []);

    const fetchVoices = async () => {
        try {
            const response = await axios.get('http://localhost:5001/api/voices');
            setVoices(response.data);
        } catch (error) {
            console.error('Error fetching voices:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleSync = async () => {
        setSyncing(true);
        try {
            const response = await axios.get('http://localhost:5001/api/voices/sync');
            alert(`Synced ${response.data.synced} voices (${response.data.created} new, ${response.data.updated} updated)`);
            await fetchVoices();
        } catch (error: any) {
            console.error('Error syncing voices:', error);
            alert(error.response?.data?.message || 'Failed to sync voices');
        } finally {
            setSyncing(false);
        }
    };

    const handleToggleEnabled = async (voice: Voice) => {
        try {
            const endpoint = voice.enabled 
                ? `http://localhost:5001/api/voices/${voice.voiceId}/disable`
                : `http://localhost:5001/api/voices/${voice.voiceId}/enable`;
            
            await axios.put(endpoint);
            await fetchVoices();
        } catch (error: any) {
            console.error('Error toggling voice:', error);
            alert(error.response?.data?.message || 'Failed to update voice');
        }
    };

    const handleDeselectAll = async () => {
        if (!confirm('Are you sure you want to disable all voices? This will remove all voices from app use.')) {
            return;
        }

        try {
            const enabledVoices = voices.filter(v => v.enabled);
            if (enabledVoices.length === 0) {
                alert('No voices are currently enabled.');
                return;
            }

            // Disable all enabled voices
            const disablePromises = enabledVoices.map(voice =>
                axios.put(`http://localhost:5001/api/voices/${voice.voiceId}/disable`)
            );

            await Promise.all(disablePromises);
            await fetchVoices();
            alert(`Disabled ${enabledVoices.length} voice(s)`);
        } catch (error: any) {
            console.error('Error deselecting all voices:', error);
            alert(error.response?.data?.message || 'Failed to disable all voices');
        }
    };

    const handlePlayPreview = async (voice: Voice) => {
        // Stop any currently playing preview
        if (previewAudio) {
            previewAudio.pause();
            previewAudio.src = '';
            setPreviewAudio(null);
        }

        if (playingPreview === voice.voiceId) {
            setPlayingPreview(null);
            return;
        }

        try {
            // Generate a test TTS audio with a sample text
            const sampleText = `Hello! This is ${voice.name}, a ${voice.category} voice. I can help bring stories to life for children.`;
            
            setPlayingPreview(voice.voiceId);
            
            const response = await axios.post('http://localhost:5001/api/tts/generate', {
                text: sampleText,
                voiceId: voice.voiceId
            });

            if (response.data && response.data.audioUrl) {
                const audio = new Audio(response.data.audioUrl);
                
                // Set up event handlers before playing
                audio.onended = () => {
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                };
                
                audio.onpause = () => {
                    // Only clear if paused (not if ended)
                    if (audio.ended) {
                        setPlayingPreview(null);
                    }
                };
                
                // Only show error if audio actually fails to load/play
                audio.onerror = (e) => {
                    console.error('Audio playback error:', e);
                    // Check if error is actually a real error
                    if (audio.error && audio.error.code !== 0) {
                        setPlayingPreview(null);
                        setPreviewAudio(null);
                        alert(`Failed to play preview: ${audio.error.message || 'Unknown error'}`);
                    }
                };
                
                setPreviewAudio(audio);
                
                // Try to play and catch any errors
                try {
                    await audio.play();
                } catch (playError: any) {
                    console.error('Play error:', playError);
                    setPlayingPreview(null);
                    setPreviewAudio(null);
                    // Only show alert if it's a real error (not user interaction required)
                    if (playError.name !== 'NotAllowedError') {
                        alert(`Failed to play preview: ${playError.message || 'Unknown error'}`);
                    }
                }
            } else {
                setPlayingPreview(null);
                alert('No audio URL returned from server');
            }
        } catch (error: any) {
            console.error('Error generating preview:', error);
            setPlayingPreview(null);
            const errorMessage = error.response?.data?.message || error.message || 'Failed to generate preview';
            alert(errorMessage);
        }
    };

    const enabledCount = voices.filter(v => v.enabled).length;
    const disabledCount = voices.filter(v => !v.enabled).length;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="text-gray-500">Loading voices...</div>
            </div>
        );
    }

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Voice Management</h1>
                    <p className="text-gray-600 mt-1">
                        Manage which voices are available in the app
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleDeselectAll}
                        disabled={voices.filter(v => v.enabled).length === 0}
                        className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <XCircle className="w-4 h-4" />
                        Deselect All
                    </button>
                    <button
                        onClick={handleSync}
                        disabled={syncing}
                        className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition flex items-center gap-2 disabled:opacity-50"
                    >
                        <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                        {syncing ? 'Syncing...' : 'Sync from ElevenLabs'}
                    </button>
                </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-3 gap-4 mb-6">
                <div className="bg-white p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Total Voices</div>
                    <div className="text-2xl font-bold text-gray-800">{voices.length}</div>
                </div>
                <div className="bg-green-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-green-600">Enabled</div>
                    <div className="text-2xl font-bold text-green-700">{enabledCount}</div>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg shadow">
                    <div className="text-sm text-gray-600">Disabled</div>
                    <div className="text-2xl font-bold text-gray-700">{disabledCount}</div>
                </div>
            </div>

            {/* Voices List */}
            <div className="bg-white rounded-lg shadow">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Voice
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Category
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                            {voices.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-8 text-center text-gray-500">
                                        No voices found. Click "Sync from ElevenLabs" to load voices.
                                    </td>
                                </tr>
                            ) : (
                                voices.map((voice) => (
                                    <tr key={voice.voiceId} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <Volume2 className="w-5 h-5 text-indigo-600 mr-3" />
                                                <div>
                                                    <div className="text-sm font-medium text-gray-900">{voice.name}</div>
                                                    {voice.description && (
                                                        <div className="text-sm text-gray-500">{voice.description}</div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-blue-100 text-blue-800">
                                                {voice.category}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span
                                                className={`px-2 py-1 text-xs font-semibold rounded-full ${
                                                    voice.enabled
                                                        ? 'bg-green-100 text-green-800'
                                                        : 'bg-gray-100 text-gray-800'
                                                }`}
                                            >
                                                {voice.enabled ? 'Enabled' : 'Disabled'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                                            <div className="flex items-center gap-4">
                                                <button
                                                    onClick={() => handlePlayPreview(voice)}
                                                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg transition ${
                                                        playingPreview === voice.voiceId
                                                            ? 'bg-indigo-600 text-white'
                                                            : 'bg-indigo-50 text-indigo-600 hover:bg-indigo-100'
                                                    }`}
                                                    title="Preview voice"
                                                >
                                                    {playingPreview === voice.voiceId ? (
                                                        <>
                                                            <Pause className="w-4 h-4" />
                                                            <span className="text-xs">Playing...</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Play className="w-4 h-4" />
                                                            <span className="text-xs">Preview</span>
                                                        </>
                                                    )}
                                                </button>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input
                                                        type="checkbox"
                                                        checked={voice.enabled}
                                                        onChange={() => handleToggleEnabled(voice)}
                                                        className="w-5 h-5 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500 cursor-pointer"
                                                    />
                                                    <span className="text-sm text-gray-700">In App Use</span>
                                                </label>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
};

export default Voices;

