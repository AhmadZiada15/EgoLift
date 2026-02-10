/**
 * friends.ts
 * Firestore layer for the friends system: profiles, friend requests,
 * friendships, nudges, and read-only progress viewing.
 *
 * Firestore structure:
 *   users/{uid}/profile/public        — UserProfile
 *   friendRequests/{id}               — FriendRequest
 *   friendships/{id}                  — Friendship (accepted pair)
 *   nudges/{id}                       — Nudge notification
 */

import {
    doc,
    getDoc,
    setDoc,
    addDoc,
    updateDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    where,
    orderBy,
    limit,
    Timestamp,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
    UserProfile,
    FriendRequest,
    Friendship,
    Nudge,
    FriendWithProfile,
    WorkoutLog,
    UserSettings,
} from './types';

// ── Helper: Generate Friend Code ─────────────────────────────────────────────

function generateFriendCode(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I confusion
    let code = '';
    for (let i = 0; i < 4; i++) {
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return `EGO-${code}`;
}

// ── User Profile ─────────────────────────────────────────────────────────────

export async function ensureUserProfile(
    uid: string,
    displayName: string,
    photoURL: string | null
): Promise<UserProfile> {
    const ref = doc(firestore, 'users', uid, 'profile', 'public');
    const snap = await getDoc(ref);

    if (snap.exists()) {
        // Update name/photo if changed, keep friend code
        const existing = snap.data() as UserProfile;
        if (existing.displayName !== displayName || existing.photoURL !== photoURL) {
            await updateDoc(ref, { displayName, photoURL });
        }
        return { ...existing, displayName, photoURL };
    }

    // Create new profile with unique friend code
    let friendCode = generateFriendCode();
    // Check uniqueness (unlikely collision but let's be safe)
    for (let attempt = 0; attempt < 5; attempt++) {
        const existing = await searchByFriendCode(friendCode);
        if (!existing) break;
        friendCode = generateFriendCode();
    }

    const profile: UserProfile = {
        uid,
        displayName,
        photoURL,
        friendCode,
        createdAt: new Date().toISOString(),
    };

    await setDoc(ref, profile);
    return profile;
}

export async function getUserProfile(uid: string): Promise<UserProfile | null> {
    const ref = doc(firestore, 'users', uid, 'profile', 'public');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserProfile) : null;
}

// ── Friend Code Search ───────────────────────────────────────────────────────

export async function searchByFriendCode(code: string): Promise<UserProfile | null> {
    // We need to search across all users' profiles for a matching friendCode.
    // Since profiles are nested under users/{uid}/profile/public, we use a
    // collectionGroup query on 'profile' where friendCode matches.
    const q = query(
        collection(firestore, 'profiles'),
        where('friendCode', '==', code.toUpperCase()),
        limit(1)
    );
    const snap = await getDocs(q);
    if (snap.empty) return null;
    return snap.docs[0].data() as UserProfile;
}

/**
 * Save profile to both the nested location AND the top-level 'profiles'
 * collection for searchability via friend code.
 */
export async function saveProfileForSearch(profile: UserProfile): Promise<void> {
    // Also save to top-level 'profiles' collection for collectionGroup-free search
    const searchRef = doc(firestore, 'profiles', profile.uid);
    await setDoc(searchRef, profile);
}

// ── Friend Requests ──────────────────────────────────────────────────────────

export async function sendFriendRequest(
    fromUid: string,
    fromName: string,
    fromPhoto: string | null,
    toUid: string,
    toName: string,
    toPhoto: string | null
): Promise<string> {
    // Prevent self-add
    if (fromUid === toUid) throw new Error('Cannot add yourself');

    // Check for existing request or friendship
    const existingRequest = await checkExistingRequest(fromUid, toUid);
    if (existingRequest) throw new Error('Request already exists');

    const existingFriendship = await checkExistingFriendship(fromUid, toUid);
    if (existingFriendship) throw new Error('Already friends');

    const request: Omit<FriendRequest, 'id'> = {
        from: fromUid,
        to: toUid,
        fromName,
        fromPhoto,
        toName,
        toPhoto,
        status: 'pending',
        createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(firestore, 'friendRequests'), request);
    return docRef.id;
}

