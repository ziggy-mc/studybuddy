'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Cloud, Download, HardDrive, LogOut, Moon, Sun, Trash2, UploadCloud, UserRound, ShieldCheck } from 'lucide-react';
import { clearAllLocalData, estimateStorage, getAllSets, saveSet } from '@/lib/storage';
import { exportLibrary, importLibraryFile } from '@/lib/export';

function formatBytes(bytes) {
  if (!Number.isFinite(bytes)) return 'Unavailable';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export default function SettingsPanel() {
  const fileRef = useRef(null);
  const [sets, setSets] = useState([]);
  const [usage, setUsage] = useState(null);
  const [account, setAccount] = useState(null);
  const [cloudCount, setCloudCount] = useState(0);
  const [theme, setTheme] = useState('dark');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const [localSets, storage, meResponse] = await Promise.all([
      getAllSets(), estimateStorage(), fetch('/api/auth/me', { cache: 'no-store' }),
    ]);
    const me = await meResponse.json();
    setSets(localSets);
    setUsage(storage);
    setAccount(me.user || null);
    setCloudCount(me.cloudCount || 0);
  }

  useEffect(() => {
    refresh().catch((loadError) => setError(loadError.message || 'Could not read settings.'));
    const currentTheme = localStorage.getItem('studydeck-theme') || 'dark';
    setTheme(currentTheme);
  }, []);

  function changeTheme(value) {
    setTheme(value);
    localStorage.setItem('studydeck-theme', value);
    document.documentElement.dataset.theme = value;
  }

  async function importBackup(file) {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const incoming = await importLibraryFile(file);
      for (const set of incoming) await saveSet(set);
      setMessage(`Imported ${incoming.length} study set${incoming.length === 1 ? '' : 's'} into this browser.`);
      await refresh();
    } catch (importError) {
      setError(importError.message || 'Could not import this backup.');
    } finally {
      setBusy(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  async function clearLocal() {
    if (!window.confirm('Clear every locally stored StudyDeck set from this browser? This cannot be undone. Cloud copies will remain in your Discord account. Export a backup first if you need one.')) return;
    await clearAllLocalData();
    setMessage('All local study sets were cleared. Cloud sets were not changed.');
    await refresh();
  }

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/';
  }

  async function deleteAccount() {
    const confirmText = window.prompt('This permanently deletes your Discord account and all cloud study sets. Your browser-local sets will remain. Type DELETE to continue.');
    if (confirmText !== 'DELETE') return;
    setBusy(true);
    const response = await fetch('/api/account/delete', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ confirm: 'DELETE' }) });
    const data = await response.json();
    setBusy(false);
    if (!response.ok) return setError(data.error || 'Account deletion failed.');
    window.location.href = '/?account=deleted';
  }

  return (
    <div className="page-wrap narrow-page">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to your library</Link>
      <div className="page-title-block"><span className="eyebrow">PREFERENCES</span><h1>Settings<span className="accent-dot">.</span></h1><p>Manage your appearance, browser data, and optional Discord account.</p></div>
      {message && <div className="notice success-notice">{message}<button onClick={() => setMessage('')}>×</button></div>}
      {error && <div className="notice error-notice">{error}<button onClick={() => setError('')}>×</button></div>}

      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Moon size={18} /></div><div><h2>Appearance</h2><p>Choose the look that feels comfortable to study in.</p></div></div><div className="theme-options"><button className={`theme-choice ${theme === 'dark' ? 'active' : ''}`} onClick={() => changeTheme('dark')}><span className="theme-swatch dark-swatch"><Moon size={17} /></span><strong>Dark</strong><small>Low-glare dark surfaces</small></button><button className={`theme-choice ${theme === 'light' ? 'active' : ''}`} onClick={() => changeTheme('light')}><span className="theme-swatch light-swatch"><Sun size={17} /></span><strong>Light</strong><small>Bright, clean surfaces</small></button></div></section>

      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><HardDrive size={18} /></div><div><h2>Local browser storage</h2><p>Guest study sets are stored in IndexedDB on this device only.</p></div></div><div className="storage-stats"><div><strong>{sets.length}</strong><span>local study sets</span></div><div><strong>{usage ? formatBytes(usage.usage || 0) : '—'}</strong><span>estimated browser storage used</span></div><div><strong>{usage && usage.quota ? formatBytes(usage.quota) : '—'}</strong><span>estimated browser quota</span></div></div><div className="settings-actions"><button className="button button-outline" onClick={() => exportLibrary(sets)} disabled={!sets.length}><Download size={15} /> Export all local sets</button><button className="button button-outline" onClick={() => fileRef.current?.click()} disabled={busy}><UploadCloud size={15} /> Import library backup</button><input ref={fileRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={(event) => importBackup(event.target.files?.[0])} /></div><div className="settings-warning"><ShieldCheck size={16} /><span>Clearing browser data or using a different browser may remove local sets. Export a JSON backup to move or protect your work.</span></div><button className="text-danger-button" onClick={clearLocal}><Trash2 size={15} /> Clear all local application data</button></section>

      <section className="settings-card"><div className="settings-card-heading"><div className="settings-icon"><Cloud size={18} /></div><div><h2>Discord cloud storage</h2><p>Optional backup for up to three study sets. Uploads happen only when you choose to save a set.</p></div></div>{account ? <><div className="account-summary"><div className="account-avatar"><UserRound size={20} /></div><div><strong>{account.displayName}</strong><span>Discord account · Created {new Date(account.createdAt).toLocaleDateString()}</span></div><span className="cloud-counter"><Cloud size={14} /> {cloudCount}/3</span></div><div className="settings-actions"><button className="button button-outline" onClick={signOut}><LogOut size={15} /> Sign out</button><button className="button button-danger-outline" onClick={deleteAccount} disabled={busy}><Trash2 size={15} /> Delete account</button></div><p className="helper-text">Deleting your account removes cloud study sets and account records. Your browser-local sets are not deleted.</p></> : <div className="account-summary"><div className="account-avatar"><Cloud size={20} /></div><div><strong>Not signed in</strong><span>Guest mode has every study and import feature.</span></div><a href="/api/auth/discord" className="button button-primary button-small">Sign in with Discord</a></div>}</section>

      <section className="settings-card settings-legal"><div className="settings-card-heading"><div className="settings-icon"><ShieldCheck size={18} /></div><div><h2>Policies and your data</h2><p>Read how the application handles local and cloud information.</p></div></div><div className="legal-links"><Link href="/legal/terms">Terms of Service</Link><Link href="/legal/privacy">Privacy Policy</Link><Link href="/legal/cookies">Cookie Policy</Link></div></section>
    </div>
  );
}
