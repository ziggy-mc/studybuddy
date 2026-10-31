import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Cookie Policy | StudyDeck' };

export default function CookiesPage() {
  return <LegalPage title="Cookie Policy">
    <h2>1. Overview</h2>
    <p>StudyDeck is designed to work without advertising or analytics cookies. Guest study features use IndexedDB, a browser storage technology, rather than cookies. Cookies are used only when needed for optional Discord authentication and its OAuth flow.</p>
    <h2>2. Authentication session cookie</h2>
    <p>After a successful Discord sign-in, the Service sets an HTTP-only cookie named <code>studydeck_session</code>. It contains a random session token and is used to authenticate requests for cloud storage and account management. The server stores a SHA-256 hash of the token rather than the raw cookie value. The configured maximum cookie lifetime is 30 days. The cookie is marked SameSite=Lax and should be marked Secure in production over HTTPS.</p>
    <h2>3. OAuth state cookie</h2>
    <p>When you begin Discord sign-in, the Service sets a short-lived HTTP-only cookie named <code>studydeck_oauth_state</code>. It contains a random state value used to validate the OAuth callback and reduce cross-site request forgery risk. Its configured maximum lifetime is 10 minutes. It is cleared after the callback is handled.</p>
    <h2>4. Other browser storage</h2>
    <p>Guest study sets, flashcards, notes, starred status, and study progress are stored in IndexedDB. Theme preference is stored in localStorage. These technologies are not cookies, but they store information in your browser. Clearing browser site data may remove this information. Export your study sets before clearing site data if you need a backup.</p>
    <h2>5. Analytics and third-party cookies</h2>
    <p>The application code does not add third-party analytics, advertising scripts, or advertising cookies. Discord is contacted when you choose to sign in. Discord's own website and authentication flow may set cookies under Discord's domain and are governed by Discord's policies.</p>
    <h2>6. Managing cookies and storage</h2>
    <p>You can manage or delete cookies and site data in your browser settings. Blocking authentication cookies will prevent Discord sign-in and cloud-storage access, but guest study features should continue to work. Clearing IndexedDB or localStorage may remove local sets or appearance preferences. Browser-specific controls and behavior vary.</p>
    <h2>7. Changes and contact</h2>
    <p>Questions about cookies may be sent to {process.env.CONTACT_EMAIL || '[CONTACT EMAIL]'}.</p>
  </LegalPage>;
}
