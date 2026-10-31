export function cleanText(value, maxLength = 5000) {
  if (typeof value !== 'string') return '';
  return value.replace(/\u0000/g, '').trim().slice(0, maxLength);
}

export function validateSet(input) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { error: 'Invalid study set.' };
  const title = cleanText(input.title, 120);
  const description = cleanText(input.description, 1000);
  const category = cleanText(input.category, 80) || 'Uncategorized';
  const tags = Array.isArray(input.tags)
    ? [...new Set(input.tags.slice(0, 20).map((tag) => cleanText(tag, 40)).filter(Boolean))]
    : [];
  if (!title) return { error: 'A study set title is required.' };
  if (!Array.isArray(input.cards) || input.cards.length < 1 || input.cards.length > 500) {
    return { error: 'A study set must contain between 1 and 500 cards.' };
  }

  const cards = [];
  for (let index = 0; index < input.cards.length; index += 1) {
    const item = input.cards[index];
    if (!item || typeof item !== 'object' || Array.isArray(item)) return { error: `Card ${index + 1} is invalid.` };
    const term = cleanText(item.term, 2000);
    const definition = cleanText(item.definition, 5000);
    if (!term || !definition) return { error: `Card ${index + 1} needs both a term and a definition.` };
    cards.push({
      id: cleanText(item.id, 80) || crypto.randomUUID(),
      term,
      definition,
      notes: cleanText(item.notes, 2000),
      starred: Boolean(item.starred),
      order: index,
    });
  }
  if (new Set(cards.map((card) => card.id)).size !== cards.length) return { error: 'Each flashcard must have a unique identifier. Please refresh and retry.' };

  const rawProgress = input.progress && typeof input.progress === 'object' && !Array.isArray(input.progress) ? input.progress : {};
  const cardIds = new Set(cards.map((card) => card.id));
  const known = Array.isArray(rawProgress.known) ? [...new Set(rawProgress.known.filter((id) => typeof id === 'string' && cardIds.has(id)))].slice(0, 500) : [];
  const knownSet = new Set(known);
  const review = Array.isArray(rawProgress.review) ? [...new Set(rawProgress.review.filter((id) => typeof id === 'string' && cardIds.has(id) && !knownSet.has(id)))].slice(0, 500) : [];
  const attempts = Number.isSafeInteger(rawProgress.attempts) && rawProgress.attempts >= 0 ? Math.min(rawProgress.attempts, 1000000000) : 0;
  const correct = Number.isSafeInteger(rawProgress.correct) && rawProgress.correct >= 0 ? Math.min(rawProgress.correct, attempts) : 0;
  return { value: { title, description, category, tags, cards, progress: { known, review, attempts, correct } } };
}
