'use client';
import { useState } from 'react';

export default function Page() {
  const [busy, setBusy] = useState(null);
  const [message, setMessage] = useState('');
  async function download(id) {
    setBusy(id);
    setMessage('Requesting a download link...');
    try {
      const response = await fetch(`/api/downloads/${id}`, { cache: 'no-store', credentials: 'same-origin' });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      setMessage('Download requested. If it does not start, check the Spaces error in the new page.');
      window.location.assign(result.url);
    } catch (error) {
      setMessage(error.message || 'The request failed. Try again.');
    } finally {
      setBusy(null);
    }
  }
  return <main>
    <p className="eyebrow">Local rehearsal</p>
    <h1>Private downloads, one owner per file.</h1>
    <p>Sign in as iris or milo with the password you set in .env.local. Then choose a file.</p>
    {/* Full navigation is intentional: the browser must handle the Basic Auth challenge. */}
    <form action="/login" method="get"><button type="submit">Sign in to the demo</button></form>
    <div className="downloads">
      {['iris', 'milo'].map((owner) => <section key={owner}>
        <h2>{owner === 'iris' ? "Iris's report" : "Milo's report"}</h2>
        <p>Only {owner} can request this file. The other account should receive &quot;File not found.&quot;</p>
        <button disabled={busy !== null} onClick={() => download(`${owner}-report`)}>
          {busy === `${owner}-report` ? 'Requesting...' : 'Download report'}
        </button>
      </section>)}
    </div>
    <p role="status" aria-live="polite">{message}</p>
    <p className="note">A link works for anyone who has it until it expires. This demo uses a 60-second expiry. Start a separate browser profile to test the other account, since browsers remember Basic Auth credentials.</p>
    <p className="note">Use harmless sample files. This demo is for localhost and needs production authentication and rate limiting before public deployment.</p>
  </main>;
}
