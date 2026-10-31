'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Copy, FileDown, Plus, Star, Trash2, UploadCloud, CheckCircle2, Save } from 'lucide-react';
import { deleteSet, saveSet } from '@/lib/storage';
import { loadStudySet } from '@/lib/set-access';
import { notifyCloudUpdated } from '@/lib/client-events';
import { exportJson } from '@/lib/export';

export default function EditSetWorkspace() {
  const params = useParams();
  const router = useRouter();
  const [set, setSet] = useState(null);
  const [setKind, setSetKind] = useState('local');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [saveState, setSaveState] = useState('saved');
  const [account, setAccount] = useState(null);
  const [cloudCount, setCloudCount] = useState(0);

  useEffect(() => {
    let active = true;
    Promise.all([
      loadStudySet(params.id),
      fetch('/api/auth/me', { cache: 'no-store' }).then((response) => response.json()).catch(() => ({ user: null })),
    ]).then(([loaded, me]) => {
      if (!active) return;
      setSet(loaded.set);
      setSetKind(loaded.kind);
      setAccount(me.user || null);
      setCloudCount(Number(me.cloudCount) || 0);
      if (!loaded.set) setError(loaded.error || 'This study set does not exist.');
      setLoading(false);
    }).catch((loadError) => {
      if (active) {
        setError(loadError.message || 'Could not load this study set.');
        setLoading(false);
      }
    });
    return () => { active = false; };
  }, [params.id]);

  async function persistDraft(nextSet) {
    setSet(nextSet);
    setError('');
    if (setKind === 'cloud') {
      setSaveState('unsaved');
      return;
    }
    setSaveState('saving');
    try {
      await saveSet({ ...nextSet, updatedAt: new Date().toISOString() });
      setSaveState('saved');
    } catch (saveError) {
      setSaveState('error');
      setError(saveError.message || 'Could not save changes in this browser.');
    }
  }

  function updateField(field, value) {
    persistDraft({ ...set, [field]: value });
  }

  function updateCard(index, field, value) {
    persistDraft({ ...set, cards: set.cards.map((card, cardIndex) => cardIndex === index ? { ...card, [field]: value } : card) });
  }

  function addCard() {
    persistDraft({ ...set, cards: [...set.cards, { id: crypto.randomUUID(), term: '', definition: '', notes: '', starred: false, order: set.cards.length }] });
  }

  function duplicateCard(index) {
    const duplicate = { ...set.cards[index], id: crypto.randomUUID() };
    const cards = [...set.cards];
    cards.splice(index + 1, 0, duplicate);
    persistDraft({ ...set, cards: cards.map((card, order) => ({ ...card, order })) });
  }

  function moveCard(index, delta) {
    const cards = [...set.cards];
    const next = index + delta;
    if (next < 0 || next >= cards.length) return;
    [cards[index], cards[next]] = [cards[next], cards[index]];
    persistDraft({ ...set, cards: cards.map((card, order) => ({ ...card, order })) });
  }

  async function saveAndExit() {
    if (!set.title.trim()) {
      setError('A title is required.');
      return;
    }
    const completeCards = set.cards.filter((card) => card.term.trim() && card.definition.trim()).map((card, order) => ({ ...card, order }));
    if (completeCards.length > 500) {
      setError('A study set can contain up to 500 complete cards.');
      return;
    }
    if (setKind === 'cloud' && !completeCards.length) {
      setError('Add at least one complete term and definition before saving.');
      return;
    }
    if (setKind === 'cloud' && completeCards.length !== set.cards.length) {
      setError('Finish or delete incomplete cards before saving this cloud set.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const updated = { ...set, title: set.title.trim(), cards: setKind === 'cloud' ? completeCards : set.cards, updatedAt: new Date().toISOString() };
      if (setKind === 'cloud') {
        const response = await fetch(`/api/cloud/sets/${set.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(updated),
        });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || 'Could not sync your changes to the cloud.');
        notifyCloudUpdated();
      } else {
        await saveSet(updated);
      }
      setSet(updated);
      setSaveState('saved');
      router.push(`/sets/${set.id}`);
    } catch (saveError) {
      setError(saveError.message || 'Could not save this set.');
    } finally {
      setSaving(false);
    }
  }

  async function moveToCloud() {
    if (!set || setKind !== 'local' || !account) return;
    if (!set.title.trim()) return setError('A title is required.');
    const completeCards = set.cards.filter((card) => card.term.trim() && card.definition.trim()).map((card, order) => ({ ...card, order }));
    if (!completeCards.length) return setError('Add at least one complete card before moving this set to the cloud.');
    if (completeCards.length !== set.cards.length) return setError('Finish or delete incomplete cards before moving this set to the cloud. Nothing has been moved yet.');
    setSaving(true);
    setError('');
    try {
      const response = await fetch('/api/cloud/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...set, cards: completeCards }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not move this set to cloud storage.');
      await deleteSet(set.id);
      notifyCloudUpdated();
      router.replace(`/sets/${data.id}`);
    } catch (saveError) {
      setError(saveError.message || 'Cloud save failed. Your local set is unchanged.');
    } finally {
      setSaving(false);
    }
  }

  async function deleteCurrentSet() {
    if (!window.confirm(`Permanently delete “${set.title}” from ${setKind === 'cloud' ? 'your Discord cloud storage' : 'this browser'}?`)) return;
    if (setKind === 'cloud') {
      const response = await fetch(`/api/cloud/sets/${set.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not delete this cloud set.');
        return;
      }
      notifyCloudUpdated();
    } else {
      await deleteSet(set.id);
    }
    router.push('/');
  }

  function duplicateCurrentSet() {
    const now = new Date().toISOString();
    const copy = {
      ...set,
      id: crypto.randomUUID(),
      title: `${set.title} (copy)`,
      createdAt: now,
      updatedAt: now,
      cloudId: undefined,
      source: 'local',
      lastStudiedAt: null,
      progress: { known: [], review: [], attempts: 0, correct: 0 },
      cards: set.cards.map((card, order) => ({ ...card, id: crypto.randomUUID(), order })),
    };
    saveSet(copy).then(() => router.push(`/sets/${copy.id}/edit`));
  }

  if (loading) return <div className="page-wrap"><div className="loading-panel"><span className="spinner" /> Opening your study set…</div></div>;
  if (error && !set) return <div className="page-wrap"><div className="empty-state"><h2>Study set unavailable</h2><p>This study set does not exist.</p><Link className="button button-outline" href="/">Back to library</Link></div></div>;
  if (!set) return null;

  const completeCount = set.cards.filter((card) => card.term.trim() && card.definition.trim()).length;

  return (
    <div className="page-wrap narrow-page">
      <div className="edit-page-topbar">
        <Link href={`/sets/${set.id}`} className="back-link"><ArrowLeft size={15} /> Back to set</Link>
        <div className="edit-page-actions">
          <button className="button button-primary" onClick={saveAndExit} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save'}</button>
          {setKind === 'local' && account && <button className="button button-outline" onClick={moveToCloud} disabled={saving || cloudCount >= 3}><UploadCloud size={15} /> {saving ? 'Moving…' : 'Move to cloud'}</button>}
          <button className="icon-button" title="Export JSON" onClick={() => exportJson(set)}><FileDown size={17} /></button>
          <button className="icon-button" title="Duplicate set" onClick={duplicateCurrentSet}><Copy size={17} /></button>
          <button className="icon-button danger-icon" title="Delete set" onClick={deleteCurrentSet}><Trash2 size={17} /></button>
        </div>
      </div>
      <div className="set-header-row"><div><span className="eyebrow">EDIT STUDY SET</span><h1>{set.title || 'Untitled study set'}</h1><p className="muted">{completeCount} complete cards · {setKind === 'cloud' ? 'Saved to your Discord account' : 'Saved on this device'}</p></div></div>

      {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}>×</button></div>}

      <section className="panel editor-panel">
        <div className="set-details-form set-details-form-wide">
          <label>Set title<input value={set.title} onChange={(event) => updateField('title', event.target.value)} maxLength={120} /></label>
          <label>Description<input value={set.description || ''} onChange={(event) => updateField('description', event.target.value)} placeholder="Add a short description" maxLength={1000} /></label>
          <label>Category / folder<input value={set.category || 'Uncategorized'} onChange={(event) => updateField('category', event.target.value)} placeholder="e.g. Biology" maxLength={80} /></label>
          <label>Tags <em className="optional">Comma separated</em><input value={(set.tags || []).join(', ')} onChange={(event) => updateField('tags', event.target.value.split(',').map((tag) => tag.trim()).filter(Boolean).slice(0, 20))} placeholder="e.g. exam, chapter 4" maxLength={500} /></label>
        </div>
        <div className="editor-cards-heading"><div><h2>Flashcards <span className="count-pill">{set.cards.length}</span></h2><p>Use the arrows to change card order. Star important cards.</p></div><button className="button button-outline button-small" onClick={addCard}><Plus size={15} /> Add card</button></div>
        {set.cards.map((card, index) => <div className="edit-card-row workspace-card" key={card.id}>
          <div className="edit-card-number">{String(index + 1).padStart(2, '0')}</div>
          <label><span>Term / question</span><textarea rows={2} value={card.term} onChange={(event) => updateCard(index, 'term', event.target.value)} placeholder="Term or question" /></label>
          <label><span>Definition / answer</span><textarea rows={2} value={card.definition} onChange={(event) => updateCard(index, 'definition', event.target.value)} placeholder="Definition or answer" /></label>
          <div className="edit-card-actions">
            <button className={`icon-button ${card.starred ? 'star-active' : ''}`} title={card.starred ? 'Unstar card' : 'Star card'} onClick={() => updateCard(index, 'starred', !card.starred)}><Star size={15} fill={card.starred ? 'currentColor' : 'none'} /></button>
            <button className="icon-button" title="Move up" disabled={index === 0} onClick={() => moveCard(index, -1)}>↑</button>
            <button className="icon-button" title="Move down" disabled={index === set.cards.length - 1} onClick={() => moveCard(index, 1)}>↓</button>
            <button className="icon-button" title="Duplicate card" onClick={() => duplicateCard(index)}><Copy size={15} /></button>
            <button className="icon-button danger-icon" title="Delete card" onClick={() => updateField('cards', set.cards.filter((item) => item.id !== card.id))}><Trash2 size={15} /></button>
          </div>
          <label className="card-notes-field"><span>Notes <em>Optional</em></span><input value={card.notes || ''} onChange={(event) => updateCard(index, 'notes', event.target.value)} placeholder="Extra context or a memory hint" /></label>
        </div>)}
        <div className="editor-save-row">
          <span className="autosave-status">
            {setKind === 'cloud' ? (saveState === 'unsaved' ? 'Unsaved changes · press Save to sync to your account' : <><CheckCircle2 size={14} /> Cloud changes are saved when you press Save</>) : saveState === 'saving' ? <><span className="spinner tiny-spinner" /> Saving to this browser…</> : saveState === 'error' ? 'Local save failed. Check browser storage.' : <><CheckCircle2 size={14} /> Saved automatically on this device</>}
          </span>
          <button className="button button-primary" onClick={saveAndExit} disabled={saving}><Save size={15} /> {saving ? 'Saving…' : 'Save and return to set'}</button>
        </div>
      </section>
    </div>
  );
}
