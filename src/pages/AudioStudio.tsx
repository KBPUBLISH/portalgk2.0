import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { AudioLines, Plus, Trash2, ArrowLeft } from 'lucide-react';
import apiClient from '../services/apiClient';

type LineType = 'dialogue' | 'sound-effect' | 'stage-direction';

interface ScriptLine {
    type: LineType;
    characterName?: string;
    dialogue?: string;
    soundEffect?: string;
    emotion?: string;
    voiceId?: string;
}

interface ProductionSegment {
    name: string;
    startLineIndex: number;
    endLineIndex: number;
    status?: string;
    audioUrl?: string;
}

interface EpisodeScript {
    _id: string;
    title: string;
    showName: string;
    episodeNumber?: number;
    season?: number;
    description?: string;
    scriptText: string;
    lines: ScriptLine[];
    status: string;
    productionSegments: ProductionSegment[];
    updatedAt?: string;
}

interface CharacterVoice {
    _id: string;
    name: string;
    showName: string;
    elevenLabsVoiceId: string;
    description?: string;
}

interface LibraryVoice {
    voiceId: string;
    name: string;
    customName?: string;
}

interface VoiceCollection {
    id: string;
    title: string;
}

const SCRIPT_SAMPLE = `NARRATOR: Welcome to episode 1 of Mick in Heaven.

[SFX: heavenly music]

MICK: [excited] Wow, this place is amazing!

GABRIEL: Welcome, Mick. Let me show you around.`;

const STATUS_LABEL: Record<string, string> = {
    draft: 'Draft',
    parsed: 'Parsed',
    'voice-assigned': 'Voices assigned',
    'in-production': 'In production',
    completed: 'Completed',
};

function apiError(error: unknown, fallback: string) {
    const err = error as { response?: { data?: { error?: string; message?: string } } };
    return err.response?.data?.error || err.response?.data?.message || fallback;
}

function statusClass(status: string) {
    switch (status) {
        case 'completed':
            return 'bg-green-100 text-green-800';
        case 'voice-assigned':
        case 'in-production':
            return 'bg-indigo-100 text-indigo-800';
        case 'parsed':
            return 'bg-amber-100 text-amber-800';
        default:
            return 'bg-gray-100 text-gray-700';
    }
}

const AudioStudio: React.FC = () => {
    const { scriptId } = useParams();
    if (scriptId) return <ScriptEditor key={scriptId} scriptId={scriptId} />;
    return <ScriptList />;
};

