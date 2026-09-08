import './style.css';

export const metadata = {
  title: 'Private download rehearsal',
  description: 'Test ownership checks and expiring Spaces download links locally.',
  robots: { index: false, follow: false },
  referrer: 'no-referrer',
};
export default function Layout({ children }) {
  return <html lang="en"><body>{children}</body></html>;
}
