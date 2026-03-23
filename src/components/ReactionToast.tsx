'use client';

import React, { useEffect, useState } from 'react';
import { Reaction } from '@/lib/personality';

interface ReactionToastProps {
    reactions: Reaction[];
    onDismiss: () => void;
}

const CATEGORY_COLORS: Record<string, string> = {
    PR: '#c97b8e',
    PERFORMANCE: '#f5ede0',
    PHASE: '#c9b5a8',
    STREAK: '#f5ede0',
    NUDGE: '#c97b8e',
    OBSERVATION: '#c9b5a8',
};

export function ReactionToast({ reactions, onDismiss }: ReactionToastProps) {
    const [visible, setVisible] = useState(false);
    const [currentIndex, setCurrentIndex] = useState(0);

    useEffect(() => {
        // Slide in after a brief delay
        const showTimer = setTimeout(() => setVisible(true), 100);
        return () => clearTimeout(showTimer);
    }, []);

    useEffect(() => {
        // Auto-dismiss after 5 seconds per reaction
        const dismissTimer = setTimeout(() => {
            if (currentIndex < reactions.length - 1) {
                setCurrentIndex(prev => prev + 1);
            } else {
                setVisible(false);
                setTimeout(onDismiss, 400); // Wait for exit animation
            }
        }, 5000);

        return () => clearTimeout(dismissTimer);
    }, [currentIndex, reactions.length, onDismiss]);

    const handleTap = () => {
        if (currentIndex < reactions.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            setVisible(false);
            setTimeout(onDismiss, 400);
        }
    };

    if (reactions.length === 0) return null;

    const reaction = reactions[currentIndex];
    const accentColor = CATEGORY_COLORS[reaction.category] || 'var(--accent-red)';

    return (
        <div
            className={`reaction-toast-overlay ${visible ? 'visible' : ''}`}
            onClick={handleTap}
        >
            <div className={`reaction-toast ${visible ? 'slide-in' : 'slide-out'}`}>
                {/* Accent bar */}
                <div
                    className="reaction-toast-accent"
                    style={{ background: accentColor }}
                />

                <div className="reaction-toast-content">
                    {/* Category badge */}
                    <div className="reaction-toast-header">
                        <span
                            className="reaction-toast-category"
                            style={{ color: accentColor }}
                        >
                            {reaction.category}
                        </span>
                        {reactions.length > 1 && (
                            <span className="reaction-toast-counter">
                                {currentIndex + 1}/{reactions.length}
                            </span>
                        )}
                    </div>

                    {/* Message */}
                    <p className="reaction-toast-message">{reaction.message}</p>

                    {/* Tap hint */}
                    <p className="reaction-toast-hint">
                        {currentIndex < reactions.length - 1 ? 'tap for next note' : 'tap to dismiss'}
                    </p>
                </div>
            </div>
        </div>
    );
}
