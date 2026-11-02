'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  BookOpen, Cloud, Compass, LogIn, LogOut, Menu, X, ChevronDown,
  Trash2, UserRound, ScrollText, ShieldCheck, Cookie, Settings,
} from 'lucide-react';

export default function AppShell({ children, productLinkUrl = 'https://evtrg.com' }) {
  const pathname = usePathname();
  const [account, setAccount] = useState({ loading: true, user: null, cloudCount: 0 });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [authMessage, setAuthMessage] = useState('');
  const profileRef = useRef(null);

  const refreshAccount = useCallback(async () => {
    try {
      const response = await fetch('/api/auth/me', { cache: 'no-store' });
      const data = await response.json();
      setAccount({ loading: false, user: data.user || null, cloudCount: Number(data.cloudCount) || 0 });
    } catch {
      setAccount((current) => ({ loading: false, user: current.user, cloudCount: current.cloudCount }));
    }
  }, []);

  useEffect(() => {
    refreshAccount();
    document.querySelectorAll('.legal-nav-menu, .profile-menu').forEach((menu) => menu.removeAttribute('open'));
    const onCloudUpdated = () => refreshAccount();
    const onVisible = () => { if (document.visibilityState === 'visible') refreshAccount(); };
    window.addEventListener('studydeck:cloud-updated', onCloudUpdated);
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    const params = new URLSearchParams(window.location.search);
    if (params.get('auth') === 'failed') setAuthMessage('Discord sign-in did not complete. Please try again.');
    if (params.get('auth') === 'not-configured') setAuthMessage('Discord sign-in has not been configured by the operator yet.');
    if (params.has('auth')) {
      params.delete('auth');
      const nextUrl = `${window.location.pathname}${params.toString() ? `?${params}` : ''}`;
      window.history.replaceState({}, '', nextUrl);
    }
    return () => {
      window.removeEventListener('studydeck:cloud-updated', onCloudUpdated);
      window.removeEventListener('focus', onVisible);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshAccount, pathname]);

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' });
    setAccount({ loading: false, user: null, cloudCount: 0 });
    window.location.href = '/';
  }

  async function deleteAccount() {
    const confirmation = window.prompt('This permanently deletes your Discord account and cloud study sets. Your local sets will remain. Type DELETE to continue.');
    if (confirmation !== 'DELETE') return;
    const response = await fetch('/api/account/delete', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ confirm: 'DELETE' }),
    });
    const data = await response.json();
    if (!response.ok) {
      setAuthMessage(data.error || 'Account deletion failed. Please try again.');
      return;
    }
    window.location.href = '/?account=deleted';
  }

  const nav = (
    <>
      <Link href="/" className="nav-link" onClick={() => setMobileOpen(false)}><BookOpen size={16} /> My Study Sets</Link>
      <Link href="/import" className="nav-link" onClick={() => setMobileOpen(false)}><Compass size={16} /> Create a Set</Link>
      <details className="legal-nav-menu">
        <summary className="nav-link"><ScrollText size={16} /> Legal <ChevronDown size={13} /></summary>
        <div className="legal-nav-popover">
          <Link href="/legal/terms" onClick={() => setMobileOpen(false)}><ScrollText size={15} /> Terms of Service</Link>
          <Link href="/legal/privacy" onClick={() => setMobileOpen(false)}><ShieldCheck size={15} /> Privacy Policy</Link>
          <Link href="/legal/cookies" onClick={() => setMobileOpen(false)}><Cookie size={15} /> Cookie Policy</Link>
        </div>
      </details>
    </>
  );

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="StudyDeck home">
            <span className="brand-mark"><BookOpen size={18} strokeWidth={2.4} /></span>
            <span>studydeck<span className="brand-period">.</span></span>
          </Link>
          <nav className="desktop-nav">{nav}</nav>
          <div className="topbar-actions">
            {account.user ? (
              <div className="account-area">
                <Link href="/#cloud-storage" className="cloud-usage" title="View Discord cloud storage"><Cloud size={14} /> {account.cloudCount}/3</Link>
                <details className="profile-menu" ref={profileRef}>
                  <summary aria-label="Open account menu">
                    {account.user.avatarUrl ? <img className="avatar avatar-image" src={account.user.avatarUrl} alt="" /> : <span className="avatar">{account.user.displayName?.slice(0, 1)?.toUpperCase() || 'D'}</span>}
                    <span className="account-name">{account.user.displayName}</span>
                    <ChevronDown size={14} />
                  </summary>
                  <div className="profile-popover">
                    <div className="profile-popover-heading">
                      {account.user.avatarUrl ? <img className="avatar avatar-image" src={account.user.avatarUrl} alt="" /> : <span className="avatar"><UserRound size={15} /></span>}
                      <div><strong>{account.user.displayName}</strong><small>Discord account · {account.cloudCount}/3 cloud sets</small></div>
                    </div>
                    <Link href="/settings" onClick={() => profileRef.current?.removeAttribute('open')}><Settings size={15} /> Account settings</Link>
                    <button type="button" onClick={signOut}><LogOut size={15} /> Log out</button>
                    <div className="profile-menu-divider" />
                    <button type="button" className="profile-delete-action" onClick={deleteAccount}><Trash2 size={15} /> Delete account</button>
                  </div>
                </details>
              </div>
            ) : (
              <details className="profile-menu guest-profile-menu" ref={profileRef}>
                <summary aria-label="Open guest menu">
                  <span className="avatar">G</span>
                  <span className="account-name">Guest</span>
                  <ChevronDown size={14} />
                </summary>
                <div className="profile-popover">
                  <div className="profile-popover-heading"><span className="avatar">G</span><div><strong>Guest</strong><small>Your sets are stored on this device</small></div></div>
                  <Link href="/settings" onClick={() => profileRef.current?.removeAttribute('open')}><Settings size={15} /> Settings</Link>
                  <a href="/api/auth/discord"><LogIn size={15} /> Sign in with Discord</a>
                </div>
              </details>
            )}
            <button className="icon-button mobile-menu-button" aria-label={mobileOpen ? 'Close navigation' : 'Open navigation'} onClick={() => setMobileOpen((value) => !value)}>
              {mobileOpen ? <X size={19} /> : <Menu size={19} />}
            </button>
          </div>
        </div>
        {mobileOpen && <nav className="mobile-nav">{nav}</nav>}
      </header>
      {authMessage && <div className="auth-notice" role="status">{authMessage}<button onClick={() => setAuthMessage('')} aria-label="Dismiss">×</button></div>}
      <main className="main-content">{children}</main>
      <footer className="site-footer">
        <span>StudyDeck is free to use. Guest study sets stay in this browser.</span>
        <div><Link href="/legal/terms">Terms</Link><Link href="/legal/privacy">Privacy</Link><Link href="/legal/cookies">Cookies</Link></div>
        <a className="product-credit" href={productLinkUrl || 'https://evtrg.com'} target="_blank" rel="noreferrer">A Eventrigger Byproduct</a>
      </footer>
    </div>
  );
}
