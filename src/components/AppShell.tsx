'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/lib/context';
import { Onboarding } from './Onboarding';
import { ProgramBrowser } from './ProgramBrowser';
import { WorkoutLogger } from './WorkoutLogger';
import { History } from './History';
import { Progress } from './Progress';
import { Settings } from './Settings';
import { Friends } from './Friends';
import { NudgeBanner } from './NudgeBanner';
import { getIncomingRequests, getMyNudges } from '@/lib/friends';

type Tab = 'program' | 'history' | 'progress' | 'friends' | 'settings';

export function AppShell() {
    const { settings, loading, user, authLoading } = useApp();
    const [activeTab, setActiveTab] = useState<Tab>('program');
    const [activeWorkout, setActiveWorkout] = useState<{ weekNumber: number; dayNumber: number } | null>(null);
    const [friendBadge, setFriendBadge] = useState(0);

    // Poll for friend badge count (pending requests + unread nudges)
    useEffect(() => {
        if (!user) { setFriendBadge(0); return; }

        async function updateBadge() {
            try {
                const [requests, nudges] = await Promise.all([
                    getIncomingRequests(user!.uid),
                    getMyNudges(user!.uid),
                ]);
                setFriendBadge(requests.length + nudges.length);
            } catch { /* silent */ }
        }

        updateBadge();
        const interval = setInterval(updateBadge, 30000);
        return () => clearInterval(interval);
    }, [user]);

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
                <h1>EgoLift</h1>
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

            {/* Nudge Banner */}
            {user && (
                <NudgeBanner
                    uid={user.uid}
                    displayName={user.displayName || 'User'}
                    photoURL={user.photoURL}
                />
            )}

            <div className="page-content fade-in">
                {activeTab === 'program' && (
                    <ProgramBrowser onStartWorkout={(w, d) => setActiveWorkout({ weekNumber: w, dayNumber: d })} />
                )}
                {activeTab === 'history' && <History />}
                {activeTab === 'progress' && <Progress />}
                {activeTab === 'friends' && <Friends />}
                {activeTab === 'settings' && <Settings />}
            </div>

            <nav className="bottom-nav">
                <button className={`nav-item ${activeTab === 'program' ? 'active' : ''}`} onClick={() => setActiveTab('program')}>
                    <span className="nav-icon">📋</span>
                    Program
                </button>
                <button className={`nav-item ${activeTab === 'history' ? 'active' : ''}`} onClick={() => setActiveTab('history')}>
                    <span className="nav-icon">📅</span>
                    History
                </button>
                <button className={`nav-item ${activeTab === 'progress' ? 'active' : ''}`} onClick={() => setActiveTab('progress')}>
                    <span className="nav-icon">📈</span>
                    Progress
                </button>
                <button className={`nav-item ${activeTab === 'friends' ? 'active' : ''}`} onClick={() => setActiveTab('friends')}>
                    <span className="nav-icon" style={{ position: 'relative' }}>
                        👥
                        {friendBadge > 0 && <span className="nav-badge">{friendBadge}</span>}
                    </span>
                    Friends
                </button>
                <button className={`nav-item ${activeTab === 'settings' ? 'active' : ''}`} onClick={() => setActiveTab('settings')}>
                    <span className="nav-icon">⚙️</span>
                    Settings
                </button>
            </nav>
        </div>
    );
}
