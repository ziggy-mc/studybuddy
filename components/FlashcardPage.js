'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, BookOpen, Cloud } from 'lucide-react';
import { saveSet } from '@/lib/storage';
import { loadStudySet } from '@/lib/set-access';
import StudySession from '@/components/StudySession';

export default function FlashcardPage() {
  const params = useParams();
  const router = useRouter();
  const [studySet, setStudySet] = useState(null);
  const [setKind, setSetKind] = useState('local');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const progressQueueRef = useRef(Promise.resolve());

  useEffect(() => {
    let active = true;
    loadStudySet(params.id)
      .then((loaded) => {
        if (!active) return;
        setStudySet(loaded.set);
        setSetKind(loaded.kind);
        if (!loaded.set) setError(loaded.error || 'This study set does not exist.');
      })
      .catch((loadError) => {
        if (active) setError(loadError.message || 'Could not load this study set.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, [params.id]);

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
          if (!response.ok) throw new Error(data.error || 'Study progress could not be synced to your account.');
          setStudySet((current) => ({ ...current, progress: data.progress, lastStudiedAt: data.lastStudiedAt, updatedAt: data.updatedAt }));
        });
        progressQueueRef.current = queuedSave;
        await queuedSave;
      } else {
        await saveSet(updated);
      }
    } catch (saveError) {
      setError(saveError.message || 'Study progress could not be saved.');
    }
  }

  if (loading) return <div className="page-wrap"><div className="loading-panel"><span className="spinner" /> Loading your flashcards…</div></div>;
  if (error || !studySet) return <div className="page-wrap narrow-page"><div className="empty-state"><div className="empty-icon"><BookOpen size={25} /></div><h2>Flashcards unavailable</h2><p>This study set does not exist.</p><Link className="button button-outline" href="/">Back to library</Link></div></div>;

  const readyCards = (studySet.cards || []).filter((card) => card.term?.trim() && card.definition?.trim());

  return (
    <div className="page-wrap flashcard-page-wrap">
      <div className="flashcard-page-heading">
        <div><span className="eyebrow">FLASHCARD STUDY <span className="set-type set-type-cloud"><Cloud size={12} /> {setKind === 'cloud' ? 'Cloud set' : 'Local set'}</span></span><h1>{studySet.title}</h1><p>{readyCards.length} cards · {setKind === 'cloud' ? 'Progress syncs to your Discord account.' : 'Progress saves automatically in this browser.'}</p></div>
        
      </div>
      {error && <div className="notice error-notice">{error}</div>}
      <StudySession
        set={{ ...studySet, cards: readyCards }}
        mode="flashcards"
        cards={readyCards}
        onClose={() => router.push(`/sets/${studySet.id}`)}
        onProgress={updateProgress}
      />
    </div>
  );
}
