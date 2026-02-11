'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { useApp } from '@/lib/context';
import {
    getFriends,
    getIncomingRequests,
    getOutgoingRequests,
    searchByFriendCode,
    sendFriendRequest,
    acceptFriendRequest,
    rejectFriendRequest,
    removeFriend,
    sendNudge,
    ensureUserProfile,
    getUserProfile,
    getFriendSettings,
    getFriendWorkoutLogs,
    saveProfileForSearch,
} from '@/lib/friends';
import { FriendWithProfile, FriendRequest, UserSettings, WorkoutLog } from '@/lib/types';
import { FriendDetail } from './FriendDetail';
import { ActivityFeed } from './ActivityFeed';

// ── Main Friends Component ───────────────────────────────────────────────────

export function Friends() {
    const { user } = useApp();
    const [view, setView] = useState<'list' | 'add' | 'detail'>('list');
    const [friends, setFriends] = useState<FriendWithProfile[]>([]);
    const [incoming, setIncoming] = useState<FriendRequest[]>([]);
    const [outgoing, setOutgoing] = useState<FriendRequest[]>([]);
    const [friendCode, setFriendCode] = useState('');
    const [myCode, setMyCode] = useState('');
    const [loading, setLoading] = useState(true);
    const [selectedFriend, setSelectedFriend] = useState<FriendWithProfile | null>(null);

    // Search state
    const [searchCode, setSearchCode] = useState('');
    const [searchResult, setSearchResult] = useState<{ uid: string; displayName: string; photoURL: string | null } | null>(null);
    const [searchError, setSearchError] = useState('');
    const [searching, setSearching] = useState(false);
    const [sending, setSending] = useState(false);
    const [nudgingId, setNudgingId] = useState<string | null>(null);
    const [copiedCode, setCopiedCode] = useState(false);

    const loadData = useCallback(async () => {
        if (!user) return;
        setLoading(true);
        try {
            // Ensure profile exists and get friend code
            const profile = await ensureUserProfile(
                user.uid,
                user.displayName || 'User',
                user.photoURL
            );
            await saveProfileForSearch(profile);
            setMyCode(profile.friendCode);

            // Load friends with their latest data
            const friendsList = await getFriends(user.uid);

            // Enrich friends with latest workout info
            const enriched = await Promise.all(
                friendsList.map(async (f) => {
                    try {
                        const [settings, logs] = await Promise.all([
                            getFriendSettings(f.uid),
                            getFriendWorkoutLogs(f.uid, 1),
                        ]);
                        return {
                            ...f,
                            currentStreak: settings?.currentStreak || 0,
                            lastWorkout: logs[0]?.completedAt || logs[0]?.date || null,
                            weekProgress: logs[0] ? `W${logs[0].weekNumber}D${logs[0].dayNumber}` : undefined,
                        };
                    } catch {
                        return f;
                    }
                })
            );

            setFriends(enriched);
            setIncoming(await getIncomingRequests(user.uid));
            setOutgoing(await getOutgoingRequests(user.uid));
        } catch (error) {
            console.error('Failed to load friends:', error);
        } finally {
            setLoading(false);
        }
    }, [user]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    if (!user) {
        return (
            <div className="empty-state">
                <div className="empty-state-icon">👥</div>
                <p className="empty-state-text">
                    Sign in with Google to add friends,<br />
                    share your progress, and lift together.
                </p>
            </div>
        );
    }

    if (loading) {
        return (
            <div className="empty-state">
                <div className="loading-spinner" />
                <p style={{ color: 'var(--text-muted)' }}>Loading friends...</p>
            </div>
        );
    }

    // Friend detail view
    if (view === 'detail' && selectedFriend) {
        return (
            <FriendDetail
                friend={selectedFriend}
                currentUser={user}
                onBack={() => { setView('list'); setSelectedFriend(null); }}
                onNudge={async (message: string) => {
                    await sendNudge(
                        user.uid,
                        user.displayName || 'User',
                        user.photoURL,
                        selectedFriend.uid,
                        message
                    );
                }}
            />
        );
    }

    const handleSearch = async () => {
        if (!searchCode.trim()) return;
        setSearching(true);
        setSearchError('');
        setSearchResult(null);

        try {
            const code = searchCode.toUpperCase().trim();
            if (code === myCode) {
                setSearchError("That's your own code!");
                return;
            }

            const result = await searchByFriendCode(code);
            if (!result) {
                setSearchError('No user found with that code');
            } else if (result.uid === user.uid) {
                setSearchError("That's your own code!");
            } else {
                setSearchResult(result);
            }
        } catch {
            setSearchError('Search failed. Try again.');
        } finally {
            setSearching(false);
        }
    };

    const handleSendRequest = async () => {
        if (!searchResult || !user) return;
        setSending(true);

        try {
            const targetProfile = await getUserProfile(searchResult.uid);
            await sendFriendRequest(
                user.uid,
                user.displayName || 'User',
                user.photoURL,
                searchResult.uid,
                targetProfile?.displayName || searchResult.displayName,
                targetProfile?.photoURL || searchResult.photoURL
            );
            setSearchResult(null);
            setSearchCode('');
            await loadData();
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Failed to send request';
            setSearchError(message);
        } finally {
            setSending(false);
        }
    };

    const handleAccept = async (requestId: string) => {
        try {
            await acceptFriendRequest(requestId);
            await loadData();
        } catch (err) {
            console.error('Failed to accept:', err);
        }
    };

    const handleReject = async (requestId: string) => {
        try {
            await rejectFriendRequest(requestId);
            await loadData();
        } catch (err) {
            console.error('Failed to reject:', err);
        }
    };

    const handleNudge = async (friendUid: string) => {
        setNudgingId(friendUid);
        try {
            await sendNudge(
                user.uid,
                user.displayName || 'User',
                user.photoURL,
                friendUid,
                "Let's lift! 💪"
            );
            setTimeout(() => setNudgingId(null), 1500);
        } catch {
            setNudgingId(null);
        }
    };

    const handleRemoveFriend = async (friendshipId: string) => {
        try {
            await removeFriend(friendshipId);
            await loadData();
        } catch (err) {
            console.error('Failed to remove friend:', err);
        }
    };

    const copyMyCode = () => {
        navigator.clipboard.writeText(myCode);
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
    };

    return (
        <div>
            <div className="friends-header">
                <h2 className="section-title">Friends</h2>
                <button
                    className={`btn btn-sm ${view === 'add' ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setView(view === 'add' ? 'list' : 'add')}
                >
                    {view === 'add' ? '✕ Close' : '+ Add'}
                </button>
            </div>

            {/* Pending Requests Banner */}
            {incoming.length > 0 && view === 'list' && (
                <div className="friend-requests-banner fade-in" onClick={() => setView('add')}>
                    <span>🔔 {incoming.length} pending request{incoming.length > 1 ? 's' : ''}</span>
                    <span className="text-sm" style={{ color: 'var(--accent-amber)' }}>View →</span>
                </div>
            )}

            {/* Add Friend View */}
            {view === 'add' && (
                <div className="fade-in">
                    {/* My Code Card */}
                    <div className="card mb-4 friend-code-card">
                        <p className="input-label mb-2">Your Friend Code</p>
                        <div className="friend-code-display" onClick={copyMyCode}>
                            <span className="friend-code-text">{myCode}</span>
                            <span className="friend-code-copy">{copiedCode ? '✓ Copied' : '📋 Copy'}</span>
                        </div>
                        <p className="text-sm text-muted" style={{ marginTop: '8px' }}>
                            Share this code with friends so they can add you
                        </p>
                    </div>

                    {/* Search */}
                    <div className="card mb-4">
                        <p className="input-label mb-2">Add by Friend Code</p>
                        <div className="friend-search-row">
                            <input
                                className="input input-compact"
                                placeholder="e.g. EGO-A3K"
                                value={searchCode}
                                onChange={(e) => setSearchCode(e.target.value.toUpperCase())}
                                maxLength={8}
                                style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
                            />
                            <button
                                className="btn btn-primary btn-sm"
                                onClick={handleSearch}
                                disabled={searching || !searchCode.trim()}
                            >
                                {searching ? '...' : 'Search'}
                            </button>
                        </div>

                        {searchError && (
                            <p className="text-sm" style={{ color: 'var(--accent-red)', marginTop: '8px' }}>{searchError}</p>
                        )}

                        {searchResult && (
                            <div className="friend-search-result fade-in">
                                <div className="friend-search-result-info">
                                    <div className="friend-avatar-sm">
                                        {searchResult.photoURL ? (
                                            <img src={searchResult.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="avatar-initial">{searchResult.displayName[0].toUpperCase()}</span>
                                        )}
                                    </div>
                                    <span className="font-semibold">{searchResult.displayName}</span>
                                </div>
                                <button
                                    className="btn btn-primary btn-sm"
                                    onClick={handleSendRequest}
                                    disabled={sending}
                                >
                                    {sending ? 'Sending...' : 'Send Request'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* Incoming Requests */}
                    {incoming.length > 0 && (
                        <div className="card mb-4">
                            <p className="input-label mb-3">Incoming Requests</p>
                            {incoming.map(req => (
                                <div key={req.id} className="friend-request-row">
                                    <div className="friend-request-info">
                                        <div className="friend-avatar-sm">
                                            {req.fromPhoto ? (
                                                <img src={req.fromPhoto} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                                            ) : (
                                                <span className="avatar-initial">{req.fromName[0].toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span className="font-semibold" style={{ fontSize: '13px' }}>{req.fromName}</span>
                                    </div>
                                    <div className="friend-request-actions">
                                        <button className="btn btn-primary btn-sm" onClick={() => handleAccept(req.id)}>Accept</button>
                                        <button className="btn btn-ghost btn-sm" onClick={() => handleReject(req.id)}>✕</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Outgoing Requests */}
                    {outgoing.length > 0 && (
                        <div className="card mb-4">
                            <p className="input-label mb-3">Sent Requests</p>
                            {outgoing.map(req => (
                                <div key={req.id} className="friend-request-row">
                                    <div className="friend-request-info">
                                        <div className="friend-avatar-sm">
                                            {req.toPhoto ? (
                                                <img src={req.toPhoto} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                                            ) : (
                                                <span className="avatar-initial">{req.toName[0].toUpperCase()}</span>
                                            )}
                                        </div>
                                        <span className="text-sm text-secondary">{req.toName}</span>
                                    </div>
                                    <span className="text-sm text-muted">Pending</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Friend List */}
            {view === 'list' && (
                <div className="fade-in">
                    {friends.length === 0 ? (
                        <div className="empty-state" style={{ paddingTop: '32px' }}>
                            <div className="empty-state-icon">👥</div>
                            <p className="empty-state-text">
                                No friends yet.<br />
                                Tap <strong>+ Add</strong> to share your friend code<br />
                                or add someone by theirs.
                            </p>
                        </div>
                    ) : (
                        friends.map(friend => (
                            <div
                                key={friend.friendshipId}
                                className="friend-card"
                                onClick={() => { setSelectedFriend(friend); setView('detail'); }}
                            >
                                <div className="friend-card-left">
                                    <div className="friend-avatar">
                                        {friend.photoURL ? (
                                            <img src={friend.photoURL} alt="" className="avatar-img" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="avatar-initial">{friend.displayName[0].toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div className="friend-card-info">
                                        <div className="friend-card-name">{friend.displayName}</div>
                                        <div className="friend-card-meta">
                                            {friend.weekProgress && (
                                                <span className="friend-card-week">{friend.weekProgress}</span>
                                            )}
                                            {friend.lastWorkout && (
                                                <span className="text-muted">
                                                    {formatTimeAgo(friend.lastWorkout)}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                                <div className="friend-card-right">
                                    {(friend.currentStreak ?? 0) > 0 && (
                                        <span className="friend-streak">🔥{friend.currentStreak}</span>
                                    )}
                                    <button
                                        className={`btn btn-icon btn-nudge ${nudgingId === friend.uid ? 'nudged' : ''}`}
                                        onClick={(e) => { e.stopPropagation(); handleNudge(friend.uid); }}
                                        title="Send nudge"
                                    >
                                        👊
                                    </button>
                                </div>
                            </div>
                        ))
                    )}

                    {/* My Code Footer */}
                    {friends.length > 0 && (
                        <div className="friend-code-footer" onClick={copyMyCode}>
                            <span className="text-sm text-muted">Your code:</span>
                            <span className="friend-code-inline">{myCode}</span>
                            <span className="text-sm" style={{ color: 'var(--accent-blue)' }}>
                                {copiedCode ? '✓' : '📋'}
                            </span>
                        </div>
                    )}

                    {/* Activity Feed - Milestones & Celebrations */}
                    <ActivityFeed />
                </div>
            )}
        </div>

    );
}

// ── Helper ───────────────────────────────────────────────────────────────────

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