const ScriptList: React.FC = () => {
    const [scripts, setScripts] = useState<EpisodeScript[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get<EpisodeScript[]>('/api/episode-scripts');
                if (!cancelled) setScripts(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                if (!cancelled) setError(apiError(err, 'Could not load scripts'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, []);

    const remove = async (script: EpisodeScript) => {
        if (!window.confirm(`Delete “${script.title}”?`)) return;
        try {
            await apiClient.delete(`/api/episode-scripts/${script._id}`);
            setScripts((prev) => prev.filter((item) => item._id !== script._id));
        } catch (err) {
            alert(apiError(err, 'Could not delete that script'));
        }
    };

    return (
        <div>
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <AudioLines className="w-8 h-8 text-indigo-600" />
                        Audio Studio
                    </h1>
                    <p className="text-gray-600 mt-1">
                        Write an episode script, parse the lines, and assign a voice to each character.
                    </p>
                </div>
                <Link
                    to="/audio-studio/new"
                    className="bg-indigo-600 text-white px-4 py-2 rounded-lg flex items-center gap-2 hover:bg-indigo-700"
                >
                    <Plus className="w-5 h-5" />
                    New script
                </Link>
            </div>

            {loading ? (
                <div className="flex justify-center py-12">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
                </div>
            ) : error ? (
                <div className="bg-red-50 text-red-700 rounded-lg p-4">{error}</div>
            ) : scripts.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-lg shadow">
                    <AudioLines className="w-12 h-12 mx-auto text-gray-400 mb-4" />
                    <h3 className="text-lg font-medium text-gray-900 mb-2">No scripts yet</h3>
                    <p className="text-gray-500 mb-4">Start with a show name and a script in CHARACTER: dialogue form.</p>
                    <Link
                        to="/audio-studio/new"
                        className="inline-flex items-center gap-2 bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700"
                    >
                        <Plus className="w-5 h-5" />
                        Create script
                    </Link>
                </div>
            ) : (
                <div className="bg-white rounded-lg shadow overflow-hidden">
                    <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                            <tr>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Script</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Show</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Lines</th>
                                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {scripts.map((script) => (
                                <tr key={script._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <Link to={`/audio-studio/${script._id}`} className="font-medium text-gray-900 hover:text-indigo-600">
                                            {script.title}
                                        </Link>
                                        {script.episodeNumber ? (
                                            <div className="text-xs text-gray-500">Episode {script.episodeNumber}</div>
                                        ) : null}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{script.showName}</td>
                                    <td className="px-6 py-4 text-sm text-gray-700">{script.lines?.length || 0}</td>
                                    <td className="px-6 py-4">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass(script.status)}`}>
                                            {STATUS_LABEL[script.status] || script.status}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <button
                                            type="button"
                                            onClick={() => remove(script)}
                                            className="text-gray-400 hover:text-red-600"
                                            aria-label={`Delete ${script.title}`}
                                        >
                                            <Trash2 className="w-4 h-4 inline" />
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

const ScriptEditor: React.FC<{ scriptId: string }> = ({ scriptId }) => {
    const navigate = useNavigate();
    const isNew = scriptId === 'new';
    const [loading, setLoading] = useState(!isNew);
    const [busy, setBusy] = useState('');
    const [error, setError] = useState('');
    const [notice, setNotice] = useState('');
    const [title, setTitle] = useState('');
    const [showName, setShowName] = useState('');
    const [episodeNumber, setEpisodeNumber] = useState('');
    const [description, setDescription] = useState('');
    const [scriptText, setScriptText] = useState(isNew ? SCRIPT_SAMPLE : '');
    const [lines, setLines] = useState<ScriptLine[]>([]);
    const [segments, setSegments] = useState<ProductionSegment[]>([]);
    const [status, setStatus] = useState('draft');
    const [voices, setVoices] = useState<CharacterVoice[]>([]);
    const [library, setLibrary] = useState<LibraryVoice[]>([]);
    const [collections, setCollections] = useState<VoiceCollection[]>([]);
    const [collectionId, setCollectionId] = useState('');
    const [collectionVoices, setCollectionVoices] = useState<LibraryVoice[]>([]);
    const [voiceSearch, setVoiceSearch] = useState('');
    const [voiceName, setVoiceName] = useState('');
    const [voiceId, setVoiceId] = useState('');
    const [editingVoiceId, setEditingVoiceId] = useState<string | null>(null);

    const applyScript = (script: EpisodeScript) => {
        setTitle(script.title || '');
        setShowName(script.showName || '');
        setEpisodeNumber(script.episodeNumber ? String(script.episodeNumber) : '');
        setDescription(script.description || '');
        setScriptText(script.scriptText || '');
        setLines(script.lines || []);
        setSegments(script.productionSegments || []);
        setStatus(script.status || 'draft');
    };

    useEffect(() => {
        let cancelled = false;
        (async () => {
            try {
                const voiceRes = await apiClient.get<LibraryVoice[]>('/api/voices');
                if (!cancelled && Array.isArray(voiceRes.data)) setLibrary(voiceRes.data);
            } catch {
                /* Voice library is optional; a voice id can still be pasted. */
            }
            try {
                const collectionRes = await apiClient.get<VoiceCollection[]>('/api/voices/collections');
                if (!cancelled && Array.isArray(collectionRes.data)) setCollections(collectionRes.data);
            } catch {
                /* Collections appear after the backend that lists them is live. */
            }
            if (isNew) return;
            try {
                const res = await apiClient.get<EpisodeScript>(`/api/episode-scripts/${scriptId}`);
                if (!cancelled) applyScript(res.data);
            } catch (err) {
                if (!cancelled) setError(apiError(err, 'Could not load this script'));
            } finally {
                if (!cancelled) setLoading(false);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [isNew, scriptId]);

    useEffect(() => {
        if (!showName.trim()) {
            setVoices([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get<CharacterVoice[]>('/api/character-voices', {
                    params: { showName: showName.trim() },
                });
                if (!cancelled) setVoices(Array.isArray(res.data) ? res.data : []);
            } catch {
                if (!cancelled) setVoices([]);
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [showName]);

    useEffect(() => {
        if (!collectionId) {
            setCollectionVoices([]);
            return;
        }
        let cancelled = false;
        (async () => {
            try {
                const res = await apiClient.get<LibraryVoice[]>(
                    `/api/voices/collections/${encodeURIComponent(collectionId)}/voices`,
                );
                if (!cancelled) setCollectionVoices(Array.isArray(res.data) ? res.data : []);
            } catch (err) {
                if (!cancelled) {
                    setCollectionVoices([]);
                    setError(apiError(err, 'Could not load that ElevenLabs collection'));
                }
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [collectionId]);

    const payload = () => ({
        title: title.trim(),
        showName: showName.trim(),
        episodeNumber: episodeNumber ? Number(episodeNumber) : undefined,
        description,
        scriptText,
    });

    const save = async () => {
        if (!title.trim() || !showName.trim()) {
            setError('Title and show name are required.');
            return;
        }
        setBusy('save');
        setError('');
        setNotice('');
        try {
            if (isNew) {
                const res = await apiClient.post<EpisodeScript>('/api/episode-scripts', payload());
                navigate(`/audio-studio/${res.data._id}`, { replace: true });
                return;
            }
            const res = await apiClient.put<EpisodeScript>(`/api/episode-scripts/${scriptId}`, payload());
            applyScript(res.data);
            setNotice('Script saved.');
        } catch (err) {
            setError(apiError(err, 'Could not save the script'));
        } finally {
            setBusy('');
        }
    };

    const runAction = async (action: 'parse' | 'voices' | 'segments') => {
        if (isNew) {
            setError('Save the script first.');
            return;
        }
        setBusy(action);
        setError('');
        setNotice('');
        try {
            if (action === 'parse') {
                await apiClient.put(`/api/episode-scripts/${scriptId}`, payload());
                const res = await apiClient.post<EpisodeScript>(`/api/episode-scripts/${scriptId}/parse`);
                applyScript(res.data);
                setNotice(`Parsed ${res.data.lines?.length || 0} lines.`);
            } else if (action === 'voices') {
                const res = await apiClient.post<{ script: EpisodeScript; assignedCount: number }>(
                    `/api/episode-scripts/${scriptId}/auto-assign-voices`,
                );
                applyScript(res.data.script);
                setNotice(`Assigned voices on ${res.data.assignedCount} lines.`);
            } else {
                const res = await apiClient.post<{ script: EpisodeScript; segmentCount: number }>(
                    `/api/episode-scripts/${scriptId}/create-segments`,
                    { segmentDuration: 5 },
                );
                applyScript(res.data.script);
                setNotice(`Split into ${res.data.segmentCount} segments.`);
            }
        } catch (err) {
            setError(apiError(err, 'That step failed'));
        } finally {
            setBusy('');
        }
    };

    const addVoice = async () => {
        if (!showName.trim() || !voiceName.trim() || !voiceId.trim()) {
            setError('Show name, character name, and an ElevenLabs voice are required.');
            return;
        }
        setBusy('voice');
        setError('');
        try {
            if (editingVoiceId) {
                await apiClient.put(`/api/character-voices/${editingVoiceId}`, {
                    name: voiceName.trim(),
                    elevenLabsVoiceId: voiceId.trim(),
                });
            } else {
                await apiClient.post('/api/character-voices', {
                    name: voiceName.trim(),
                    showName: showName.trim(),
                    elevenLabsVoiceId: voiceId.trim(),
                });
            }
            const res = await apiClient.get<CharacterVoice[]>('/api/character-voices', {
                params: { showName: showName.trim() },
            });
            setVoices(Array.isArray(res.data) ? res.data : []);
            setVoiceName('');
            setVoiceId('');
            setEditingVoiceId(null);
            setNotice(editingVoiceId ? `Updated voice for ${voiceName.trim()}.` : `Saved voice for ${voiceName.trim()}.`);
        } catch (err) {
            setError(apiError(err, 'Could not save that character voice'));
        } finally {
            setBusy('');
        }
    };

    const dialogueCount = useMemo(() => lines.filter((line) => line.type === 'dialogue').length, [lines]);

    const pickerVoices = collectionId ? collectionVoices : library;
    const visibleVoices = useMemo(() => {
        const query = voiceSearch.trim().toLowerCase();
        const matched = query
            ? pickerVoices.filter((voice) =>
                (voice.customName || voice.name || '').toLowerCase().includes(query)
                || voice.voiceId.toLowerCase().includes(query),
            )
            : pickerVoices;
        if (voiceId && !matched.some((voice) => voice.voiceId === voiceId)) {
            const current = pickerVoices.find((voice) => voice.voiceId === voiceId)
                || library.find((voice) => voice.voiceId === voiceId);
            if (current) return [current, ...matched];
        }
        return matched;
    }, [pickerVoices, library, voiceSearch, voiceId]);

    const voiceLabel = (id: string) => {
        const match = [...collectionVoices, ...library].find((voice) => voice.voiceId === id);
        return match ? (match.customName || match.name) : id;
    };

    const startVoiceChange = (voice: CharacterVoice) => {
        setEditingVoiceId(voice._id);
        setVoiceName(voice.name);
        setVoiceId(voice.elevenLabsVoiceId);
        setError('');
        setNotice('');
    };

    if (loading) {
        return (
            <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600" />
            </div>
        );
    }

    return (
        <div>
            <Link to="/audio-studio" className="inline-flex items-center gap-1 text-sm text-indigo-600 mb-4">
                <ArrowLeft className="w-4 h-4" />
                All scripts
            </Link>
            <div className="flex flex-wrap items-start justify-between gap-4 mb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">{isNew ? 'New script' : title || 'Script'}</h1>
                    <p className="text-gray-600 mt-1">
                        Lines look like <span className="font-mono text-sm">MICK: Hello there.</span> Sound effects use{' '}
                        <span className="font-mono text-sm">[SFX: thunder]</span>.
                    </p>
                </div>
                <span className={`text-xs font-medium px-2 py-1 rounded-full ${statusClass(status)}`}>
                    {STATUS_LABEL[status] || status}
                </span>
            </div>

            {error ? <div className="bg-red-50 text-red-700 rounded-lg p-3 mb-4">{error}</div> : null}
            {notice ? <div className="bg-green-50 text-green-800 rounded-lg p-3 mb-4">{notice}</div> : null}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
                <div className="xl:col-span-2 bg-white rounded-lg shadow p-6 space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <label className="block text-sm md:col-span-2">
                            <span className="text-gray-600">Title</span>
                            <input
                                value={title}
                                onChange={(e) => setTitle(e.target.value)}
                                className="mt-1 w-full border rounded-lg px-3 py-2"
                                placeholder="The Empty Tomb"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Episode</span>
                            <input
                                value={episodeNumber}
                                onChange={(e) => setEpisodeNumber(e.target.value)}
                                className="mt-1 w-full border rounded-lg px-3 py-2"
                                inputMode="numeric"
                            />
                        </label>
                        <label className="block text-sm md:col-span-2">
                            <span className="text-gray-600">Show</span>
                            <input
                                value={showName}
                                onChange={(e) => setShowName(e.target.value)}
                                className="mt-1 w-full border rounded-lg px-3 py-2"
                                placeholder="Mick in Heaven"
                            />
                        </label>
                        <label className="block text-sm">
                            <span className="text-gray-600">Description</span>
                            <input
                                value={description}
                                onChange={(e) => setDescription(e.target.value)}
                                className="mt-1 w-full border rounded-lg px-3 py-2"
                            />
                        </label>
                    </div>
                    <label className="block text-sm">
                        <span className="text-gray-600">Script</span>
                        <textarea
                            value={scriptText}
                            onChange={(e) => setScriptText(e.target.value)}
                            rows={16}
                            className="mt-1 w-full border rounded-lg px-3 py-2 font-mono text-sm"
                        />
                    </label>
                    <div className="flex flex-wrap gap-2">
                        <button
                            type="button"
                            onClick={save}
                            disabled={!!busy}
                            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
                        >
                            {busy === 'save' ? 'Saving…' : 'Save'}
                        </button>
                        <button
                            type="button"
                            onClick={() => runAction('parse')}
                            disabled={!!busy || isNew}
                            className="border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                        >
                            {busy === 'parse' ? 'Parsing…' : 'Parse lines'}
                        </button>
                        <button
                            type="button"
                            onClick={() => runAction('voices')}
                            disabled={!!busy || isNew}
                            className="border border-indigo-200 text-indigo-700 px-4 py-2 rounded-lg hover:bg-indigo-50 disabled:opacity-50"
                        >
                            {busy === 'voices' ? 'Assigning…' : 'Assign voices'}
                        </button>
                        <button
                            type="button"
                            onClick={() => runAction('segments')}
                            disabled={!!busy || isNew}
                            className="border border-gray-300 text-gray-700 px-4 py-2 rounded-lg hover:bg-gray-50 disabled:opacity-50"
                        >
                            {busy === 'segments' ? 'Splitting…' : 'Make 5-minute segments'}
                        </button>
                    </div>
                </div>

                <div className="bg-white rounded-lg shadow p-6">
                    <h2 className="font-semibold text-gray-800 mb-1">Character voices</h2>
                    <p className="text-sm text-gray-500 mb-4">
                        Names must match the script, like Mick or Gabriel. They are saved for this show.
                    </p>
                    {voices.length === 0 ? (
                        <p className="text-sm text-gray-500 mb-4">No voices for this show yet.</p>
                    ) : (
                        <ul className="space-y-2 mb-4">
                            {voices.map((voice) => (
                                <li key={voice._id} className="text-sm border rounded-lg px-3 py-2 flex items-start justify-between gap-2">
                                    <div className="min-w-0">
                                        <div className="font-medium text-gray-900">{voice.name}</div>
                                        <div className="text-xs text-gray-500 truncate">{voiceLabel(voice.elevenLabsVoiceId)}</div>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => startVoiceChange(voice)}
                                        className="text-xs text-indigo-700 hover:underline flex-shrink-0"
                                    >
                                        Change
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                    <div className="space-y-2">
                        {editingVoiceId ? (
                            <div className="flex items-center justify-between text-sm">
                                <span className="font-medium text-indigo-800">Change {voiceName}&apos;s voice</span>
                                <button
                                    type="button"
                                    className="text-xs text-gray-500 hover:underline"
                                    onClick={() => {
                                        setEditingVoiceId(null);
                                        setVoiceName('');
                                        setVoiceId('');
                                    }}
                                >
                                    Cancel
                                </button>
                            </div>
                        ) : null}
                        <input
                            value={voiceName}
                            onChange={(e) => setVoiceName(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="Character name"
                            disabled={!!editingVoiceId}
                        />
                        <select
                            value={collectionId}
                            onChange={(e) => {
                                setCollectionId(e.target.value);
                                setVoiceSearch('');
                            }}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">App voice library</option>
                            {collections.map((collection) => (
                                <option key={collection.id} value={collection.id}>
                                    {collection.title}
                                </option>
                            ))}
                        </select>
                        <input
                            value={voiceSearch}
                            onChange={(e) => setVoiceSearch(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                            placeholder="Search voices"
                        />
                        <select
                            value={voiceId}
                            onChange={(e) => setVoiceId(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm"
                        >
                            <option value="">Choose an ElevenLabs voice</option>
                            {visibleVoices.map((voice) => (
                                <option key={voice.voiceId} value={voice.voiceId}>
                                    {voice.customName || voice.name}
                                </option>
                            ))}
                        </select>
                        <input
                            value={voiceId}
                            onChange={(e) => setVoiceId(e.target.value)}
                            className="w-full border rounded-lg px-3 py-2 text-sm font-mono"
                            placeholder="Or paste an ElevenLabs voice ID"
                        />
                        <button
                            type="button"
                            onClick={addVoice}
                            disabled={!!busy}
                            className="w-full border border-indigo-200 text-indigo-700 px-3 py-2 rounded-lg text-sm hover:bg-indigo-50 disabled:opacity-50"
                        >
                            {busy === 'voice' ? 'Saving…' : editingVoiceId ? 'Update character voice' : 'Save character voice'}
                        </button>
                    </div>
                </div>
            </div>

            <div className="mt-6 bg-white rounded-lg shadow overflow-hidden">
                <div className="px-6 py-4 border-b">
                    <h2 className="font-semibold text-gray-800">
                        Parsed lines <span className="text-gray-500 font-normal">({lines.length}, {dialogueCount} dialogue)</span>
                    </h2>
                </div>
                {lines.length === 0 ? (
                    <p className="px-6 py-8 text-sm text-gray-500">Save the script, then parse it to see each line.</p>
                ) : (
                    <ul className="divide-y divide-gray-100 max-h-[28rem] overflow-y-auto">
                        {lines.map((line, index) => (
                            <li key={`${line.type}-${index}`} className="px-6 py-3 text-sm flex gap-3">
                                <span className="text-xs text-gray-400 w-6 pt-0.5">{index + 1}</span>
                                {line.type === 'dialogue' ? (
                                    <div>
                                        <span className="font-semibold text-indigo-700">{line.characterName}</span>
                                        {line.emotion ? <span className="text-gray-400"> [{line.emotion}]</span> : null}
                                        <span className="text-gray-800"> {line.dialogue}</span>
                                        {line.voiceId ? (
                                            <div className="text-xs text-gray-400">Voice {line.voiceId}</div>
                                        ) : (
                                            <div className="text-xs text-amber-600">No voice yet</div>
                                        )}
                                    </div>
                                ) : line.type === 'sound-effect' ? (
                                    <div className="text-amber-800">SFX: {line.soundEffect}</div>
                                ) : (
                                    <div className="text-gray-500 italic">{line.dialogue}</div>
                                )}
                            </li>
                        ))}
                    </ul>
                )}
            </div>

            {segments.length > 0 && (
                <div className="mt-6 bg-white rounded-lg shadow p-6">
                    <h2 className="font-semibold text-gray-800 mb-3">Production segments</h2>
                    <ul className="space-y-2">
                        {segments.map((segment) => (
                            <li key={`${segment.name}-${segment.startLineIndex}`} className="text-sm flex justify-between border rounded-lg px-3 py-2">
                                <span>{segment.name}</span>
                                <span className="text-gray-500">
                                    Lines {segment.startLineIndex + 1}–{segment.endLineIndex + 1} · {segment.status || 'pending'}
                                </span>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default AudioStudio;
