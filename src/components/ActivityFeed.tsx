'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context';
import { Milestone, Celebration } from '@/lib/types';
import { getFriendMilestones, celebrateMilestone, getMilestoneCelebrations } from '@/lib/milestones';

const CELEBRATION_EMOJIS = ['🎉', '🔥', '💪', '👏', '🏆'];

export function ActivityFeed() {
    const { user } = useApp();
    const [milestones, setMilestones] = useState<Milestone[]>([]);
    const [loading, setLoading] = useState(true);
    const [celebratedIds, setCelebratedIds] = useState<Set<string>>(new Set());
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [celebrations, setCelebrations] = useState<Record<string, Celebration[]>>({});
    const [animatingId, setAnimatingId] = useState<string | null>(null);

    const loadMilestones = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            const feed = await getFriendMilestones(user.uid);
            setMilestones(feed);
        } catch (err) {
            console.error('Failed to load milestones:', err);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadMilestones();
    }, [loadMilestones]);

    const handleCelebrate = async (milestoneId: string, emoji: string) => {
        if (!user || celebratedIds.has(milestoneId)) return;

        setAnimatingId(milestoneId);
        try {
            await celebrateMilestone(
                milestoneId,
                user.uid,
                user.displayName || 'User',
                user.photoURL,
                emoji
            );
            setCelebratedIds(prev => new Set([...prev, milestoneId]));

            // Update local count
            setMilestones(prev =>
                prev.map(m =>
                    m.id === milestoneId
                        ? { ...m, celebrationCount: m.celebrationCount + 1 }
                        : m
                )
            );

            setTimeout(() => setAnimatingId(null), 800);
        } catch {
            setAnimatingId(null);
        }
    };

    const toggleExpand = async (milestoneId: string) => {
        if (expandedId === milestoneId) {
            setExpandedId(null);
            return;
        }
        setExpandedId(milestoneId);

        if (!celebrations[milestoneId]) {
            try {
                const celeb = await getMilestoneCelebrations(milestoneId);
                setCelebrations(prev => ({ ...prev, [milestoneId]: celeb }));
            } catch {
                // silent
            }
        }
    };

    if (!user) {
        return (
            <div className="empty-state" style={{ paddingTop: '24px' }}>
                <div className="empty-state-icon">🏆</div>
                <p className="empty-state-text">
                    Sign in to see friend milestones
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="empty-state" style={{ padding: '32px 0' }}>
                <div className="loading-spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Loading feed...</p>
            </div>
        );
    }

    return (
        <div className="activity-feed">
            <h3 className="activity-feed-title">Activity</h3>

            {milestones.length === 0 ? (
                <div className="empty-state" style={{ paddingTop: '24px' }}>
                    <div className="empty-state-icon">🏆</div>
                    <p className="empty-state-text">
                        No milestones yet.<br />
                        Complete workouts and hit PRs to share<br />
                        achievements with friends!
                    </p>
                </div>
            ) : (
                milestones.map(milestone => {
                    const isOwn = milestone.uid === user.uid;
                    const alreadyCelebrated = celebratedIds.has(milestone.id);
                    const isExpanded = expandedId === milestone.id;
                    const isAnimating = animatingId === milestone.id;

                    return (
                        <div
                            key={milestone.id}
                            className={`milestone-card ${isAnimating ? 'celebrating' : ''}`}
                        >
                            <div className="milestone-header">
                                <div className="milestone-avatar">
                                    {milestone.photoURL ? (
                                        <img src={milestone.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                                    ) : (
                                        <span className="avatar-initial">
                                            {milestone.displayName[0].toUpperCase()}
                                        </span>
                                    )}
                                </div>
                                <div className="milestone-info">
                                    <span className="milestone-name">
                                        {isOwn ? 'You' : milestone.displayName}
                                    </span>
                                    <span className="milestone-time">
                                        {formatTimeAgo(milestone.createdAt)}
                                    </span>
                                </div>
                            </div>

                            <div className="milestone-body">
                                <div className="milestone-title">{milestone.title}</div>
                                <div className="milestone-desc">{milestone.description}</div>
                                {milestone.value && (
                                    <div className="milestone-value-badge">
                                        <span className="milestone-value">{milestone.value}</span>
                                        {milestone.unit && (
                                            <span className="milestone-unit">{milestone.unit}</span>
                                        )}
                                    </div>
                                )}
                            </div>

                            {/* Celebration Bar */}
                            <div className="milestone-footer">
                                {!isOwn && (
                                    <div className="celebration-emojis">
                                        {CELEBRATION_EMOJIS.map(emoji => (
                                            <button
                                                key={emoji}
                                                className={`celebration-btn ${alreadyCelebrated ? 'celebrated' : ''}`}
                                                onClick={() => handleCelebrate(milestone.id, emoji)}
                                                disabled={alreadyCelebrated}
                                            >
                                                {emoji}
                                            </button>
                                        ))}
                                    </div>
                                )}

                                {milestone.celebrationCount > 0 && (
                                    <button
                                        className="celebration-count"
                                        onClick={() => toggleExpand(milestone.id)}
                                    >
                                        🎉 {milestone.celebrationCount}
                                        <span className="celebration-expand">
                                            {isExpanded ? '▲' : '▼'}
                                        </span>
                                    </button>
                                )}
                            </div>

                            {/* Expanded Celebrations */}
                            {isExpanded && celebrations[milestone.id] && (
                                <div className="celebration-list fade-in">
                                    {celebrations[milestone.id].map(c => (
                                        <div key={c.id} className="celebration-item">
                                            <span className="celebration-emoji">{c.emoji}</span>
                                            <span className="celebration-from">{c.fromName}</span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    );
                })
            )}
        </div>
    );
}

function formatTimeAgo(dateStr: string): string {
    const now = Date.now();
    const then = new Date(dateStr).getTime();
    const diffMs = now - then;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    return new Date(dateStr).toLocaleDateString();
}
