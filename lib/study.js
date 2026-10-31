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

export function buildChoiceOptions(cards, correctCard) {
  if (!correctCard) return [];
  const correctAnswer = normalizeAnswer(correctCard.definition);
  const alternatives = cards.filter((card) => (
    card.id !== correctCard.id && normalizeAnswer(card.definition) !== correctAnswer
  ));
  return shuffleItems([correctCard, ...shuffleItems(alternatives).slice(0, Math.min(3, alternatives.length))]);
}


export function getMemorizationQuestionType(cards, index) {
  if (!Array.isArray(cards) || !Number.isInteger(index) || index < 0 || index >= cards.length) return 'typed';
  const card = cards[index];
  return index % 2 === 0 && buildChoiceOptions(cards, card).length > 1 ? 'choice' : 'typed';
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
