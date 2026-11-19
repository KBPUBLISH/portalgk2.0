import { useEffect, useRef, useState } from 'react';
import { Camera, ExternalLink, RefreshCw, RotateCw, TreePalm, X, ZoomIn, ZoomOut } from 'lucide-react';
import apiClient from '../services/apiClient';

interface IslandBackup {
  _id: string; account: string; profileId: string; profileName: string; updatedAt: string;
  summary?: { builtCount?: number; buildings?: string[]; harvestCount?: number };
  entries?: { name: string; value: string }[];
}
const APP_ORIGIN = (import.meta.env.VITE_ISLAND_VIEWER_ORIGIN || 'https://app.godlykids.com').replace(/\/$/, '');
const time = (value: string) => new Date(value).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
const sameAccount = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

export default function FamilyIslandViewer({ account, parentName, onClose }: { account: string; parentName: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [worlds, setWorlds] = useState<IslandBackup[]>([]);
  const [selected, setSelected] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.showModal();
    return () => { previous?.focus(); };
  }, []);
  useEffect(() => {
    const controller = new AbortController();
    setLoading(true); setError(''); setWorlds([]); setSelected('');
    async function read() {
      const found: IslandBackup[] = [];
      let page = 1, pages = 1;
      do {
        const { data } = await apiClient.get('/api/island-saves/admin', { params: { search: account, page }, signal: controller.signal });
        if (!data.success || !Array.isArray(data.worlds)) throw Error('The island backup service did not return a valid response.');
        found.push(...data.worlds.filter((w: IslandBackup) => typeof w.account === 'string' && sameAccount(w.account, account)));
        pages = Number(data.pages) || 0;
        if (pages > 20) throw Error('Too many results to show. Please try again with the exact family account.');
        page++;
      } while (page <= pages);
      if (!controller.signal.aborted) { setWorlds(found); setSelected(found[0]?._id || ''); }
    }
    void read().catch(err => {
      if (!controller.signal.aborted) setError(err?.response?.status === 401 || err?.response?.status === 403
        ? 'An administrator sign-in is required to view saved islands.'
        : 'Could not check this family’s saved islands. Please retry; this does not mean their progress is missing.');
    }).finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [account, attempt]);
  const world = worlds.find(w => w._id === selected);
  return <dialog ref={dialog} aria-labelledby="island-viewer-title" onCancel={onClose} className="w-[min(1200px,96vw)] max-h-[94vh] rounded-2xl border-0 p-0 shadow-2xl backdrop:bg-slate-950/60">
    <div className="p-5 border-b flex items-start justify-between gap-4">
      <div><h2 id="island-viewer-title" className="text-xl font-bold text-gray-900 flex items-center gap-2"><TreePalm className="w-6 h-6 text-emerald-600" />{parentName || 'Family'}’s saved islands</h2>
        <p className="text-sm text-gray-600 mt-1">View each child’s latest synced island. Looking around and taking screenshots won’t change their progress.</p></div>
      <button autoFocus type="button" aria-label="Close island viewer" className="p-2 rounded-lg hover:bg-gray-100" onClick={onClose}><X /></button>
    </div>
    <div className="p-5">
      {loading && <p role="status" className="py-12 text-center text-gray-600">Checking saved islands…</p>}
      {error && <div role="alert" className="rounded-lg bg-red-50 p-5 text-red-800">{error}<button className="ml-3 underline" onClick={() => setAttempt(n => n + 1)}>Retry</button></div>}
      {!loading && !error && !worlds.length && <div className="rounded-xl bg-sky-50 p-7 text-sky-950"><h3 className="font-semibold">No saved island found for this family yet</h3><p className="mt-2">Their activity history is available, but there is no island backup linked to this email. Have the family open their island while signed in and connected, then check again.</p><button className="mt-4 underline" onClick={() => setAttempt(n => n + 1)}>Check again</button></div>}
      {!loading && !error && world && <>
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <label className="text-sm font-medium text-gray-700">Child’s island<select aria-label="Child’s island" value={selected} onChange={e => setSelected(e.target.value)} className="ml-3 border rounded-lg px-3 py-2 bg-white">{worlds.map((w, i) => <option key={w._id} value={w._id}>{w.profileName || `Child ${i + 1}`}</option>)}</select></label>
          <button className="text-sm text-indigo-700 inline-flex gap-2 items-center" onClick={() => setAttempt(n => n + 1)}><RefreshCw size={16} />Check for newer saves</button>
        </div>
        <IslandPreview key={world._id} summary={world} account={account} />
      </>}
    </div>
  </dialog>;
}

