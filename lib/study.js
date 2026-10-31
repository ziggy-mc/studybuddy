export function shuffleItems(items) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(Math.random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function normalizeAnswer(value) {
  return String(value || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
}

export function resolveAnswerSide(direction = 'definition') {
  if (direction === 'term') return 'term';
  if (direction === 'random') return Math.random() < 0.5 ? 'term' : 'definition';
  return 'definition';
}

export function getQuestionText(card, answerSide = 'definition') {
  if (!card) return '';
  return answerSide === 'term' ? card.definition : card.term;
}

export function getAnswerText(card, answerSide = 'definition') {
  if (!card) return '';
  return answerSide === 'term' ? card.term : card.definition;
}

/**
 * Select a fresh random question subset. When there are more available cards
 * than the requested count, at least one card from the previous run is
 * replaced so retrying a short test cannot silently repeat the same questions.
 */
export function selectQuestionCards(cards, count, previousCardIds = []) {
  const available = Array.isArray(cards) ? cards : [];
  const requestedCount = Math.max(0, Math.min(Number(count) || available.length, available.length));
  if (!requestedCount) return [];

  const shuffled = shuffleItems(available);
  const previousIds = new Set(previousCardIds);
  if (!previousIds.size) return shuffled.slice(0, requestedCount);

  if (requestedCount >= available.length) {
    const nextOrder = shuffled.slice(0, requestedCount);
    const isSameOrder = nextOrder.every((card, index) => card.id === previousCardIds[index]);
    if (isSameOrder && nextOrder.length > 1) nextOrder.push(nextOrder.shift());
    return nextOrder;
  }

  const freshCards = shuffled.filter((card) => !previousIds.has(card.id));
  if (!freshCards.length) return shuffled.slice(0, requestedCount);

  // Prefer a completely new question group when enough unseen cards remain.
  if (freshCards.length >= requestedCount) return freshCards.slice(0, requestedCount);

  // Once the unseen pool is smaller than the requested count, use every
  // unseen card and fill the rest from the prior group or earlier attempts.
  const freshIds = new Set(freshCards.map((card) => card.id));
  const previouslySeen = shuffleItems(shuffled.filter((card) => !freshIds.has(card.id)));
  return shuffleItems([...freshCards, ...previouslySeen.slice(0, requestedCount - freshCards.length)]);
}

export function buildChoiceOptions(cards, correctCard, answerSide = 'definition') {
  if (!correctCard) return [];
  const correctAnswer = normalizeAnswer(getAnswerText(correctCard, answerSide));
  const alternatives = cards.filter((card) => (
    card.id !== correctCard.id && normalizeAnswer(getAnswerText(card, answerSide)) !== correctAnswer
  ));
  return shuffleItems([correctCard, ...shuffleItems(alternatives).slice(0, Math.min(3, alternatives.length))]);
}


export function getMemorizationQuestionType(cards, index, answerSide = 'definition') {
  if (!Array.isArray(cards) || !Number.isInteger(index) || index < 0 || index >= cards.length) return 'typed';
  const card = cards[index];
  return index % 2 === 0 && buildChoiceOptions(cards, card, answerSide).length > 1 ? 'choice' : 'typed';
}

export function getCheckpointCards(cards, completedCount, interval = 7) {
  if (!Array.isArray(cards) || !Number.isInteger(completedCount) || completedCount < 1 || completedCount > cards.length || !Number.isInteger(interval) || interval < 1) {
    return [];
  }
  const isCheckpoint = completedCount % interval === 0 || completedCount === cards.length;
  if (!isCheckpoint) return [];
  const startIndex = Math.floor((completedCount - 1) / interval) * interval;
  return cards.slice(startIndex, completedCount);
}
