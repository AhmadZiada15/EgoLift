'use client';

import React, { useState, useEffect } from 'react';
import { Nudge } from '@/lib/types';
import { getMyNudges, markNudgeRead, sendNudge } from '@/lib/friends';

interface NudgeBannerProps {
    uid: string;
    displayName: string;
    photoURL: string | null;
}

export function NudgeBanner({ uid, displayName, photoURL }: NudgeBannerProps) {
    const [nudges, setNudges] = useState<Nudge[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);
    const [visible, setVisible] = useState(false);
    const [nudgedBack, setNudgedBack] = useState(false);

    useEffect(() => {
        if (!uid) return;

        async function loadNudges() {
            try {
                const myNudges = await getMyNudges(uid);
                if (myNudges.length > 0) {
                    setNudges(myNudges);
                    setCurrentIndex(0);
                    // Small delay for enter animation
                    setTimeout(() => setVisible(true), 300);
                }
            } catch (err) {
                console.error('Failed to load nudges:', err);
            }
        }

        loadNudges();
        // Poll every 30 seconds for new nudges
        const interval = setInterval(loadNudges, 30000);
        return () => clearInterval(interval);
    }, [uid]);

    const currentNudge = nudges[currentIndex];
    if (!currentNudge || !visible) return null;

    const handleDismiss = async () => {
        await markNudgeRead(currentNudge.id);
        if (currentIndex < nudges.length - 1) {
            setCurrentIndex(currentIndex + 1);
            setNudgedBack(false);
        } else {
            setVisible(false);
            setNudges([]);
        }
    };

    const handleNudgeBack = async () => {
        try {
            await sendNudge(uid, displayName, photoURL, currentNudge.from, '👊 Right back at you!');
            setNudgedBack(true);
            setTimeout(() => handleDismiss(), 1500);
        } catch {
            // Silently fail
        }
    };

    return (
        <div className={`nudge-banner ${visible ? 'show' : ''}`}>
            <div className="nudge-banner-content">
                <div className="nudge-banner-avatar">
                    {currentNudge.fromPhoto ? (
                        <img src={currentNudge.fromPhoto} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                    ) : (
                        <span className="avatar-initial">{currentNudge.fromName[0].toUpperCase()}</span>
                    )}
                </div>
                <div className="nudge-banner-text">
                    <strong>{currentNudge.fromName}</strong>
                    <span className="nudge-banner-message">{currentNudge.message}</span>
                </div>
            </div>
            <div className="nudge-banner-actions">
                <button
                    className="btn btn-sm btn-nudge-back"
                    onClick={handleNudgeBack}
                    disabled={nudgedBack}
                >
                    {nudgedBack ? '✓ Sent' : '👊'}
                </button>
                <button className="btn btn-ghost btn-sm" onClick={handleDismiss}>
                    ✕
                </button>
            </div>
            {nudges.length > 1 && (
                <div className="nudge-banner-count">
                    {currentIndex + 1}/{nudges.length}
                </div>
            )}
        </div>
    );
}
