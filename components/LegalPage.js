import Link from 'next/link';
import { ArrowLeft, FileText } from 'lucide-react';

export default function LegalPage({ title, updated, children }) {
  const operator = process.env.APPLICATION_OPERATOR || '[APPLICATION OPERATOR]';
  const email = process.env.CONTACT_EMAIL || '[CONTACT EMAIL]';
  const effectiveDate = process.env.LEGAL_EFFECTIVE_DATE || '[EFFECTIVE DATE]';
  return (
    <div className="page-wrap narrow-page legal-wrap">
      <Link href="/" className="back-link"><ArrowLeft size={15} /> Back to study sets</Link>
      <div className="page-title-block"><span className="eyebrow"><FileText size={13} /> LEGAL INFORMATION</span><h1>{title}<span className="accent-dot">.</span></h1><p>Effective date: {effectiveDate}{updated ? ` · Last updated: ${updated}` : ''}</p></div>
      <div className="legal-document"><p><strong>Application operator:</strong> {operator}<br /><strong>Contact:</strong> {email}</p>{children}</div>
    </div>
  );
}
