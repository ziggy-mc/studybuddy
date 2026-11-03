'use client';

import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BookOpen, Cloud, Copy, Download, FilePlus2, Folder, MoreHorizontal, Plus, Search, Star, Trash2, UploadCloud, GraduationCap, Clock3, Layers3, LogIn, ArrowUpRight } from 'lucide-react';
import { createEmptySet, deleteSet, getAllSets, saveSet } from '@/lib/storage';
import { exportCsv, exportJson } from '@/lib/export';
import { notifyCloudUpdated } from '@/lib/client-events';

function friendlyDate(value) {
  if (!value) return 'Not studied yet';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Not studied yet';
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(date);
}

export default function Dashboard() {
  const router = useRouter();
  const [localSets, setLocalSets] = useState([]);
  const [cloudSets, setCloudSets] = useState([]);
  const [account, setAccount] = useState(null);
  const [cloudCount, setCloudCount] = useState(0);
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('updated');
  const [filter, setFilter] = useState('all');
  const [busy, setBusy] = useState(true);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const refresh = useCallback(async () => {
    setBusy(true);
    try {
      const stored = await getAllSets();
      // Remove local mirrors created by previous versions. Cloud sets now live only in SQLite.
      const oldCloudMirrors = stored.filter((item) => item.cloudId || item.source === 'cloud');
      await Promise.all(oldCloudMirrors.map((item) => deleteSet(item.id)));
      const local = stored.filter((item) => !item.cloudId && item.source !== 'cloud');
      setLocalSets(local);
      const meResponse = await fetch('/api/auth/me', { cache: 'no-store' });
      const me = await meResponse.json();
      setAccount(me.user || null);
      setCloudCount(me.cloudCount || 0);
      if (me.user) {
        const cloudResponse = await fetch('/api/cloud/sets', { cache: 'no-store' });
        const cloudData = await cloudResponse.json();
        if (cloudResponse.ok) setCloudSets(cloudData.sets || []);
        else setError(cloudData.error || 'Could not load cloud sets.');
      } else {
        setCloudSets([]);
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load your study sets.');
    } finally {
      setBusy(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function newSet() {
    router.push(`/import`);
  }

  async function removeLocal(set) {
    if (!window.confirm(`Permanently delete “${set.title}” from this browser? This cannot be undone.`)) return;
    await deleteSet(set.id);
    setLocalSets((items) => items.filter((item) => item.id !== set.id));
  }

  async function duplicateLocal(set) {
    const now = new Date().toISOString();
    const copy = {
      ...set,
      id: crypto.randomUUID(),
      title: `${set.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      lastStudiedAt: null,
      cards: set.cards.map((card, index) => ({ ...card, id: crypto.randomUUID(), order: index })),
      progress: { known: [], review: [], attempts: 0, correct: 0 },
      source: 'local',
      cloudId: undefined,
    };
    await saveSet(copy);
    setLocalSets((items) => [copy, ...items]);
  }

  async function saveCloud(set) {
    setError('');
    try {
      const completeCards = (set.cards || []).filter((card) => card.term?.trim() && card.definition?.trim());
      if (!completeCards.length) throw new Error('Add at least one complete card before moving this set to the cloud.');
      if (completeCards.length !== (set.cards || []).length) throw new Error('Finish or delete incomplete cards before moving this set to the cloud. Nothing has been moved yet.');
      const response = await fetch('/api/cloud/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...set, cards: completeCards }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not move this set to cloud storage.');
      await deleteSet(set.id);
      setLocalSets((items) => items.filter((item) => item.id !== set.id));
      setCloudCount(data.count ?? cloudCount + 1);
      setNotice('Study set moved to Discord cloud storage and removed from this device.');
      notifyCloudUpdated();
      await refresh();
    } catch (saveError) {
      setError(saveError.message);
    }
  }

  function openCloud(set) {
    // The cloud record is fetched directly using the current Discord session.
    router.push(`/sets/${set.id}`);
  }

  async function deleteCloud(set) {
    if (!window.confirm(`Permanently delete “${set.title}” from your Discord cloud storage?`)) return;
    const response = await fetch(`/api/cloud/sets/${set.id}`, { method: 'DELETE' });
    const data = await response.json();
    if (!response.ok) return setError(data.error || 'Could not delete cloud set.');
    setCloudSets((items) => items.filter((item) => item.id !== set.id));
    setCloudCount((count) => Math.max(0, count - 1));
    notifyCloudUpdated();
  }

  const categories = useMemo(() => [...new Set(localSets.map((set) => set.category || 'Uncategorized'))].sort((a, b) => a.localeCompare(b)), [localSets]);

  const visibleSets = useMemo(() => {
    let items = localSets.filter((set) => {
      const matches = `${set.title} ${set.description} ${set.category || ''} ${(set.tags || []).join(' ')}`.toLowerCase().includes(query.toLowerCase());
      const categoryMatches = filter === 'all' || (filter === 'starred' && set.cards.some((card) => card.starred)) || (filter.startsWith('category:') && (set.category || 'Uncategorized') === filter.slice(9));
      return matches && categoryMatches;
    });
    if (sort === 'alpha') items = [...items].sort((a, b) => a.title.localeCompare(b.title));
    else if (sort === 'created') items = [...items].sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    else if (sort === 'studied') items = [...items].sort((a, b) => new Date(b.lastStudiedAt || 0) - new Date(a.lastStudiedAt || 0));
    else items = [...items].sort((a, b) => new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0));
    return items;
  }, [localSets, query, sort, filter]);

  return (
    <div className="page-wrap">
      <section className="hero-panel">
        <div className="hero-orb hero-orb-one" /><div className="hero-orb hero-orb-two" />
        <div className="hero-copy">
          <span className="eyebrow"><span className="eyebrow-dot" /> YOUR STUDY SPACE</span>
          <h1>Make it stick<span className="accent-dot">.</span></h1>
          <p>Turn your notes into knowledge. Create flashcards, practice, and learn at your own pace.</p>
          <div className="hero-actions"><button className="button button-primary" onClick={newSet}><Plus size={17} /> Create a study set</button><Link className="button button-ghost" href="/import"><UploadCloud size={17} /> Import study material</Link></div>
        </div>
        <div className="hero-stat-card">
          <div className="hero-stat-icon"><Layers3 size={18} /></div>
          <strong>{localSets.length}</strong><span>study set(s) on this device</span>
          
        </div>
      </section>

      {notice && <div className="notice success-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}>×</button></div>}

      <section className="dashboard-section">
        <div className="section-heading"><div><span className="eyebrow">LIBRARY</span><h2>Your study sets</h2><p className="muted">Everything in this section is saved in this browser automatically.</p></div></div>
        <div className="library-toolbar">
          <label className="search-box"><Search size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search your study sets" aria-label="Search study sets" /></label>
          <div className="toolbar-controls">
            <select aria-label="Filter study sets" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="all">All sets</option><option value="starred">Starred cards</option>{categories.map((category) => <option key={category} value={`category:${category}`}>{category}</option>)}</select>
            <select aria-label="Sort study sets" value={sort} onChange={(event) => setSort(event.target.value)}><option value="created">Recently created</option><option value="updated">Recently updated</option><option value="studied">Recently studied</option><option value="alpha">Alphabetical</option></select>
          </div>
        </div>
        {busy ? <div className="loading-panel"><span className="spinner" /> Loading your library…</div> : visibleSets.length ? (
          <div className="set-grid">
            {visibleSets.map((set) => (
              <article className="set-card" key={set.id}>
                <div className="set-card-top"><span className="set-type"><Folder size={13} /> On this device</span>
                  <div className="set-menu"><button className="icon-button" aria-label={`Export ${set.title} as JSON`} title="Export JSON" onClick={() => exportJson(set)}><Download size={15} /></button><button className="icon-button" aria-label={`More actions for ${set.title}`} title="Export CSV" onClick={() => exportCsv(set)}><MoreHorizontal size={16} /></button></div>
                </div>
                <Link href={`/sets/${set.id}`} className="set-card-link"><h3>{set.title || 'Untitled study set'}</h3><p>{set.description || 'No description yet. Open this set to add one.'}</p></Link>
                <div className="set-card-meta"><span><BookOpen size={14} /> {set.cards?.filter((card) => card.term?.trim() && card.definition?.trim()).length || 0} cards</span><span><Clock3 size={14} /> {friendlyDate(set.lastStudiedAt)}</span><span><Star size={13} /> {set.progress?.known?.filter((id) => set.cards?.some((card) => card.id === id && card.term?.trim() && card.definition?.trim())).length || 0}/{set.cards?.filter((card) => card.term?.trim() && card.definition?.trim()).length || 0} known</span></div>
                <div className="set-card-footer"><Link href={`/sets/${set.id}`} className="study-link"><GraduationCap size={15} /> Study set</Link><div className="card-actions"><button className="icon-button" title="Duplicate set" onClick={() => duplicateLocal(set)}><Copy size={15} /></button>{account && <button className="icon-button" title="Move this set to Discord cloud storage" onClick={() => saveCloud(set)} disabled={cloudCount >= 3}><UploadCloud size={15} /></button>}<button className="icon-button danger-icon" title="Delete local set" onClick={() => removeLocal(set)}><Trash2 size={15} /></button></div></div>
              </article>
            ))}
          </div>
        ) : (
          <div className="empty-state"><div className="empty-icon"><BookOpen size={25} /></div><h3>{query ? 'No matching study sets' : 'Your library is ready for its first set'}</h3><p>{query ? 'Try another search term or clear the search.' : 'Create a set from scratch, paste your notes, or import a document or spreadsheet.'}</p>{!query && <div className="empty-actions"><button className="button button-primary" onClick={newSet}><Plus size={16} /> Create your first set</button><Link href="/import" className="button button-outline"><UploadCloud size={16} /> Import a file</Link></div>}</div>
        )}
      </section>

      <section className="cloud-section" id="cloud-storage">
        <div className="section-heading"><div><span className="eyebrow">OPTIONAL CLOUD STORAGE</span><h2>Discord cloud storage</h2><p className="muted">Move up to three important sets into your account to access them on other devices. Cloud sets are not stored on this device.</p></div>{account && <span className="cloud-counter"><Cloud size={15} /> {cloudCount}/3 slots used</span>}</div>
        {!account ? <div className="cloud-prompt"><div className="cloud-prompt-icon"><Cloud size={20} /></div><div><h3>Your sets are private to this browser</h3><p>Sign in when you want to move up to three important study sets into your Discord account. Cloud sets are removed from this device after upload.</p></div><a href="/api/auth/discord" className="button button-outline"><LogIn size={15} /> Sign in with Discord</a></div> : cloudSets.length ? (
          <div className="cloud-list">{cloudSets.map((set) => <div className="cloud-row" key={set.id}><div className="cloud-row-icon"><Cloud size={17} /></div><div className="cloud-row-copy"><strong>{set.title}</strong><span>{set.cards.length} cards · {set.progress?.known?.length || 0} known · Updated {friendlyDate(set.updatedAt)}</span></div><button className="button button-small button-outline" onClick={() => openCloud(set)}>Open set <ArrowUpRight size={14} /></button><button className="icon-button danger-icon" title="Delete cloud set" onClick={() => deleteCloud(set)}><Trash2 size={15} /></button></div>)}</div>
        ) : <div className="cloud-empty"><Cloud size={20} /><span>No cloud sets yet. Use the cloud icon on one of your local sets to move it here.</span></div>}
      </section>
    </div>
  );
}

