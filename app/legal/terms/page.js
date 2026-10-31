import LegalPage from '@/components/LegalPage';

export const metadata = { title: 'Terms of Service | StudyDeck' };

export default function TermsPage() {
  return <LegalPage title="Terms of Service">
    <h2>1. Agreement and eligibility</h2>
    <p>These Terms of Service govern your use of StudyDeck (the “Service”), operated by the application operator identified above. By accessing or using the Service, you agree to these terms. Do not use the Service if you do not agree. You must be legally able to accept these terms under the laws that apply to you. If you are using the Service on behalf of another person or organization, you confirm that you have authority to bind them.</p>
    <h2>2. What the Service provides</h2>
    <p>StudyDeck provides tools to create, import, organize, export, and study flashcards. Core features are available without an account. Guest study sets are stored in browser IndexedDB on the device and browser where they are created. Optional Discord sign-in enables cloud storage for up to three study sets per account. This limit applies to cloud-saved sets, not local sets. Updating a cloud set does not consume another slot. The Service is free and does not offer paid plans, subscriptions, or paid feature tiers.</p>
    <h2>3. Your content and responsibilities</h2>
    <p>You retain whatever rights you have in the text, documents, images, flashcards, and other material you submit (“User Content”). You are responsible for having the rights and permissions needed to use and share User Content. You grant the operator only the limited permission needed to host, transmit, back up, and display User Content that you explicitly choose to save to cloud storage, and to provide the features you request. This permission ends when the relevant cloud content is deleted, subject to backup and legal retention requirements described in the Privacy Policy.</p>
    <p>You must not use the Service to violate laws or third-party rights, distribute malware, interfere with the Service, attempt unauthorized access, abuse Discord OAuth, upload unlawful content, or submit content that you are not permitted to store. Do not use the Service to harass, threaten, exploit, or harm others.</p>
    <h2>4. Importing documents</h2>
    <p>Supported document and spreadsheet imports are processed in your browser where practical. The original imported file is not intentionally uploaded to the Service merely to extract flashcards. You are responsible for reviewing all extracted text and generated cards for accuracy before studying or sharing them. Import parsing may not preserve formatting, tables, images, formulas, or every feature of the original document. Some legacy formats may require conversion before import.</p>
    <h2>5. Accounts and cloud storage</h2>
    <p>Discord sign-in is optional. You are responsible for maintaining control of your Discord account and for activity performed through your StudyDeck account. The Service uses the Discord identity permission only; it does not request access to your servers or messages. You may sign out or request account deletion through the account menu.</p>
    <p>Each Discord account may store up to three cloud study sets. A cloud set may contain up to 500 cards, subject to request validation and reasonable service limits. The operator may enforce additional file, request, abuse-prevention, or operational limits to protect the Service. Cloud copies are stored on the operator's server. Local and cloud copies are separate: deleting a local copy does not delete the cloud copy, and deleting a cloud copy does not delete a local copy.</p>
    <h2>6. Suspension and termination</h2>
    <p>The operator may restrict, suspend, or terminate access when reasonably necessary to address abuse, security threats, legal requirements, service disruption, or violations of these terms. Where practical, the operator will provide notice. You may stop using the Service at any time and may delete your account using the available account controls.</p>
    <h2>7. Availability, backups, and data loss</h2>
    <p>The Service is provided without a guarantee of uninterrupted availability. Browser-local data can be lost if browser storage is cleared, the browser profile is removed, a device fails, or a browser evicts site data. The operator cannot restore guest data because guest study content is not sent to the backend. You are responsible for exporting local backups. Cloud availability depends on server and storage operations; cloud storage is not a guaranteed archival backup.</p>
    <h2>8. Disclaimers</h2>
    <p>To the maximum extent permitted by applicable law, the Service is provided “as is” and “as available,” without warranties of any kind, express or implied. Study material and automatically extracted flashcards may contain errors. You are responsible for checking the accuracy and suitability of educational content.</p>
    <h2>9. Limitation of liability</h2>
    <p>To the maximum extent permitted by applicable law, the operator will not be liable for indirect, incidental, special, consequential, exemplary, or punitive damages, or loss of data, profits, goodwill, or use arising from the Service. Nothing in these terms excludes liability that cannot lawfully be excluded. Nothing in these terms limits liability where a limitation is not permitted by applicable law.</p>
    <h2>10. Changes to the Service or terms</h2>
    <p>The operator may modify, suspend, or discontinue features and may update these terms. Material changes should be accompanied by an updated effective date or another reasonable notice. Continued use after updated terms take effect means you accept the changes, to the extent permitted by law.</p>
    <h2>11. Contact</h2>
    <p>Questions about these terms may be sent to {process.env.CONTACT_EMAIL || '[CONTACT EMAIL]'}.</p>
  </LegalPage>;
}
