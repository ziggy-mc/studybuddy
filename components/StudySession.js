'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Clock3, RotateCcw, Shuffle, XCircle } from 'lucide-react';
import { buildChoiceOptions, getCheckpointCards, getMemorizationQuestionType, normalizeAnswer, shuffleItems } from '@/lib/study';

function shuffle(items) {
  return shuffleItems(items);
}

function normalize(value) {
  return normalizeAnswer(value);
}

function buildChoices(cards, correctCard) {
  return buildChoiceOptions(cards, correctCard);
}

function buildQuestions(cards, count, type) {
  return shuffle(cards).slice(0, Math.min(count, cards.length)).map((card) => ({
    card,
    choices: type === 'choice' ? buildChoices(cards, card) : [],
  }));
}

function createMatching(cards) {
  const selected = shuffle(cards).slice(0, Math.min(8, cards.length));
  return {
    terms: selected.map((card) => ({ cardId: card.id, text: card.term })),
    definitions: shuffle(selected).map((card) => ({ cardId: card.id, text: card.definition })),
  };
}

export default function StudySession({ set, mode, cards: startingCards, options = {}, onClose, onProgress }) {
  const sourceCards = startingCards || set.cards || [];
  const isLearnMode = ['learn', 'memorize', 'cram'].includes(mode);
  const hasFlashcardCheckpoints = ['memorize', 'cram'].includes(mode) && options.includeFlashcards !== false;
  const canWriteAnswers = mode === 'learn' || (mode === 'memorize' && options.level === 'advanced');
  const [cards, setCards] = useState(() => {
    if (!isLearnMode) return [...sourceCards];
    const reviewIds = new Set(set.progress?.review || []);
    return [...shuffle(sourceCards.filter((card) => reviewIds.has(card.id))), ...shuffle(sourceCards.filter((card) => !reviewIds.has(card.id)))];
  });
  const [index, setIndex] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [known, setKnown] = useState(() => new Set(set.progress?.known || []));
  const [review, setReview] = useState(() => new Set(set.progress?.review || []));
  const [typedAnswer, setTypedAnswer] = useState('');
  const [feedback, setFeedback] = useState(null);
  const [learnQuestionType, setLearnQuestionType] = useState(() => sourceCards.length > 1 ? 'choice' : 'typed');
  const [learnStep, setLearnStep] = useState('question');
  const [checkpointCards, setCheckpointCards] = useState([]);
  const [checkpointIndex, setCheckpointIndex] = useState(0);
  const [checkpointFlipped, setCheckpointFlipped] = useState(false);
  const [learnSelected, setLearnSelected] = useState('');
  const initialQuestionType = options.questionType || (sourceCards.length > 1 ? 'choice' : 'typed');
  const initialQuestionCount = Math.min(Number(options.count) || 10, sourceCards.length);
  const [questionType, setQuestionType] = useState(initialQuestionType);
  const [questionCount, setQuestionCount] = useState(initialQuestionCount);
  const [questions, setQuestions] = useState(() => mode === 'test' ? buildQuestions(sourceCards, initialQuestionCount, initialQuestionType) : []);
  const [testIndex, setTestIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [selected, setSelected] = useState('');
  const [matching, setMatching] = useState(() => createMatching(sourceCards));
  const [firstMatch, setFirstMatch] = useState(null);
  const [matched, setMatched] = useState(() => new Set());
  const [mistakes, setMistakes] = useState(0);
  const [matchStartedAt, setMatchStartedAt] = useState(Date.now());
  const [clockNow, setClockNow] = useState(Date.now());
  const [finished, setFinished] = useState(false);
  const progressRef = useRef(set.progress || { known: [], review: [], attempts: 0, correct: 0 });

  const current = cards[index];
  const learnChoices = useMemo(() => buildChoices(cards, current), [cards, current?.id]);
  const testQuestion = questions[testIndex];
  const testFinished = mode === 'test' && testIndex >= questions.length;
  const matchingFinished = mode === 'match' && matching.terms.length > 0 && matched.size >= matching.terms.length;
  const canUseLearnChoices = learnChoices.length > 1;
  const checkpointCard = checkpointCards[checkpointIndex];

  function persistProgress(nextKnown = known, nextReview = review, extra = {}) {
    const nextProgress = {
      ...progressRef.current,
      known: [...nextKnown],
      review: [...nextReview],
      attempts: (progressRef.current?.attempts || 0) + (extra.attempts || 0),
      correct: (progressRef.current?.correct || 0) + (extra.correct || 0),
    };
    progressRef.current = nextProgress;
    onProgress(nextProgress);
  }

  function recordAnswer(card, isCorrect, countAttempt = true, correctDeltaOverride = null) {
    if (!card) return;
    const nextKnown = new Set(known);
    const nextReview = new Set(review);
    if (isCorrect) {
      nextKnown.add(card.id);
      nextReview.delete(card.id);
    } else {
      nextReview.add(card.id);
      nextKnown.delete(card.id);
    }
    setKnown(nextKnown);
    setReview(nextReview);
    persistProgress(nextKnown, nextReview, { attempts: countAttempt ? 1 : 0, correct: isCorrect && countAttempt ? 1 : 0 });
  }

  function markCard(isKnown) {
    if (!current) return;
    recordAnswer(current, isKnown);
    setFlipped(false);
    if (index + 1 >= cards.length) setFinished(true);
    else setIndex((value) => Math.min(cards.length - 1, value + 1));
  }

  function restartFlashcards() {
    if (isLearnMode) {
      const reviewIds = new Set(review);
      setCards([...shuffle(sourceCards.filter((card) => reviewIds.has(card.id))), ...shuffle(sourceCards.filter((card) => !reviewIds.has(card.id)))]);
    } else {
      setCards([...sourceCards]);
    }
    setIndex(0);
    setFlipped(false);
    setFinished(false);
    setFeedback(null);
    setTypedAnswer('');
    setLearnSelected('');
    setLearnStep('question');
    setCheckpointCards([]);
    setCheckpointIndex(0);
    setCheckpointFlipped(false);
  }

  function shuffleCards() {
    setCards(shuffle(cards));
    setIndex(0);
    setFlipped(false);
    setFinished(false);
  }

  function submitLearnAnswer() {
    if (!typedAnswer.trim() || !current) return;
    const answer = normalize(typedAnswer);
    const definition = normalize(current.definition);
    const correct = answer === definition || (definition.includes(answer) && answer.length > 2);
    setFeedback(correct ? 'correct' : 'incorrect');
    recordAnswer(current, correct);
  }

  function submitLearnChoice(choiceId) {
    if (!current || feedback) return;
    const correct = choiceId === current.id;
    setLearnSelected(choiceId);
    setFeedback(correct ? 'correct' : 'incorrect');
    recordAnswer(current, correct);
  }

  function revealLearnAnswer() {
    if (!current || feedback) return;
    setFeedback('skip');
    setLearnSelected('');
    recordAnswer(current, false);
  }

  function nextLearnCard() {
    const nextIndex = index + 1;
    setFeedback(null);
    setTypedAnswer('');
    setLearnSelected('');
    const checkpoint = hasFlashcardCheckpoints ? getCheckpointCards(cards, nextIndex, 7) : [];
    if (checkpoint.length) {
      setCheckpointCards(checkpoint);
      setCheckpointIndex(0);
      setCheckpointFlipped(false);
      setLearnStep('checkpoint');
      return;
    }
    if (nextIndex >= cards.length) setFinished(true);
    else setIndex(nextIndex);
  }

  function rateCheckpointCard(isKnown) {
    if (!checkpointCard) return;
    recordAnswer(checkpointCard, isKnown, false);
    setCheckpointFlipped(false);
    if (checkpointIndex + 1 < checkpointCards.length) {
      setCheckpointIndex((value) => value + 1);
    } else {
      setLearnStep('question');
      if (index + 1 >= cards.length) setFinished(true);
      else setIndex(index + 1);
    }
  }

  function answerTest(value) {
    if (!testQuestion) return;
    setSelected(value);
  }

  function submitTest() {
    if (!testQuestion || !selected.trim()) return;
    const correct = questionType === 'choice'
      ? selected === testQuestion.card.id
      : normalize(selected) === normalize(testQuestion.card.definition);
    const previousAnswer = answers[testIndex];
    const alreadyAnswered = Boolean(previousAnswer);
    const correctDelta = alreadyAnswered ? Number(correct) - Number(previousAnswer.correct) : Number(correct);
    recordAnswer(testQuestion.card, correct, !alreadyAnswered, correctDelta);
    setAnswers((items) => {
      const next = [...items];
      next[testIndex] = { card: testQuestion.card, answer: selected, correct };
      return next;
    });
    setSelected('');
    setTestIndex((value) => value + 1);
  }

  function previousTestQuestion() {
    if (testIndex > 0) setTestIndex((value) => Math.max(0, value - 1));
  }

  function resetTest(nextType = questionType, nextCount = questionCount) {
    setQuestionType(nextType);
    setQuestionCount(nextCount);
    setQuestions(buildQuestions(cards, nextCount, nextType));
    setAnswers([]);
    setTestIndex(0);
    setSelected('');
  }

  function chooseMatch(side, item) {
    if (matched.has(item.cardId) || matchingFinished) return;
    if (!firstMatch) {
      setFirstMatch({ side, item });
      return;
    }
    if (firstMatch.side === side) {
      setFirstMatch({ side, item });
      return;
    }
    if (firstMatch.item.cardId === item.cardId) {
      const next = new Set(matched);
      next.add(item.cardId);
      setMatched(next);
      setFirstMatch(null);
      if (next.size === matching.terms.length) {
        const nextKnown = new Set(known);
        const nextReview = new Set(review);
        matching.terms.forEach((entry) => { nextKnown.add(entry.cardId); nextReview.delete(entry.cardId); });
        setKnown(nextKnown);
        setReview(nextReview);
        persistProgress(nextKnown, nextReview, { attempts: matching.terms.length, correct: matching.terms.length });
      }
    } else {
      setMistakes((value) => value + 1);
      setFirstMatch(null);
    }
  }

  useEffect(() => {
    function onKey(event) {
      const target = event.target;
      if (mode !== 'flashcards' || finished || target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement || target instanceof HTMLSelectElement || target?.isContentEditable) return;
      if (target instanceof HTMLButtonElement && !target.classList.contains('checkpoint-flashcard')) return;
      if (event.code === 'Space') {
        event.preventDefault();
        setFlipped((value) => !value);
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        setIndex((value) => Math.min(cards.length - 1, value + 1));
        setFlipped(false);
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        setIndex((value) => Math.max(0, value - 1));
        setFlipped(false);
      }
      if (event.key.toLowerCase() === 'k') markCard(true);
      if (event.key.toLowerCase() === 'r') markCard(false);
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [mode, finished, cards.length, index, known, review]);

  useEffect(() => {
    if (mode === 'test') setSelected(answers[testIndex]?.answer || '');
  }, [mode, testIndex, answers]);

  useEffect(() => {
    if (isLearnMode && current) {
      setTypedAnswer('');
      setFeedback(null);
      setLearnSelected('');
    }
  }, [index, mode, current?.id, isLearnMode]);

  useEffect(() => {
    if (mode === 'memorize' && options.level === 'advanced' && current) {
      setLearnQuestionType(getMemorizationQuestionType(cards, index));
    }
  }, [index, mode, options.level, current?.id, cards]);

  useEffect(() => {
    if (mode !== 'match' || matchingFinished) return undefined;
    const timer = window.setInterval(() => setClockNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [mode, matchingFinished]);

  if (!cards.length) return <div className="session-empty"><p>There are no cards available in this study mode.</p><button className="button button-outline" onClick={onClose}>Back to set</button></div>;

  return (
    <div className={`study-session ${mode === 'flashcards' ? 'flashcard-session' : ''}`}>
      <div className="session-topline"><button className="button button-outline button-small session-back-button" onClick={onClose}><ArrowLeft size={15} /> Back to set</button><span className="session-set-name">{set.title}</span><span className="session-mode-label">{mode === 'flashcards' ? 'FLASHCARDS' : mode === 'memorize' ? 'MEMORIZATION' : mode === 'cram' ? 'CRAM FOR A TEST' : mode === 'learn' ? 'LEARN' : mode === 'test' ? 'PRACTICE TEST' : 'MATCHING'}</span></div>

      {mode === 'flashcards' && (finished ? <div className="results-panel session-enter"><div className="results-icon"><CheckCircle2 size={27} /></div><h2>Flashcard session complete</h2><p>You reviewed {cards.length} cards. Keep practicing the cards that need another look.</p><div className="result-stats"><div><strong>{known.size}</strong><span>known</span></div><div><strong>{review.size}</strong><span>to review</span></div></div><button className="button button-primary" onClick={onClose}>Back to your set</button><button className="button button-outline" onClick={restartFlashcards}><RotateCcw size={16} /> Study again</button></div> : <>
        <div className="session-heading"><span className="eyebrow">CARD {index + 1} OF {cards.length}</span><h1>Recall what you know<span className="accent-dot">.</span></h1><p>Flip the card, then mark whether you know it or need more practice.</p></div>
        <div className="progress-track"><span style={{ width: `${((index + 1) / cards.length) * 100}%` }} /></div>
        <div className="checkpoint-card-stage flashcard-page-card-stage">
          <button className={`checkpoint-flashcard flashcard-page-card ${flipped ? 'is-flipped' : ''}`} onClick={() => setFlipped((value) => !value)} aria-label="Flip flashcard" aria-pressed={flipped}>
            <span className="checkpoint-flashcard-inner flashcard-page-card-inner">
              <span className="checkpoint-flashcard-face">
                <small>TERM / QUESTION</small>
                <strong>{current?.term}</strong>
                <em>Tap or press Space to reveal</em>
              </span>
              <span className="checkpoint-flashcard-face checkpoint-back">
                <small>DEFINITION / ANSWER</small>
                <strong>{current?.definition}</strong>
                {current?.notes && <p className="flashcard-page-card-note">{current.notes}</p>}
                <em>Tap or press Space to return</em>
              </span>
            </span>
          </button>
        </div>
        <div className="session-controls"><button className="button button-outline" onClick={() => { setIndex((value) => Math.max(0, value - 1)); setFlipped(false); }} disabled={index === 0}><ArrowLeft size={16} /> Previous</button><button className="button button-outline" onClick={shuffleCards}><Shuffle size={16} /> Shuffle</button><button className="button button-outline" onClick={restartFlashcards}><RotateCcw size={16} /> Restart</button><button className="button button-outline" onClick={() => { if (index + 1 >= cards.length) setFinished(true); else setIndex((value) => value + 1); setFlipped(false); }} disabled={index === cards.length - 1}>Next <ArrowRight size={16} /></button></div>
        <div className="know-controls"><span>How well did you know it?</span><button className="button button-success" onClick={() => markCard(true)}><Check size={16} /> I know this</button><button className="button button-warning" onClick={() => markCard(false)}><RotateCcw size={15} /> Practice again</button></div>
        <p className="keyboard-hint">Keyboard: Space to flip · ← / → to navigate · K = known · R = review</p>
      </>)}

      {isLearnMode && <>
        <div className="session-heading"><span className="eyebrow">{mode === 'memorize' ? 'MEMORIZATION' : mode === 'cram' ? 'CRAM SESSION' : 'LEARN'} · {Math.min(index + 1, cards.length)} OF {cards.length}</span><h1>{mode === 'cram' ? 'Get ready for test day' : 'Build your recall'}<span className="accent-dot">.</span></h1><p>{mode === 'memorize' ? (options.level === 'advanced' ? 'Alternate multiple choice and written recall, with flashcard checkpoints.' : 'Practice with multiple choice, then review cards at each checkpoint.') : mode === 'cram' ? 'Move quickly through questions and reinforce the cards at each checkpoint.' : 'Practice actively, then revisit cards that need more work.'}</p></div>
        <div className="progress-track"><span style={{ width: `${(finished ? 1 : (index + (feedback || learnStep === 'checkpoint' ? 1 : 0)) / cards.length) * 100}%` }} /></div>
        {learnStep === 'checkpoint' && !finished && <div className="checkpoint-panel session-enter"><div className="checkpoint-heading"><span className="eyebrow">FLASHCARD CHECKPOINT · {checkpointIndex + 1} OF {checkpointCards.length}</span><h2>Review what you just practiced</h2><p>Flip each card, then mark whether it feels familiar.</p></div><div className="checkpoint-card-stage"><button className={`checkpoint-flashcard ${checkpointFlipped ? 'is-flipped' : ''}`} onClick={() => setCheckpointFlipped((value) => !value)} aria-label="Flip checkpoint flashcard"><span className="checkpoint-flashcard-inner"><span className="checkpoint-flashcard-face"><small>TERM / QUESTION</small><strong>{checkpointCard?.term}</strong><em>Tap to reveal</em></span><span className="checkpoint-flashcard-face checkpoint-back"><small>DEFINITION / ANSWER</small><strong>{checkpointCard?.definition}</strong><em>Tap to return</em></span></span></button></div><div className="checkpoint-controls"><button className="button button-warning" onClick={() => rateCheckpointCard(false)}><RotateCcw size={15} /> Needs practice</button><button className="button button-success" onClick={() => rateCheckpointCard(true)}><Check size={15} /> I know this</button></div></div>}
        {learnStep === 'question' && !finished && <div className="learn-card session-enter">
          <div className="learn-card-top"><span className="flashcard-side-label">QUESTION</span>{canWriteAnswers && <div className="test-mode-switch" aria-label="Choose answer style"><button type="button" className={learnQuestionType === 'choice' ? 'selected' : ''} disabled={cards.length < 2} onClick={() => { setLearnQuestionType('choice'); setFeedback(null); setLearnSelected(''); setTypedAnswer(''); }}>Multiple choice</button><button type="button" className={learnQuestionType === 'typed' ? 'selected' : ''} onClick={() => { setLearnQuestionType('typed'); setFeedback(null); setLearnSelected(''); setTypedAnswer(''); }}>Write answer</button></div>}</div>
          <h2>{current?.term}</h2>
          {!feedback ? <>
            {learnQuestionType === 'choice' ? (canUseLearnChoices ? <div className="choice-list learn-choice-list">{learnChoices.map((choice, choiceIndex) => <button type="button" key={choice.id} className="choice-option" onClick={() => submitLearnChoice(choice.id)}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice.definition}</button>)}</div> : <p className="inline-warning">This set does not have enough different answers for multiple choice on this card. Switch to Type answer to keep practicing.</p>) : <form onSubmit={(event) => { event.preventDefault(); submitLearnAnswer(); }}><label className="answer-label">Your answer<textarea value={typedAnswer} onChange={(event) => setTypedAnswer(event.target.value)} placeholder="Type the answer in your own words…" rows={3} required /></label><button className="button button-primary" disabled={!typedAnswer.trim()}>Check answer <Check size={16} /></button></form>}
            <button type="button" className="text-button" onClick={revealLearnAnswer}>Show answer instead</button>
          </> : <div className={`answer-feedback ${feedback}`}><div className="answer-feedback-title">{feedback === 'correct' ? <><CheckCircle2 size={19} /> Correct. Nice work!</> : feedback === 'skip' ? <>Answer revealed</> : <><XCircle size={19} /> Not quite. Keep practicing.</>}</div>{feedback !== 'skip' && learnQuestionType === 'choice' && <p className="learn-answer-note">{learnSelected === current?.id ? 'You selected the correct answer.' : 'The correct answer is highlighted below.'}</p>}<p>{current?.definition}</p>{current?.notes && <small>{current.notes}</small>}<button className="button button-primary" onClick={nextLearnCard}>{index === cards.length - 1 ? 'Finish session' : 'Next card'} <ArrowRight size={16} /></button></div>}
        </div>}
        {learnStep === 'question' && feedback && !finished && learnQuestionType === 'choice' && canUseLearnChoices && <div className="choice-list learn-choice-review">{learnChoices.map((choice, choiceIndex) => <div key={choice.id} className={`choice-option choice-review-option ${choice.id === current?.id ? 'correct-choice' : choice.id === learnSelected ? 'incorrect-choice' : ''}`}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice.definition}{choice.id === current?.id && <CheckCircle2 size={16} />}{choice.id === learnSelected && choice.id !== current?.id && <XCircle size={16} />}</div>)}</div>}
        {finished && <div className="results-panel session-enter"><div className="results-icon"><CheckCircle2 size={27} /></div><h2>Session complete</h2><p>You worked through {cards.length} cards. Keep revisiting the ones that need more practice.</p><div className="result-stats"><div><strong>{known.size}</strong><span>known</span></div><div><strong>{review.size}</strong><span>to review</span></div></div><button className="button button-primary" onClick={onClose}>Back to your set</button><button className="button button-outline" onClick={restartFlashcards}>Practice again</button></div>}
      </>}

      {mode === 'test' && (questions.length === 0 ? <div className="results-panel"><h2>No questions available</h2><button className="button button-outline" onClick={onClose}>Back to set</button></div> : testFinished ? <div className="results-panel session-enter"><div className="results-icon"><CheckCircle2 size={27} /></div><span className="eyebrow">TEST COMPLETE</span><h2>{answers.filter((answer) => answer?.correct).length} / {questions.length} correct</h2><p>Review the questions below, then retry whenever you're ready.</p><div className="test-review-list">{answers.filter(Boolean).map((answer, answerIndex) => <div className={`test-review-item ${answer.correct ? 'correct' : 'incorrect'}`} key={`${answer.card.id}-${answerIndex}`}><span>{answer.correct ? <CheckCircle2 size={15} /> : <XCircle size={15} />} {answer.card.term}</span>{!answer.correct && <small>Correct answer: {answer.card.definition}</small>}</div>)}</div><button className="button button-primary" onClick={() => resetTest(questionType, questionCount)}><RotateCcw size={16} /> Retry test</button><button className="button button-outline" onClick={onClose}>Back to set</button></div> : <>
        <div className="session-heading"><span className="eyebrow">QUESTION {testIndex + 1} OF {questions.length}</span><h1>Practice test<span className="accent-dot">.</span></h1><p>{questionType === 'choice' ? 'Select the best answer.' : 'Write the answer in your own words.'}</p></div>
        <div className="progress-track"><span style={{ width: `${(testIndex / questions.length) * 100}%` }} /></div>
        <div className="test-question session-enter"><div className="test-question-top"><span>{questionType === 'choice' ? 'MULTIPLE CHOICE' : 'WRITTEN RESPONSE'}</span><span className="test-answer-count">{answers.filter(Boolean).length} of {questions.length} answered</span></div><h2>{testQuestion?.card.term}</h2>
          {questionType === 'choice' ? (testQuestion?.choices.length > 1 ? <div className="choice-list">{testQuestion.choices.map((choice, choiceIndex) => <button type="button" key={choice.id} className={`choice-option ${selected === choice.id ? 'selected' : ''}`} onClick={() => answerTest(choice.id)}><span>{String.fromCharCode(65 + choiceIndex)}</span>{choice.definition}</button>)}</div> : <p className="inline-warning">This question does not have enough different answers for multiple choice.</p>) : <textarea className="test-typed-answer" rows={4} value={selected} onChange={(event) => setSelected(event.target.value)} placeholder="Type the definition or answer…" />}
          <div className="test-next-row"><button className="button button-outline" onClick={previousTestQuestion} disabled={testIndex === 0}><ArrowLeft size={15} /> Previous question</button><button className="button button-primary" disabled={!selected.trim() || (questionType === 'choice' && (testQuestion?.choices.length || 0) < 2)} onClick={submitTest}>{answers[testIndex] ? 'Update answer' : 'Submit answer'} <ArrowRight size={16} /></button></div>
        </div>
      </>)}

      {mode === 'match' && <>
        <div className="session-heading"><span className="eyebrow">MATCHING GAME</span><h1>Find the pairs<span className="accent-dot">.</span></h1><p>Choose a term and its matching definition. Match all pairs to finish.</p></div>
        {matchingFinished ? <div className="results-panel session-enter"><div className="results-icon"><CheckCircle2 size={27} /></div><h2>All matched!</h2><p>You matched {matched.size} pairs with {mistakes} mismatches.</p><div className="result-stats"><div><strong>{mistakes}</strong><span>mistakes</span></div><div><strong>{Math.round((clockNow - matchStartedAt) / 1000)}s</strong><span>time</span></div></div><button className="button button-primary" onClick={() => { setMatched(new Set()); setMistakes(0); setFirstMatch(null); setMatchStartedAt(Date.now()); setClockNow(Date.now()); setMatching(createMatching(cards)); }}>Play again</button><button className="button button-outline" onClick={onClose}>Back to set</button></div> : <>
          <div className="match-status"><span><CheckCircle2 size={15} /> {matched.size} / {matching.terms.length} pairs</span><span><XCircle size={15} /> {mistakes} mistakes</span><span><Clock3 size={15} /> {Math.round((clockNow - matchStartedAt) / 1000)} sec</span></div>
          <div className="matching-grid"><div className="matching-column">{matching.terms.map((item) => <button key={item.cardId} disabled={matched.has(item.cardId)} className={`match-tile ${matched.has(item.cardId) ? 'matched' : ''} ${firstMatch?.side === 'term' && firstMatch.item.cardId === item.cardId ? 'selected' : ''}`} onClick={() => chooseMatch('term', item)}>{item.text}</button>)}</div><div className="matching-column">{matching.definitions.map((item) => <button key={item.cardId} disabled={matched.has(item.cardId)} className={`match-tile ${matched.has(item.cardId) ? 'matched' : ''} ${firstMatch?.side === 'definition' && firstMatch.item.cardId === item.cardId ? 'selected' : ''}`} onClick={() => chooseMatch('definition', item)}>{item.text}</button>)}</div></div>
          <div className="match-actions"><button className="button button-outline" onClick={() => { setMatching(createMatching(cards)); setMatched(new Set()); setFirstMatch(null); setMistakes(0); setMatchStartedAt(Date.now()); setClockNow(Date.now()); }}><Shuffle size={15} /> Restart game</button></div>
        </>}
      </>}
    </div>
  );
}
