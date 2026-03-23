'use client';

import Link from 'next/link';

export function LandingPage() {
  return (
    <main className="landing-page">
      <div className="landing-backdrop" />
      <section className="landing-minimal">
        <Link href="/app?tab=today" className="landing-wordmark-link" aria-label="Open EgoLift app">
          <span className="landing-wordmark">EgoLift</span>
        </Link>
      </section>
    </main>
  );
}
