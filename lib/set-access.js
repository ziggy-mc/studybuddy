import { deleteSet, getSet } from '@/lib/storage';

/**
 * Load a set from IndexedDB first. Cloud sets are fetched directly from the
 * owner-checked API and are never copied into browser storage. Old local cloud
 * mirrors from earlier app versions are removed and resolved by their cloud ID.
 */
export async function loadStudySet(id) {
  const local = await getSet(id);
  if (local && !local.cloudId && local.source !== 'cloud') {
    return { set: local, kind: 'local' };
  }

  const cloudId = local?.cloudId || id;
  if (local?.cloudId) {
    await deleteSet(local.id);
  }

  const response = await fetch(`/api/cloud/sets/${encodeURIComponent(cloudId)}`, { cache: 'no-store' });
  if (!response.ok) {
    return { set: null, kind: 'cloud', error: 'This study set does not exist.' };
  }
  const data = await response.json();
  if (!data.set?.id) return { set: null, kind: 'cloud', error: 'This study set does not exist.' };
  return { set: { ...data.set, source: 'cloud', cloudId: data.set.id }, kind: 'cloud' };
}
