import './globals.css';
import AppShell from '@/components/AppShell';

export const metadata = {
  title: 'StudyDeck - Study smarter, for free',
  description: 'Create, import, and study flashcards for free. No account required. Your guest study sets stay in your browser.',
  applicationName: 'StudyDeck',
  icons: { icon: '/studydeck-mark.svg' },
  robots: { index: true, follow: true },
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" data-theme="dark">
      <body>
        <AppShell productLinkUrl={process.env.PRODUCT_LINK_URL || 'https://evtrg.com'}>{children}</AppShell>
        <script dangerouslySetInnerHTML={{ __html: `try { document.documentElement.dataset.theme = localStorage.getItem('studydeck-theme') || 'dark'; } catch (error) { document.documentElement.dataset.theme = 'dark'; }` }} />
      </body>
    </html>
  );
}
