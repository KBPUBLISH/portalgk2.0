import React, { useEffect, useRef, useState } from 'react';
import { Gift, Plus, Upload, X, Pencil, Trash2, PackageCheck } from 'lucide-react';
import apiClient from '../services/apiClient';

interface BookOffer {
    _id?: string;
    title: string;
    description: string;
    value: string;
    coverImage: string;
    images: string[];
    active: boolean;
}

interface Shipping {
    fullName?: string;
    line1?: string;
    line2?: string;
    city?: string;
    region?: string;
    postalCode?: string;
    country?: string;
    phone?: string;
}

interface OfferClaim {
    _id: string;
    email: string;
    kidName?: string;
    challengeStartedAt?: string;
    challengeCompletedAt?: string;
    storyPacksCompleted?: number;
    bookTitle?: string;
    shipping?: Shipping;
    fulfillmentStatus: 'pending' | 'shipped';
    readyToFulfill?: boolean;
    shippedAt?: string;
}

const emptyOffer = (): BookOffer => ({
    title: '',
    description: '',
    value: '',
    coverImage: '',
    images: [],
    active: true,
});

const formatAddress = (shipping?: Shipping) => {
    if (!shipping) return '';
    return [
        shipping.fullName,
        shipping.line1,
        shipping.line2,
        [shipping.city, shipping.region, shipping.postalCode].filter(Boolean).join(', '),
        shipping.country,
        shipping.phone,
    ]
        .filter((part) => String(part || '').trim())
        .join('\n');
};

const formatDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '—';
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