function IslandPreview({ summary, account }: { summary: IslandBackup; account: string }) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [channel] = useState(() => crypto.randomUUID());
  const [world, setWorld] = useState<IslandBackup | null>(null);
  const [ready, setReady] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState('');
  const [captureError, setCaptureError] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [shot, setShot] = useState('');
  const [attempt, setAttempt] = useState(0);
  const captureTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const src = `${APP_ORIGIN}/homeworld/viewer.html?parentOrigin=${encodeURIComponent(location.origin)}&channel=${channel}&attempt=${attempt}`;
  const send = (action: string) => frame.current?.contentWindow?.postMessage({ type: `gk-island-viewer-${action}`, channel }, APP_ORIGIN);
  useEffect(() => {
    const controller = new AbortController();
    if (captureTimer.current) clearTimeout(captureTimer.current);
    setWorld(null); setError(''); setReady(false); setLoaded(false); setShot(''); setCapturing(false); setCaptureError('');
    void apiClient.get(`/api/island-saves/admin/${encodeURIComponent(summary._id)}`, { signal: controller.signal }).then(({ data }) => {
      if (!data.success || !Array.isArray(data.world?.entries) || !sameAccount(data.world.account || '', account)) throw Error('The backup does not belong to this family.');
      if (!controller.signal.aborted) setWorld(data.world);
    }).catch(() => { if (!controller.signal.aborted) setError('This saved island could not be opened. Please retry.'); });
    return () => controller.abort();
  }, [summary._id, account, attempt]);
  useEffect(() => {
    const receive = (event: MessageEvent) => {
      if (event.origin !== APP_ORIGIN || event.source !== frame.current?.contentWindow || event.data?.channel !== channel) return;
      if (event.data.type === 'gk-island-viewer-ready') setReady(true);
      if (event.data.type === 'gk-island-viewer-loaded') setLoaded(true);
      if (event.data.type === 'gk-island-viewer-error') setError(String(event.data.message || 'The island could not load.'));
      if (event.data.type === 'gk-island-viewer-capture-error') { if (captureTimer.current) clearTimeout(captureTimer.current); setCapturing(false); setCaptureError(String(event.data.message)); }
      if (event.data.type === 'gk-island-viewer-screenshot' && typeof event.data.image === 'string'
        && /^data:image\/png;base64,[A-Za-z0-9+/=]+$/.test(event.data.image) && event.data.image.length < 16 * 1024 * 1024) {
        if (captureTimer.current) clearTimeout(captureTimer.current);
        setShot(event.data.image); setCapturing(false);
      }
    };
    window.addEventListener('message', receive);
    return () => { window.removeEventListener('message', receive); if (captureTimer.current) clearTimeout(captureTimer.current); };
  }, [channel]);
  useEffect(() => {
    if (!ready || !world) return;
    frame.current?.contentWindow?.postMessage({ type: 'gk-island-viewer-load', channel, entries: world.entries }, APP_ORIGIN);
  }, [ready, world, channel]);
  useEffect(() => {
    if (loaded || error) return;
    const timer = setTimeout(() => setError('The island is taking too long to open. Please retry.'), 90000);
    return () => clearTimeout(timer);
  }, [loaded, error, attempt]);
  const saved = world || summary;
  return <>
    <div className="flex flex-wrap gap-x-5 gap-y-2 text-sm text-gray-600 mb-3">
      <span className="font-semibold text-emerald-700">Saved copy · Read only</span><span>Last synced: <strong>{time(saved.updatedAt)}</strong></span>
      <span>{saved.summary?.builtCount ?? 0} completed structures</span>
    </div>
    <p className="text-xs text-gray-500 mb-3">Recreated from the last backup using the current island artwork. This is not a live view of their device.</p>
    <div className="relative overflow-hidden rounded-xl border bg-sky-50">
      <iframe key={attempt} ref={frame} src={src} title={`${summary.profileName || 'Child'}’s saved island`} referrerPolicy="no-referrer" sandbox="allow-scripts allow-same-origin" className="block w-full h-[min(58vh,680px)] min-h-[280px] border-0" />
      {!loaded && !error && <div role="status" className="absolute inset-0 grid place-content-center bg-sky-50 text-slate-700">Opening the saved island…</div>}
      {error && <div role="alert" className="absolute inset-0 grid place-content-center bg-red-50 p-6 text-center text-red-900"><p>{error}</p><button className="underline mt-4" onClick={() => setAttempt(n => n + 1)}>Retry island</button></div>}
    </div>
    <div className="mt-3 flex flex-wrap items-center gap-2">
      <button disabled={!loaded || !!error} title="Zoom in" aria-label="Zoom in" className="p-2 border rounded-lg disabled:opacity-40" onClick={() => send('zoom-in')}><ZoomIn size={20} /></button>
      <button disabled={!loaded || !!error} title="Zoom out" aria-label="Zoom out" className="p-2 border rounded-lg disabled:opacity-40" onClick={() => send('zoom-out')}><ZoomOut size={20} /></button>
      <button disabled={!loaded || !!error} className="px-3 py-2 border rounded-lg flex gap-2 items-center disabled:opacity-40" onClick={() => send('rotate')}><RotateCw size={18} />Rotate</button>
      <button disabled={!loaded || !!error} className="px-3 py-2 border rounded-lg disabled:opacity-40" onClick={() => send('reset')}>Whole island</button>
      <button disabled={!loaded || !!error || capturing} className="px-3 py-2 bg-indigo-600 text-white rounded-lg flex gap-2 items-center disabled:opacity-40" onClick={() => {
        setCapturing(true); setCaptureError(''); send('capture');
        captureTimer.current = setTimeout(() => { setCapturing(false); setCaptureError('The screenshot did not arrive. Please try again.'); }, 15000);
      }}><Camera size={18} />{capturing ? 'Capturing…' : 'Take screenshot'}</button>
      <span className="text-xs text-gray-500">Drag the island to look around. Scroll to zoom.</span>
    </div>
    {captureError && <p role="alert" className="mt-3 text-sm text-red-700">{captureError}</p>}
    {shot && <div className="mt-5 rounded-xl border p-3"><div className="flex justify-between items-center mb-3"><strong className="text-sm">Screenshot of the saved island</strong><a className="text-indigo-700 inline-flex gap-2 items-center underline text-sm" href={shot} download={`saved-island-${summary.profileName?.replace(/[^a-zA-Z0-9_-]/g, '') || 'child'}.png`}><ExternalLink size={16} />Download screenshot</a></div><img src={shot} alt={`${summary.profileName || 'Child'}’s saved island screenshot`} className="w-full rounded-lg" /></div>}
  </>;
}