export async function getIncomingRequests(uid: string): Promise<FriendRequest[]> {
    const q = query(
        collection(firestore, 'friendRequests'),
        where('to', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
}

export async function getOutgoingRequests(uid: string): Promise<FriendRequest[]> {
    const q = query(
        collection(firestore, 'friendRequests'),
        where('from', '==', uid),
        where('status', '==', 'pending'),
        orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as FriendRequest));
}

export async function acceptFriendRequest(requestId: string): Promise<void> {
    const reqRef = doc(firestore, 'friendRequests', requestId);
    const reqSnap = await getDoc(reqRef);
    if (!reqSnap.exists()) throw new Error('Request not found');

    const request = reqSnap.data() as FriendRequest;

    // Create friendship
    const friendship: Omit<Friendship, 'id'> = {
        users: [request.from, request.to],
        userMap: {
            [request.from]: { displayName: request.fromName, photoURL: request.fromPhoto },
            [request.to]: { displayName: request.toName, photoURL: request.toPhoto },
        },
        createdAt: new Date().toISOString(),
    };

    await addDoc(collection(firestore, 'friendships'), friendship);
    await updateDoc(reqRef, { status: 'accepted' });
}

export async function rejectFriendRequest(requestId: string): Promise<void> {
    const reqRef = doc(firestore, 'friendRequests', requestId);
    await updateDoc(reqRef, { status: 'rejected' });
}

// ── Friendships ──────────────────────────────────────────────────────────────

export async function getFriends(uid: string): Promise<FriendWithProfile[]> {
    const q = query(
        collection(firestore, 'friendships'),
        where('users', 'array-contains', uid)
    );
    const snap = await getDocs(q);

    return snap.docs.map(d => {
        const data = d.data() as Friendship;
        const friendUid = data.users.find(u => u !== uid)!;
        const friendInfo = data.userMap[friendUid];
        return {
            friendshipId: d.id,
            uid: friendUid,
            displayName: friendInfo?.displayName || 'User',
            photoURL: friendInfo?.photoURL || null,
        };
    });
}

export async function removeFriend(friendshipId: string): Promise<void> {
    await deleteDoc(doc(firestore, 'friendships', friendshipId));
}

async function checkExistingRequest(uid1: string, uid2: string): Promise<boolean> {
    // Check both directions
    const q1 = query(
        collection(firestore, 'friendRequests'),
        where('from', '==', uid1),
        where('to', '==', uid2),
        where('status', '==', 'pending')
    );
    const q2 = query(
        collection(firestore, 'friendRequests'),
        where('from', '==', uid2),
        where('to', '==', uid1),
        where('status', '==', 'pending')
    );
    const [s1, s2] = await Promise.all([getDocs(q1), getDocs(q2)]);
    return !s1.empty || !s2.empty;
}

async function checkExistingFriendship(uid1: string, uid2: string): Promise<boolean> {
    const q = query(
        collection(firestore, 'friendships'),
        where('users', 'array-contains', uid1)
    );
    const snap = await getDocs(q);
    return snap.docs.some(d => {
        const data = d.data() as Friendship;
        return data.users.includes(uid2);
    });
}

// ── Friend Progress (Read-Only) ──────────────────────────────────────────────

export async function getFriendSettings(friendUid: string): Promise<UserSettings | null> {
    const ref = doc(firestore, 'users', friendUid, 'settings', 'default');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserSettings) : null;
}

export async function getFriendWorkoutLogs(friendUid: string, count = 10): Promise<WorkoutLog[]> {
    const q = query(
        collection(firestore, 'users', friendUid, 'workoutLogs'),
        orderBy('date', 'desc'),
        limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
}

// ── Nudges ───────────────────────────────────────────────────────────────────

export async function sendNudge(
    fromUid: string,
    fromName: string,
    fromPhoto: string | null,
    toUid: string,
    message: string
): Promise<void> {
    const nudge: Omit<Nudge, 'id'> = {
        from: fromUid,
        to: toUid,
        fromName,
        fromPhoto,
        message: message || 'Let\'s lift! 💪',
        createdAt: new Date().toISOString(),
        read: false,
    };
    await addDoc(collection(firestore, 'nudges'), nudge);
}

export async function getMyNudges(uid: string): Promise<Nudge[]> {
    const q = query(
        collection(firestore, 'nudges'),
        where('to', '==', uid),
        where('read', '==', false),
        orderBy('createdAt', 'desc'),
        limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Nudge));
}

export async function markNudgeRead(nudgeId: string): Promise<void> {
    await updateDoc(doc(firestore, 'nudges', nudgeId), { read: true });
}

export async function markAllNudgesRead(uid: string): Promise<void> {
    const nudges = await getMyNudges(uid);
    await Promise.all(nudges.map(n => markNudgeRead(n.id)));
}
