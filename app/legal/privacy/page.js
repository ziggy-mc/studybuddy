import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Privacy Policy | StudyDeck' };

export default function PrivacyPage() {
  return <LegalPage title="Privacy Policy">
    <h2>1. Overview</h2>
    <p>This policy explains how StudyDeck handles information when you use the Service. Guest mode is local-first: study sets and imported document contents are stored in your browser and are not sent to the StudyDeck backend. Cloud storage is optional and requires Discord sign-in plus an explicit action to save a set.</p>
    <h2>2. Guest mode and browser storage</h2>
    <p>When you use StudyDeck without signing in, the application stores study sets, cards, notes, starred status, and study progress in IndexedDB in your browser. This data remains under the browser profile on your device. The application does not require an email address or personal information for guest use and does not transmit guest study content to its backend. Browser storage may be removed when you clear site data, reset your browser profile, or use browser settings that remove stored data. Export your sets to keep a separate backup.</p>
    <h2>3. Imported documents</h2>
    <p>Document and spreadsheet parsing is performed in your browser using client-side parsing libraries. The selected file is read locally to extract text or rows. The original document is not uploaded to the StudyDeck server for parsing. If you choose to save resulting flashcards to cloud storage, the flashcard data you approved is sent to the Service; the original document is not included in that request.</p>
    <h2>4. Discord sign-in information</h2>
    <p>If you choose Discord sign-in, StudyDeck requests the Discord <code>identify</code> scope. The Service receives your Discord user ID, username or global display name, and avatar hash from Discord. These details are stored to identify your account and display basic account information. StudyDeck does not request Discord server membership, messages, contacts, or other unnecessary permissions. OAuth access tokens are used for the sign-in exchange and are not intentionally retained after the profile is retrieved.</p>
    <h2>5. Cloud study sets and database records</h2>
    <p>When you explicitly save a study set to cloud storage, StudyDeck stores the set title, description, card terms, definitions, notes, starred status, order, owner account identifier, and creation/update timestamps in a SQLite database. Up to three cloud sets can be stored per Discord account. Updating a saved set replaces its stored card records without using an additional slot. The server enforces ownership checks and the three-set limit.</p>
    <p>The database stores study-set content so the cloud feature can work. This application code does not encrypt SQLite study-set fields or account identifiers at the application layer. Operators should protect the database and backups using secure host access, disk-level encryption where available, restrictive file permissions, HTTPS, and appropriate backup controls. Do not describe the database itself as encrypted unless the deployment actually provides that protection.</p>
    <h2>6. Cookies and sessions</h2>
    <p>Discord sign-in uses an HTTP-only session cookie with a 30-day maximum lifetime and a short-lived OAuth state cookie during sign-in. The cookies are used for authentication, session continuity, and OAuth request validation. The Secure attribute should be enabled in production over HTTPS using the deployment configuration. Guest mode does not require an authentication cookie. See the separate Cookie Policy for details.</p>
    <h2>7. Logs, hosting, and service providers</h2>
    <p>The application may process ordinary network and security metadata such as IP address information, request paths, timestamps, and error details through the hosting provider, reverse proxy, or server logs. The code does not add third-party advertising or analytics scripts. Discord is involved when you initiate Discord OAuth. The operator's hosting provider, infrastructure provider, or backup provider may process data as needed to operate the Service.</p>
    <h2>8. Sharing</h2>
    <p>The operator does not sell personal information. Cloud account and study-set information is not made public by this application. Information may be disclosed when required by law, to respond to valid legal process, to protect users or the Service, or to a service provider acting for the operator under appropriate safeguards. Any additional sharing practices must be disclosed here before they are introduced.</p>
    <h2>9. Retention and deletion</h2>
    <p>Guest study content remains in the browser until you delete it, clear browser storage, or the browser removes it. The operator cannot delete guest data remotely because it is not stored on the server. You can export or clear local sets in Settings. Cloud study sets remain until you delete them or delete your account. Account deletion removes the account, associated cloud study sets, and database sessions through foreign-key cascading. Backups, logs, and records that must be retained for security, legal, or operational purposes may persist for a limited period.</p>
    <h2>10. Security</h2>
    <p>The application uses server-side Discord OAuth, HTTP-only session cookies, hashed session tokens in the database, parameterized database queries, server-side validation, per-user ownership checks, foreign-key enforcement, and a server-side three-set limit. These measures reduce risk but cannot guarantee absolute security. Production deployment should use HTTPS, secure cookie configuration, restricted server access, persistent protected storage, backups, dependency updates, and appropriate monitoring.</p>
    <h2>11. Your choices</h2>
    <p>You can use guest mode without creating an account, choose whether to save specific sets to the cloud, export your local library, clear local application data, delete cloud sets, sign out, or delete your Discord-linked account. Depending on your location, you may have additional privacy rights. Requests can be sent to the contact shown above.</p>
    <h2>12. Children and education</h2>
    <p>You are responsible for meeting the age requirements that apply to your use of Discord and the Service. Do not use the Service in a way that violates applicable school, parental-consent, or data-protection requirements.</p>
    <h2>13. Changes and contact</h2>
    <p>This policy may be updated when data practices change. For questions or privacy requests, contact {process.env.CONTACT_EMAIL || '[CONTACT EMAIL]'}.</p>
  </LegalPage>;
}
