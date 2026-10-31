export function notifyCloudUpdated() {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('studydeck:cloud-updated'));
  }
}