const OfferClaims: React.FC = () => {
    const [offers, setOffers] = useState<BookOffer[]>([]);
    const [claims, setClaims] = useState<OfferClaim[]>([]);
    const [status, setStatus] = useState<'pending' | 'shipped' | 'all' | 'collected'>('pending');
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState<string | null>(null);
    const [editorOpen, setEditorOpen] = useState(false);
    const [draft, setDraft] = useState<BookOffer>(emptyOffer());
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState<'cover' | 'gallery' | null>(null);
    const coverInputRef = useRef<HTMLInputElement>(null);
    const galleryInputRef = useRef<HTMLInputElement>(null);

    const load = async (nextStatus = status) => {
        setLoading(true);
        setLoadError(null);
        try {
            const [offerRes, claimRes] = await Promise.all([
                apiClient.get('/api/book-offers/manage'),
                apiClient.get(`/api/offer-claims?status=${nextStatus}`),
            ]);
            setOffers(offerRes.data?.data || []);
            setClaims(claimRes.data?.data || []);
        } catch (error) {
            console.error('Failed to load offer claims', error);
            setOffers([]);
            setClaims([]);
            setLoadError('The offer claims API is not available yet. Restart or deploy the backend, then refresh.');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        load('pending');
        // Initial load only.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const uploadImage = async (file: File) => {
        const body = new FormData();
        body.append('file', file);
        const response = await apiClient.post('/api/upload/image?bookId=book-offers&type=cover', body, {
            headers: { 'Content-Type': 'multipart/form-data' },
        });
        return response.data.url as string;
    };

    const onCover = async (file?: File) => {
        if (!file) return;
        setUploading('cover');
        try {
            const url = await uploadImage(file);
            setDraft((current) => ({ ...current, coverImage: url }));
        } catch (error) {
            console.error(error);
            alert('Failed to upload the cover image');
        } finally {
            setUploading(null);
        }
    };

    const onGallery = async (file?: File) => {
        if (!file) return;
        if (draft.images.length >= 3) {
            alert('A book offer can have up to 3 extra images');
            return;
        }
        setUploading('gallery');
        try {
            const url = await uploadImage(file);
            setDraft((current) => ({ ...current, images: [...current.images, url].slice(0, 3) }));
        } catch (error) {
            console.error(error);
            alert('Failed to upload the image');
        } finally {
            setUploading(null);
        }
    };

    const saveOffer = async () => {
        if (!draft.title.trim() || !draft.coverImage || !draft.description.trim() || !draft.value.trim()) {
            alert('Title, cover, description, and value are required');
            return;
        }
        setSaving(true);
        try {
            if (draft._id) {
                await apiClient.put(`/api/book-offers/${draft._id}`, draft);
            } else {
                await apiClient.post('/api/book-offers', draft);
            }
            setEditorOpen(false);
            setDraft(emptyOffer());
            await load();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to save the book offer');
        } finally {
            setSaving(false);
        }
    };

    const removeOffer = async (offer: BookOffer) => {
        if (!offer._id) return;
        if (!window.confirm(`Remove “${offer.title}” from the challenge?`)) return;
        try {
            await apiClient.delete(`/api/book-offers/${offer._id}`);
            await load();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to remove the book offer');
        }
    };

    const markShipped = async (claim: OfferClaim) => {
        try {
            await apiClient.patch(`/api/offer-claims/${claim._id}/shipped`);
            await load();
        } catch (error: any) {
            alert(error.response?.data?.message || 'Failed to mark this claim shipped');
        }
    };

    return (
        <div className="space-y-8">
            <div className="flex items-start justify-between gap-4 flex-wrap">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                        <Gift className="w-7 h-7 text-indigo-600" />
                        Offer Claims
                    </h1>
                    <p className="text-gray-600 mt-1 max-w-2xl">
                        After onboarding, families can start a 7-day challenge: finish 7 story packs in 7 days and receive a free book.
                        A claim is ready to ship once the trial has become an active yearly membership, a physical book is selected, and shipping is saved.
                        Addresses entered during onboarding show under Shipping collected until then.
                    </p>
                </div>
                <button
                    type="button"
                    onClick={() => {
                        setDraft(emptyOffer());
                        setEditorOpen(true);
                    }}
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-indigo-600 text-white font-semibold hover:bg-indigo-700"
                >
                    <Plus className="w-4 h-4" />
                    Book Offer
                </button>
            </div>

            <section>
                <h2 className="text-lg font-semibold text-gray-900 mb-3">Books in the offer</h2>
                {loadError ? null : offers.length === 0 ? (
                    <div className="bg-white border border-dashed border-gray-300 rounded-xl p-6 text-gray-500">
                        No book yet. Use Book Offer to add the cover, up to 3 photos, a description, and a value.
                    </div>
                ) : (
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                        {offers.map((offer) => (
                            <article key={offer._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
                                {offer.coverImage && (
                                    <img src={offer.coverImage} alt="" className="w-full h-40 object-cover bg-gray-100" />
                                )}
                                <div className="p-4 space-y-2">
                                    <div className="flex items-start justify-between gap-2">
                                        <h3 className="font-semibold text-gray-900">{offer.title}</h3>
                                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${offer.active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                            {offer.active ? 'Active' : 'Hidden'}
                                        </span>
                                    </div>
                                    <p className="text-sm text-indigo-700 font-medium">{offer.value}</p>
                                    <p className="text-sm text-gray-600 line-clamp-3">{offer.description}</p>
                                    {offer.images.length > 0 && (
                                        <div className="flex gap-2">
                                            {offer.images.map((url) => (
                                                <img key={url} src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                                            ))}
                                        </div>
                                    )}
                                    <div className="flex gap-2 pt-1">
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setDraft({ ...offer, images: offer.images || [] });
                                                setEditorOpen(true);
                                            }}
                                            className="inline-flex items-center gap-1 text-sm text-indigo-600 font-medium"
                                        >
                                            <Pencil className="w-3.5 h-3.5" /> Edit
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => removeOffer(offer)}
                                            className="inline-flex items-center gap-1 text-sm text-red-600 font-medium"
                                        >
                                            <Trash2 className="w-3.5 h-3.5" /> Remove
                                        </button>
                                    </div>
                                </div>
                            </article>
                        ))}
                    </div>
                )}
            </section>

            <section className="bg-white rounded-xl border border-gray-200 shadow-sm">
                <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-3 flex-wrap">
                    <h2 className="text-lg font-semibold text-gray-900">
                        {status === 'collected' ? 'Shipping collected' : 'Ready to ship'}
                    </h2>
                    <select
                        value={status}
                        onChange={(event) => {
                            const next = event.target.value as 'pending' | 'shipped' | 'all' | 'collected';
                            setStatus(next);
                            load(next);
                        }}
                        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm"
                    >
                        <option value="pending">Waiting to ship</option>
                        <option value="collected">Shipping collected</option>
                        <option value="shipped">Shipped</option>
                        <option value="all">All ready claims</option>
                    </select>
                </div>
                {loading ? (
                    <p className="p-6 text-gray-500">Loading claims…</p>
                ) : loadError ? (
                    <p className="p-6 text-red-600">{loadError}</p>
                ) : claims.length === 0 ? (
                    <p className="p-6 text-gray-500">
                        No claims yet. Shipping addresses from the free-book step show under Shipping collected. Ready-to-ship families appear after they finish 7 story packs in 7 days and convert to a yearly membership.
                    </p>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="min-w-full text-sm">
                            <thead className="bg-gray-50 text-left text-gray-500">
                                <tr>
                                    <th className="px-4 py-3 font-medium">Family</th>
                                    <th className="px-4 py-3 font-medium">Challenge</th>
                                    <th className="px-4 py-3 font-medium">Membership</th>
                                    <th className="px-4 py-3 font-medium">Book</th>
                                    <th className="px-4 py-3 font-medium">Shipping</th>
                                    <th className="px-4 py-3 font-medium"></th>
                                </tr>
                            </thead>
                            <tbody>
                                {claims.map((claim) => (
                                    <tr key={claim._id} className="border-t border-gray-100 align-top">
                                        <td className="px-4 py-3">
                                            <div className="font-medium text-gray-900">{claim.email}</div>
                                            {claim.kidName && <div className="text-gray-500">{claim.kidName}</div>}
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {claim.storyPacksCompleted || 0} packs
                                            <div className="text-gray-500">{formatDate(claim.challengeCompletedAt)}</div>
                                        </td>
                                        <td className="px-4 py-3 text-gray-700">
                                            {claim.readyToFulfill === false ? 'Not yet' : 'Active yearly'}
                                        </td>
                                        <td className="px-4 py-3 text-gray-900">{claim.bookTitle || '—'}</td>
                                        <td className="px-4 py-3 text-gray-700 whitespace-pre-line">{formatAddress(claim.shipping)}</td>
                                        <td className="px-4 py-3">
                                            {claim.fulfillmentStatus === 'shipped' ? (
                                                <span className="text-green-700 font-medium">Shipped {formatDate(claim.shippedAt)}</span>
                                            ) : claim.readyToFulfill === false ? (
                                                <span className="text-gray-500">Waiting on challenge</span>
                                            ) : (
                                                <button
                                                    type="button"
                                                    onClick={() => markShipped(claim)}
                                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-gray-900 text-white text-xs font-semibold"
                                                >
                                                    <PackageCheck className="w-3.5 h-3.5" />
                                                    Mark shipped
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {editorOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
                    <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
                        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
                            <h2 className="text-lg font-semibold text-gray-900">{draft._id ? 'Edit book offer' : 'New book offer'}</h2>
                            <button type="button" onClick={() => setEditorOpen(false)} className="text-gray-400 hover:text-gray-700">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-5 space-y-4">
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">Title</span>
                                <input
                                    value={draft.title}
                                    onChange={(event) => setDraft({ ...draft, title: event.target.value })}
                                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">Value</span>
                                <input
                                    value={draft.value}
                                    onChange={(event) => setDraft({ ...draft, value: event.target.value })}
                                    placeholder="$24.99"
                                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </label>
                            <label className="block">
                                <span className="text-sm font-medium text-gray-700">Description</span>
                                <textarea
                                    value={draft.description}
                                    onChange={(event) => setDraft({ ...draft, description: event.target.value })}
                                    rows={4}
                                    className="mt-1 w-full border border-gray-300 rounded-lg px-3 py-2"
                                />
                            </label>
                            <div>
                                <span className="text-sm font-medium text-gray-700">Cover image</span>
                                <input
                                    ref={coverInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        onCover(event.target.files?.[0]);
                                        event.target.value = '';
                                    }}
                                />
                                <button
                                    type="button"
                                    onClick={() => coverInputRef.current?.click()}
                                    className="mt-1 w-full border border-dashed border-gray-300 rounded-lg p-3 flex items-center gap-3 text-left"
                                >
                                    {draft.coverImage ? (
                                        <img src={draft.coverImage} alt="" className="w-16 h-16 object-cover rounded" />
                                    ) : (
                                        <Upload className={`w-5 h-5 ${uploading === 'cover' ? 'text-indigo-500' : 'text-gray-400'}`} />
                                    )}
                                    <span className="text-sm text-gray-600">{uploading === 'cover' ? 'Uploading…' : 'Upload cover'}</span>
                                </button>
                            </div>
                            <div>
                                <span className="text-sm font-medium text-gray-700">Extra images ({draft.images.length}/3)</span>
                                <input
                                    ref={galleryInputRef}
                                    type="file"
                                    accept="image/*"
                                    className="hidden"
                                    onChange={(event) => {
                                        onGallery(event.target.files?.[0]);
                                        event.target.value = '';
                                    }}
                                />
                                <div className="mt-1 flex flex-wrap gap-2">
                                    {draft.images.map((url) => (
                                        <div key={url} className="relative">
                                            <img src={url} alt="" className="w-16 h-16 object-cover rounded border border-gray-200" />
                                            <button
                                                type="button"
                                                onClick={() => setDraft({ ...draft, images: draft.images.filter((item) => item !== url) })}
                                                className="absolute -top-1 -right-1 bg-white border border-gray-200 rounded-full p-0.5"
                                            >
                                                <X className="w-3 h-3" />
                                            </button>
                                        </div>
                                    ))}
                                    {draft.images.length < 3 && (
                                        <button
                                            type="button"
                                            onClick={() => galleryInputRef.current?.click()}
                                            className="w-16 h-16 rounded border border-dashed border-gray-300 flex items-center justify-center text-gray-400"
                                        >
                                            <Plus className="w-4 h-4" />
                                        </button>
                                    )}
                                </div>
                            </div>
                            <label className="flex items-center gap-2 text-sm text-gray-700">
                                <input
                                    type="checkbox"
                                    checked={draft.active}
                                    onChange={(event) => setDraft({ ...draft, active: event.target.checked })}
                                />
                                Show this book in the challenge
                            </label>
                        </div>
                        <div className="px-5 py-4 border-t border-gray-100 flex justify-end gap-2">
                            <button type="button" onClick={() => setEditorOpen(false)} className="px-4 py-2 text-sm text-gray-600">
                                Cancel
                            </button>
                            <button
                                type="button"
                                onClick={saveOffer}
                                disabled={saving || uploading !== null}
                                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50"
                            >
                                {saving ? 'Saving…' : 'Save book'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default OfferClaims;
