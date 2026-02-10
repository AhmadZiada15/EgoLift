'use client';

import React, { useState, useEffect } from 'react';
import { FriendWithProfile, WorkoutLog, UserSettings } from '@/lib/types';
import { getFriendSettings, getFriendWorkoutLogs } from '@/lib/friends';
import { formatWeight, convertWeight } from '@/lib/calculations';
import { User } from 'firebase/auth';

interface FriendDetailProps {
    friend: FriendWithProfile;
    currentUser: User;
    onBack: () => void;
    onNudge: (message: string) => Promise<void>;
}

export function FriendDetail({ friend, currentUser, onBack, onNudge }: FriendDetailProps) {
    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [logs, setLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [nudgeMsg, setNudgeMsg] = useState('');
    const [nudgeSent, setNudgeSent] = useState(false);
    const [sending, setSending] = useState(false);

    useEffect(() => {
        async function load() {
            setLoading(true);
            try {
                const [s, l] = await Promise.all([
                    getFriendSettings(friend.uid),
                    getFriendWorkoutLogs(friend.uid, 10),
                ]);
                setSettings(s);
                setLogs(l);
            } catch (err) {
                console.error('Failed to load friend data:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [friend.uid]);

    const handleNudge = async () => {
        setSending(true);
        try {
            await onNudge(nudgeMsg || "Let's lift! 💪");
            setNudgeSent(true);
            setNudgeMsg('');
            setTimeout(() => setNudgeSent(false), 3000);
        } catch {
            // handled
        } finally {
            setSending(false);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="friend-detail-header">
                <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
            </div>

            {/* Profile Card */}
            <div className="card mb-4 friend-profile-card">
                <div className="friend-profile-top">
                    <div className="friend-avatar-lg">
                        {friend.photoURL ? (
                            <img src={friend.photoURL} alt="" className="avatar-img-lg" referrerPolicy="no-referrer" />
                        ) : (
                            <span className="avatar-initial-lg">{friend.displayName[0].toUpperCase()}</span>
                        )}
                    </div>
                    <div>
                        <h3 className="friend-profile-name">{friend.displayName}</h3>
                        <div className="friend-profile-meta">
                            {friend.weekProgress && <span className="friend-card-week">{friend.weekProgress}</span>}
                            {(friend.currentStreak ?? 0) > 0 && <span>🔥 {friend.currentStreak} streak</span>}
                        </div>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="empty-state" style={{ padding: '32px 0' }}>
                    <div className="loading-spinner" />
                </div>
            ) : (
                <>
                    {/* Training Maxes */}
                    {settings && (
                        <div className="card mb-4">
                            <p className="input-label mb-3">Training Maxes</p>
                            <div className="friend-maxes-grid">
                                <div className="friend-max-item">
                                    <div className="friend-max-label">Squat</div>
                                    <div className="friend-max-value">
                                        {settings.units === 'kg'
                                            ? `${Math.round(convertWeight(settings.trainingMaxes.squat, 'lbs', 'kg'))} kg`
                                            : `${settings.trainingMaxes.squat} lbs`
                                        }
                                    </div>
                                </div>
                                <div className="friend-max-item">
                                    <div className="friend-max-label">Bench</div>
                                    <div className="friend-max-value">
                                        {settings.units === 'kg'
                                            ? `${Math.round(convertWeight(settings.trainingMaxes.bench, 'lbs', 'kg'))} kg`
                                            : `${settings.trainingMaxes.bench} lbs`
                                        }
                                    </div>
                                </div>
                                <div className="friend-max-item">
                                    <div className="friend-max-label">Deadlift</div>
                                    <div className="friend-max-value">
                                        {settings.units === 'kg'
                                            ? `${Math.round(convertWeight(settings.trainingMaxes.deadlift, 'lbs', 'kg'))} kg`
                                            : `${settings.trainingMaxes.deadlift} lbs`
                                        }
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Nudge Card */}
                    <div className="card mb-4 nudge-card">
                        <p className="input-label mb-2">Send a Nudge 👊</p>
                        <div className="nudge-input-row">
                            <input
                                className="input input-compact"
                                placeholder="Let's lift! 💪"
                                value={nudgeMsg}
                                onChange={(e) => setNudgeMsg(e.target.value)}
                                maxLength={100}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleNudge}
                                disabled={sending || nudgeSent}
                            >
                                {nudgeSent ? '✓ Sent!' : sending ? '...' : '👊'}
                            </button>
                        </div>
                        {nudgeSent && (
                            <p className="text-sm fade-in" style={{ color: 'var(--accent-green)', marginTop: '8px' }}>
                                Nudge sent to {friend.displayName}!
                            </p>
                        )}
                    </div>

                    {/* Recent Workouts */}
                    <div className="card mb-4">
                        <p className="input-label mb-3">Recent Workouts</p>
                        {logs.length === 0 ? (
                            <p className="text-sm text-muted">No workouts logged yet</p>
                        ) : (
                            logs.map(log => (
                                <div key={log.id} className="friend-workout-row">
                                    <div className="friend-workout-header">
                                        <span className="friend-workout-label">
                                            W{log.weekNumber}D{log.dayNumber}
                                        </span>
                                        <span className="friend-workout-day">{log.dayLabel}</span>
                                        <span className="friend-workout-date">
                                            {new Date(log.date).toLocaleDateString()}
                                        </span>
                                    </div>
                                    <div className="friend-workout-exercises">
                                        {log.entries.slice(0, 3).map(entry => (
                                            <span key={entry.id} className="friend-workout-exercise">
                                                {entry.exerciseName}
                                                {entry.sets.length > 0 && entry.sets[0].weight && (
                                                    <> · {entry.sets[0].weight}{entry.sets[0].weightUnit}</>
                                                )}
                                            </span>
                                        ))}
                                        {log.entries.length > 3 && (
                                            <span className="text-sm text-muted">+{log.entries.length - 3} more</span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </>
            )}
        </div>
    );
}
