'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, BookOpen, Brain, CheckCircle2, ChevronDown, Cloud, FileText,
  GraduationCap, Layers3, Pencil, Play, RotateCcw, Shuffle, Sparkles,
  Star, UploadCloud, Download, Trash2, X,
} from 'lucide-react';
import { deleteSet, saveSet } from '@/lib/storage';
import { loadStudySet } from '@/lib/set-access';
import { notifyCloudUpdated } from '@/lib/client-events';
import { exportCsv, exportJson } from '@/lib/export';
import { shuffleItems } from '@/lib/study';
import StudySession from '@/components/StudySession';

const COUNT_OPTIONS = [1, 5, 10, 20, 'all'];

export default function SetWorkspace() {
  const params = useParams();
  const router = useRouter();
  const [studySet, setStudySet] = useState(null);
  const [account, setAccount] = useState(null);
  const [cloudCount, setCloudCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [savingCloud, setSavingCloud] = useState(false);
  const [setKind, setSetKind] = useState('local');
  const [setupMode, setSetupMode] = useState(null);
  const [level, setLevel] = useState('basic');
  const [questionCount, setQuestionCount] = useState('all');
  const [testType, setTestType] = useState('choice');
  const [answerSide, setAnswerSide] = useState('definition');
  const [includeCheckpoints, setIncludeCheckpoints] = useState(true);
  const [starredOnly, setStarredOnly] = useState(false);
  const [reviewOnly, setReviewOnly] = useState(false);
  const [activeSession, setActiveSession] = useState(null);
  const progressQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    Promise.all([
      loadStudySet(params.id),
      fetch('/api/auth/me', { cache: 'no-store' }).then((response) => response.json()).catch(() => ({ user: null, cloudCount: 0 })),
    ]).then(([loaded, me]) => {
      if (!active) return;
      setStudySet(loaded.set);
      setSetKind(loaded.kind);
      setAccount(me.user || null);
      setCloudCount(me.cloudCount || 0);
      if (!loaded.set) setError(loaded.error || 'This study set does not exist.');
    }).catch((loadError) => setError(loadError.message || 'Could not load this study set.'))
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [params.id]);

  const completeCards = useMemo(() => (studySet?.cards || []).filter((card) => card.term?.trim() && card.definition?.trim()), [studySet]);
  const readyCards = useMemo(() => {
    let cards = [...completeCards];
    if (starredOnly) cards = cards.filter((card) => card.starred);
    if (reviewOnly) cards = cards.filter((card) => (studySet?.progress?.review || []).includes(card.id));
    return cards;
  }, [completeCards, starredOnly, reviewOnly, studySet?.progress?.review]);
  const visibleCount = questionCount === 'all' ? readyCards.length : Math.min(Number(questionCount), readyCards.length);
  const availableCountOptions = COUNT_OPTIONS.filter((count) => count === 'all' || count < readyCards.length);

  async function saveToCloud() {
    if (!studySet || !account || setKind !== 'local') return;
    setSavingCloud(true);
    setError('');
    setNotice('');
    try {
      const complete = studySet.cards.filter((card) => card.term?.trim() && card.definition?.trim());
      if (!complete.length) throw new Error('Add at least one complete card before moving this set to the cloud.');
      if (complete.length !== studySet.cards.length) throw new Error('Finish or delete incomplete cards before moving this set to the cloud. Nothing has been moved yet.');
      const response = await fetch('/api/cloud/sets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...studySet, cards: complete }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Could not save this set to cloud storage.');
      await deleteSet(studySet.id);
      notifyCloudUpdated();
      setNotice('Your set has been moved to Discord cloud storage and removed from this device.');
      router.replace(`/sets/${data.id}`);
    } catch (saveError) {
      setError(saveError.message || 'Cloud save failed. Your local set is unchanged.');
    } finally {
      setSavingCloud(false);
    }
  }

  async function removeCurrentSet() {
    if (!studySet) return;
    if (setKind === 'cloud') {
      if (!window.confirm(`Permanently delete “${studySet.title}” from your Discord cloud storage?`)) return;
      const response = await fetch(`/api/cloud/sets/${studySet.id}`, { method: 'DELETE' });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not delete this cloud set.');
        return;
      }
      notifyCloudUpdated();
      router.push('/');
      return;
    }
    if (!window.confirm(`Delete “${studySet.title}” from this browser? This cannot be undone.`)) return;
    await deleteSet(studySet.id);
    router.push('/');
  }

  async function updateProgress(progress) {
    if (!studySet) return;
    const now = new Date().toISOString();
    const updated = { ...studySet, progress, lastStudiedAt: now, updatedAt: now };
    setStudySet(updated);
    try {
      if (setKind === 'cloud') {
        const queuedSave = progressQueueRef.current.catch(() => {}).then(async () => {
          const response = await fetch(`/api/cloud/sets/${studySet.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ progress }),
          });
          const data = await response.json();
          if (!response.ok) throw new Error(data.error || 'Your study progress could not be synced.');
          setStudySet((current) => ({ ...current, progress: data.progress, lastStudiedAt: data.lastStudiedAt, updatedAt: data.updatedAt }));
        });
        progressQueueRef.current = queuedSave;
        await queuedSave;
        return;
      }
      await saveSet(updated);
    } catch (progressError) {
      setError(progressError.message || 'Study progress could not be saved.');
    }
  }

  function startStudy() {
    if (!readyCards.length) return;
    const count = setupMode === 'matching' ? readyCards.length : visibleCount;
    // Practice tests receive the full pool so each retry can draw a fresh
    // subset. Memorization and Cram choose a random subset at session start.
    const selectedCards = setupMode === 'test' || setupMode === 'matching'
      ? [...readyCards]
      : shuffleItems(readyCards).slice(0, count);
    const options = setupMode === 'memorize'
      ? { count, level, includeFlashcards: true, answerSide }
      : setupMode === 'cram'
        ? { count, level: 'basic', questionType: 'choice', includeFlashcards: includeCheckpoints, answerSide }
        : setupMode === 'test'
          ? { count, questionType: testType, answerSide }
          : { answerSide };
    setActiveSession({ mode: setupMode === 'matching' ? 'match' : setupMode, cards: selectedCards, options });
    setSetupMode(null);
  }

  if (activeSession) {
    return <div className="page-wrap">{error && <div className="notice error-notice">{error}</div>}<StudySession set={studySet} mode={activeSession.mode} cards={activeSession.cards} options={activeSession.options} onClose={() => setActiveSession(null)} onProgress={updateProgress} /></div>;
  }

  if (loading) return <div className="page-wrap"><div className="loading-panel"><span className="spinner" /> Opening your study set…</div></div>;
  if (!studySet) return <div className="page-wrap narrow-page"><div className="empty-state"><h2>Study set unavailable</h2><p>{error || 'This study set could not be found.'}</p><Link href="/" className="button button-outline">Back to library</Link></div></div>;

  const knownCount = (studySet.progress?.known || []).filter((id) => completeCards.some((card) => card.id === id)).length;
  const reviewCount = (studySet.progress?.review || []).filter((id) => completeCards.some((card) => card.id === id)).length;
  const progressPercent = completeCards.length ? Math.round((knownCount / completeCards.length) * 100) : 0;

  return (
    <div className="page-wrap set-overview-wrap">
      <div className="set-overview-topline">
        <Link href="/" className="back-link"><ArrowLeft size={15} /> My study sets</Link>
        <span className={`set-type ${setKind === 'cloud' ? 'set-type-cloud' : ''}`}><Cloud size={13} /> {setKind === 'cloud' ? 'Saved to your Discord account' : 'Saved on this device'}</span>
      </div>

      <section className="set-overview-hero">
        <div className="set-overview-copy">
          <div className="set-overview-kickers">
            <span className="eyebrow"><Layers3 size={13} /> {studySet.category || 'Uncategorized'}</span>
            {studySet.tags?.length > 0 && <div className="set-tags">{studySet.tags.map((tag) => <span key={tag}>{tag}</span>)}</div>}
          </div>
          <h1>{studySet.title || 'Untitled study set'}</h1>
          <p>{studySet.description || 'A study set you can review, practice, and make your own.'}</p>
          <div className="set-overview-stats">
            <span><BookOpen size={15} /> {completeCards.length} cards</span>
            <span><CheckCircle2 size={15} /> {knownCount} known</span>
            <span><RotateCcw size={15} /> {reviewCount} to review</span>
          </div>
          <div className="set-overview-actions">
            <Link className="button button-primary" href={`/sets/${studySet.id}/edit`}><Pencil size={16} /> Edit set</Link>
            <button className="button button-outline" onClick={() => exportJson(studySet)}><Download size={15} /> Export JSON</button>
            <button className="button button-outline" onClick={() => exportCsv(studySet)}><FileText size={15} /> Export CSV</button>
            {setKind === 'local' && account && <button className="button button-outline" onClick={saveToCloud} disabled={savingCloud || cloudCount >= 3}><UploadCloud size={15} /> {savingCloud ? 'Moving…' : `Move to cloud (${cloudCount}/3)`}</button>}
          </div>
          {setKind === 'local' && account && cloudCount >= 3 && <p className="helper-text">All three cloud slots are in use. Delete a cloud set before moving another set.</p>}
        </div>
        <div className="set-progress-card">
          <div className="set-progress-card-top"><span>YOUR PROGRESS</span><strong>{progressPercent}%</strong></div>
          <div className="set-progress-track"><span style={{ width: `${progressPercent}%` }} /></div>
          <div className="set-progress-breakdown"><span><i className="progress-known-dot" /> {knownCount} known</span><span><i className="progress-review-dot" /> {reviewCount} revisit</span></div>
          <div className="set-progress-divider" />
          <p>{completeCards.length ? (setKind === 'cloud' ? 'Your study progress syncs to your Discord account.' : 'Progress is saved automatically in this browser.') : 'Add your first cards to start studying.'}</p>
        </div>
      </section>

      {notice && <div className="notice success-notice">{notice}<button onClick={() => setNotice('')}>×</button></div>}
      {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}>×</button></div>}

      <section className="study-hub-section">
        <div className="study-hub-heading"><div><span className="eyebrow">PICK UP WHERE YOU LEFT OFF</span><h2>Choose how to study</h2><p>Use a focused practice path or review the cards one at a time.</p></div><span className="study-ready-count">{completeCards.length} cards ready</span></div>
        <div className="study-hub-grid">
          <button className="study-hub-card memorize" onClick={() => setSetupMode('memorize')} disabled={completeCards.length < 2}>
            <span className="study-hub-icon"><Brain size={21} /></span><span className="study-hub-tag">BUILD LONG-TERM RECALL</span><strong>Memorization</strong><p>Multiple choice with flashcard checkpoints. Choose Basic or Advanced practice.</p><span className="study-hub-cta">Set up session <ArrowLeft size={15} /></span>
          </button>
          <button className="study-hub-card cram" onClick={() => setSetupMode('cram')} disabled={completeCards.length < 2}>
            <span className="study-hub-icon"><Sparkles size={21} /></span><span className="study-hub-tag">QUICK REVIEW</span><strong>Cram for a test</strong><p>Rapid multiple-choice practice with optional flashcard checkpoints.</p><span className="study-hub-cta">Set up session <ArrowLeft size={15} /></span>
          </button>
          <button className="study-hub-card test" onClick={() => setSetupMode('test')} disabled={!completeCards.length}>
            <span className="study-hub-icon"><FileText size={21} /></span><span className="study-hub-tag">CHECK YOUR KNOWLEDGE</span><strong>Practice test</strong><p>Choose how many questions and whether to select or write your answers.</p><span className="study-hub-cta">Set up test <ArrowLeft size={15} /></span>
          </button>
          <button className="study-hub-card match" onClick={() => setSetupMode('matching')} disabled={completeCards.length < 2}>
            <span className="study-hub-icon"><Shuffle size={21} /></span><span className="study-hub-tag">QUICK GAME</span><strong>Matching</strong><p>Pair terms with definitions and see how quickly you can finish.</p><span className="study-hub-cta">Start matching <ArrowLeft size={15} /></span>
          </button>
        </div>
        {completeCards.length === 1 && <p className="helper-text">Memorization and Cram need at least two complete cards for multiple choice. Flashcards and written practice are still available.</p>}
        <button className="flashcards-launch-row" onClick={() => router.push(`/sets/${studySet.id}/flashcards`)} disabled={!completeCards.length}>
          <span className="flashcards-launch-icon"><BookOpen size={22} /></span><span><strong>Flashcards</strong><small>Flip through the full set at your own pace.</small></span><span className="flashcards-launch-count">{completeCards.length} cards</span><ArrowLeft className="flashcards-launch-arrow" size={17} />
        </button>
      </section>

      {setupMode && <div className="study-setup-backdrop" role="presentation" onClick={(event) => { if (event.target === event.currentTarget) setSetupMode(null); }}>
        <section className="study-setup-panel" role="dialog" aria-modal="true" aria-labelledby="study-setup-title">
          <div className="study-setup-header"><div><span className="eyebrow">SESSION SETUP</span><h2 id="study-setup-title">{setupMode === 'memorize' ? 'Memorization' : setupMode === 'cram' ? 'Cram for a test' : setupMode === 'test' ? 'Practice test' : 'Matching'}</h2><p>Set up a session for <strong>{studySet.title}</strong>.</p></div><button className="icon-button" aria-label="Close setup" onClick={() => setSetupMode(null)}><X size={18} /></button></div>

          {setupMode === 'memorize' && <div className="setup-option-block"><span className="setup-option-label">Choose your level</span><div className="setup-level-grid"><button className={level === 'basic' ? 'active' : ''} onClick={() => setLevel('basic')}><strong>Basic</strong><small>Multiple choice with a flashcard checkpoint after every 7 questions.</small></button><button className={level === 'advanced' ? 'active' : ''} onClick={() => setLevel('advanced')}><strong>Advanced</strong><small>Alternates multiple choice and written recall, with flashcard checkpoints.</small></button></div></div>}

          {(setupMode === 'memorize' || setupMode === 'cram' || setupMode === 'test') && <div className="setup-option-block"><span className="setup-option-label">How many questions?</span><div className="setup-count-options">{availableCountOptions.map((count) => <button key={count} className={questionCount === count ? 'active' : ''} onClick={() => setQuestionCount(count)}>{count === 'all' ? `All (${readyCards.length})` : count}</button>)}</div><p className="helper-text">{visibleCount} {visibleCount === 1 ? 'question' : 'questions'} will be included.</p></div>}

          {setupMode === 'cram' && <div className="setup-option-block"><label className="setup-checkbox"><input type="checkbox" checked={includeCheckpoints} onChange={(event) => setIncludeCheckpoints(event.target.unchecked)} /><span><strong>Include flashcard checkpoints</strong><small>Review the cards after each group of 7 questions.</small></span></label></div>}

          {setupMode === 'test' && <div className="setup-option-block"><span className="setup-option-label">Answer format</span><div className="setup-level-grid setup-type-grid"><button className={testType === 'choice' ? 'active' : ''} onClick={() => setTestType('choice')} disabled={readyCards.length < 2}><strong>Multiple choice</strong><small>Select the correct answer from a set of options.</small></button><button className={testType === 'typed' ? 'active' : ''} onClick={() => setTestType('typed')}><strong>Written response</strong><small>Type the definition or answer yourself.</small></button></div>{readyCards.length < 2 && <p className="helper-text">Multiple choice needs at least two cards with different answers.</p>}</div>}

          <div className="setup-option-block"><span className="setup-option-label">What should you answer?</span><div className="setup-direction-grid" role="group" aria-label="Choose whether to recall the term or definition"><button type="button" className={answerSide === 'definition' ? 'active' : ''} onClick={() => setAnswerSide('definition')}><strong>Definition</strong><small>See the term, then recall its definition.</small></button><button type="button" className={answerSide === 'term' ? 'active' : ''} onClick={() => setAnswerSide('term')}><strong>Term</strong><small>See the definition, then recall its term.</small></button><button type="button" className={answerSide === 'random' ? 'active' : ''} onClick={() => setAnswerSide('random')}><strong>Both at random</strong><small>Mix term and definition questions throughout the session.</small></button></div></div>

          <div className="setup-option-block setup-filters"><span className="setup-option-label">Focus (optional)</span><label className="setup-checkbox"><input type="checkbox" checked={starredOnly} onChange={(event) => { setStarredOnly(event.target.checked); setReviewOnly(false); }} /><span><strong>Starred cards only</strong></span></label><label className="setup-checkbox"><input type="checkbox" checked={reviewOnly} onChange={(event) => { setReviewOnly(event.target.checked); setStarredOnly(false); }} /><span><strong>Cards to revisit only</strong></span></label><span className="helper-text">{readyCards.length} cards match your focus settings.</span>{readyCards.length === 0 && <p className="inline-warning">No cards match these filters. Turn off one or both focus options to continue.</p>}</div>

          <div className="study-setup-footer"><button className="button button-outline" onClick={() => setSetupMode(null)}>Cancel</button><button className="button button-primary" onClick={startStudy} disabled={!readyCards.length || ((['memorize', 'cram', 'matching'].includes(setupMode) || (setupMode === 'test' && testType === 'choice')) && readyCards.length < 2)}><Play size={16} /> Start {setupMode === 'test' ? 'test' : setupMode === 'matching' ? 'game' : 'session'}</button></div>
        </section>
      </div>}

      <section className="set-card-preview-section">
        <div className="study-hub-heading"><div><span className="eyebrow">IN THIS SET</span><h2>Terms preview</h2><p>A quick look at the terms and definitions in this set.</p></div><Link href={`/sets/${studySet.id}/edit`} className="text-link"><Pencil size={14} /> Edit cards</Link></div>
        {completeCards.length ? <div className="set-card-preview-list">{completeCards.slice(0, 4).map((card, index) => <div className="set-preview-row" key={card.id}><span className="set-preview-number">{String(index + 1).padStart(2, '0')}</span><strong>{card.term}</strong><span>{card.definition}</span>{card.starred && <Star size={14} className="star-active" />}</div>)}</div> : <div className="empty-state"><BookOpen size={24} /><h3>No complete cards yet</h3><p>Add terms and definitions to start studying.</p><Link href={`/sets/${studySet.id}/edit`} className="button button-primary"><Pencil size={15} /> Add cards</Link></div>}
        {completeCards.length > 4 && <Link className="text-link set-preview-more" href={`/sets/${studySet.id}/edit`}>View all {completeCards.length} cards <ChevronDown size={14} /></Link>}
      </section>

      <div className="set-overview-bottom-actions"><button className="text-danger-button" onClick={removeCurrentSet}><Trash2 size={15} /> {setKind === 'cloud' ? 'Delete cloud set' : 'Delete local set'}</button><span className="helper-text">{setKind === 'cloud' ? 'This set belongs to your Discord account and is not stored in this browser.' : 'Your study set is saved in this browser automatically. Export a backup from the actions above.'}</span></div>
    </div>
  );
}
