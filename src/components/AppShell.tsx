'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/lib/context';
import { Onboarding } from './Onboarding';
import { ProgramBrowser } from './ProgramBrowser';
import { Today } from './Today';
import { WorkoutLogger } from './WorkoutLogger';
import { History } from './History';
import { Settings } from './Settings';

export type Tab = 'overview' | 'today' | 'calendar' | 'settings';

type AppShellProps = {
    initialTab?: Tab;
};

const navItems: Array<{ tab: Tab; label: string }> = [
    { tab: 'overview', label: 'Overview' },
    { tab: 'today', label: 'Today' },
    { tab: 'calendar', label: 'Calendar' },
    { tab: 'settings', label: 'Settings' },
];

function NavIcon({ tab }: { tab: Tab }) {
    switch (tab) {
        case 'overview':
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M5.5 6.5h5v5h-5ZM13.5 6.5h5v5h-5ZM5.5 13.5h5v5h-5ZM13.5 13.5h5v5h-5Z" />
                </svg>
            );
        case 'today':
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 5.5v13M7 10.5 12 5.5l5 5M8.5 18.5h7" />
                </svg>
            );
        case 'calendar':
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M7 4.5v3M17 4.5v3M5.5 8.5h13M6.5 6.5h11A1.5 1.5 0 0 1 19 8v9.5A1.5 1.5 0 0 1 17.5 19h-11A1.5 1.5 0 0 1 5 17.5V8A1.5 1.5 0 0 1 6.5 6.5Z" />
                </svg>
            );
        case 'settings':
            return (
                <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M12 9.25A2.75 2.75 0 1 0 12 14.75 2.75 2.75 0 1 0 12 9.25ZM19 12l-1.28.48a5.92 5.92 0 0 1-.35.86l.58 1.25-1.68 1.68-1.25-.58c-.28.15-.57.27-.86.35L12 19l-1.48-.64a5.92 5.92 0 0 1-.86-.35l-1.25.58-1.68-1.68.58-1.25a5.92 5.92 0 0 1-.35-.86L5 12l.64-1.48c.08-.29.2-.58.35-.86l-.58-1.25 1.68-1.68 1.25.58c.28-.15.57-.27.86-.35L12 5l1.48.64c.29.08.58.2.86.35l1.25-.58 1.68 1.68-.58 1.25c.15.28.27.57.35.86L19 12Z" />
                </svg>
            );
    }
}

export function AppShell({ initialTab = 'today' }: AppShellProps) {
    const { settings, loading, user } = useApp();
    const [activeTab, setActiveTab] = useState<Tab>(initialTab);
    const [activeWorkout, setActiveWorkout] = useState<{ weekNumber: number; dayNumber: number } | null>(null);

    useEffect(() => {
        setActiveTab(initialTab);
    }, [initialTab]);

    if (loading) {
        return (
            <div className="loading-screen">
                <div className="loading-spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Loading program...</p>
            </div>
        );
    }

    if (!settings?.onboardingComplete) {
        return <Onboarding />;
    }

    if (activeWorkout) {
        return (
            <WorkoutLogger
                weekNumber={activeWorkout.weekNumber}
                dayNumber={activeWorkout.dayNumber}
                onFinish={() => setActiveWorkout(null)}
            />
        );
    }

    return (
        <div className="app-container">
            <header className="app-header">
                <Link href="/" className="app-header-home" aria-label="Go to home">
                    <h1>EgoLift</h1>
                </Link>
                {user && (
                    <div className="header-avatar" title={user.displayName || user.email || 'Account'}>
                        {user.photoURL ? (
                            <img src={user.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                        ) : (
                            <span className="avatar-initial">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
                        )}
                    </div>
                )}
            </header>

            <div className="page-content fade-in">
                {activeTab === 'overview' && (
                    <ProgramBrowser onStartWorkout={(w, d) => setActiveWorkout({ weekNumber: w, dayNumber: d })} />
                )}
                {activeTab === 'today' && (
                    <Today onStartWorkout={(w, d) => setActiveWorkout({ weekNumber: w, dayNumber: d })} />
                )}
                {activeTab === 'calendar' && <History />}
                {activeTab === 'settings' && <Settings />}
            </div>

            <nav className="bottom-nav" aria-label="Primary">
                <div className="bottom-nav-shell">
                    {navItems.map(({ tab, label }) => (
                        <button
                            key={tab}
                            className={`nav-item ${activeTab === tab ? 'active' : ''}`}
                            onClick={() => setActiveTab(tab)}
                            aria-current={activeTab === tab ? 'page' : undefined}
                        >
                            <span className="nav-icon">
                                <NavIcon tab={tab} />
                            </span>
                            <span className="nav-label">{label}</span>
                        </button>
                    ))}
                </div>
            </nav>
        </div>
    );
}
