/**
 * milestones.ts
 * Firestore layer for milestones (auto-detected achievements) and
 * celebrations (friend reactions on milestones).
 *
 * Firestore structure:
 *   milestones/{id}            — Milestone document (public)
 *   celebrations/{id}          — Celebration reaction
 */

import {
    doc,
    addDoc,
    updateDoc,
    getDocs,
    collection,
    query,
    where,
    orderBy,
    limit,
    increment,
} from 'firebase/firestore';
import { firestore } from './firebase';
import {
    Milestone,
    MilestoneType,
    Celebration,
    WorkoutLog,
    UserSettings,
} from './types';
import { estimateE1RM } from './calculations';
import { getFriends } from './friends';

// ── Publish Milestone ────────────────────────────────────────────────────────

export async function publishMilestone(
    uid: string,
    displayName: string,
    photoURL: string | null,
    type: MilestoneType,
    title: string,
    description: string,
    extra?: { value?: number; unit?: string; exerciseName?: string }
): Promise<string> {
    const milestone: Omit<Milestone, 'id'> = {
        uid,
        displayName,
        photoURL,
        type,
        title,
        description,
        value: extra?.value,
        unit: extra?.unit,
        exerciseName: extra?.exerciseName,
        createdAt: new Date().toISOString(),
        celebrationCount: 0,
    };

    const docRef = await addDoc(collection(firestore, 'milestones'), milestone);
    return docRef.id;
}

// ── Read Milestones ──────────────────────────────────────────────────────────

/** Get milestones from all friends (activity feed) */
export async function getFriendMilestones(uid: string, count = 20): Promise<Milestone[]> {
    const friends = await getFriends(uid);
    const friendUids = friends.map(f => f.uid);

    if (friendUids.length === 0) return [];

    // Firestore 'in' supports max 30 items per query — fine for typical friend counts
    const batches: string[][] = [];
    for (let i = 0; i < friendUids.length; i += 30) {
        batches.push(friendUids.slice(i, i + 30));
    }

    const allMilestones: Milestone[] = [];
    for (const batch of batches) {
        const q = query(
            collection(firestore, 'milestones'),
            where('uid', 'in', batch),
            orderBy('createdAt', 'desc'),
            limit(count)
        );
        const snap = await getDocs(q);
        allMilestones.push(...snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));
    }

    // Also include own milestones in the feed
    const myQ = query(
        collection(firestore, 'milestones'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(10)
    );
    const mySnap = await getDocs(myQ);
    allMilestones.push(...mySnap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone)));

    // Deduplicate and sort
    const seen = new Set<string>();
    const unique = allMilestones.filter(m => {
        if (seen.has(m.id)) return false;
        seen.add(m.id);
        return true;
    });

    return unique.sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, count);
}

/** Get milestones for a specific user */
export async function getUserMilestones(uid: string, count = 10): Promise<Milestone[]> {
    const q = query(
        collection(firestore, 'milestones'),
        where('uid', '==', uid),
        orderBy('createdAt', 'desc'),
        limit(count)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Milestone));
}

// ── Celebrations ─────────────────────────────────────────────────────────────

export async function celebrateMilestone(
    milestoneId: string,
    fromUid: string,
    fromName: string,
    fromPhoto: string | null,
    emoji: string
): Promise<void> {
    // Check if already celebrated
    const existing = query(
        collection(firestore, 'celebrations'),
        where('milestoneId', '==', milestoneId),
        where('fromUid', '==', fromUid),
        limit(1)
    );
    const snap = await getDocs(existing);
    if (!snap.empty) return; // Already celebrated

    const celebration: Omit<Celebration, 'id'> = {
        milestoneId,
        fromUid,
        fromName,
        fromPhoto,
        emoji,
        createdAt: new Date().toISOString(),
    };

    await addDoc(collection(firestore, 'celebrations'), celebration);

    // Increment celebration count on the milestone
    const milestoneRef = doc(firestore, 'milestones', milestoneId);
    await updateDoc(milestoneRef, { celebrationCount: increment(1) });
}

export async function getMilestoneCelebrations(milestoneId: string): Promise<Celebration[]> {
    const q = query(
        collection(firestore, 'celebrations'),
        where('milestoneId', '==', milestoneId),
        orderBy('createdAt', 'desc'),
        limit(20)
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Celebration));
}

// ── Auto-Detection from Workout ──────────────────────────────────────────────

/**
 * Detect milestones from a newly completed workout. Called after handleSave.
 * Returns the milestones that were published.
 */
export async function detectAndPublishMilestones(
    uid: string,
    displayName: string,
    photoURL: string | null,
    currentLog: WorkoutLog,
    allLogs: WorkoutLog[],
    settings: UserSettings
): Promise<Milestone[]> {
    const published: Milestone[] = [];
    const units = settings.units;

    // 1. First workout ever
    if (allLogs.length <= 1) {
        const id = await publishMilestone(uid, displayName, photoURL,
            'first-workout',
            '🏋️ First Workout!',
            'Completed their first training session'
        );
        published.push({ id, uid, displayName, photoURL, type: 'first-workout', title: '🏋️ First Workout!', description: 'Completed their first training session', createdAt: new Date().toISOString(), celebrationCount: 0 });
    }

    // 2. PR Detection (weight PRs on main lifts)
    for (const entry of currentLog.entries) {
        if (entry.skipped) continue;
        const completedSets = entry.sets.filter(s => s.completed && s.weight !== null);
        if (completedSets.length === 0) continue;

        const bestWeight = Math.max(...completedSets.map(s => s.weight!));
        const bestSet = completedSets.reduce((best, s) =>
            (s.weight! > best.weight! || (s.weight === best.weight && (s.reps || 0) > (best.reps || 0))) ? s : best
        );

        // Check if this is a weight PR
        let prevBest: number | null = null;
        for (const log of allLogs) {
            if (log.id === currentLog.id || !log.completedAt) continue;
            for (const e of log.entries) {
                if (e.exerciseName !== entry.exerciseName || e.skipped) continue;
                for (const s of e.sets) {
                    if (s.completed && s.weight !== null) {
                        if (prevBest === null || s.weight > prevBest) prevBest = s.weight;
                    }
                }
            }
        }

        if (prevBest !== null && bestWeight > prevBest) {
            const title = `🏆 New ${entry.exerciseName} PR!`;
            const desc = `Hit ${bestWeight} ${units} on ${entry.exerciseName}`;
            const id = await publishMilestone(uid, displayName, photoURL,
                'pr-weight', title, desc,
                { value: bestWeight, unit: units, exerciseName: entry.exerciseName }
            );
            published.push({ id, uid, displayName, photoURL, type: 'pr-weight', title, description: desc, value: bestWeight, unit: units, exerciseName: entry.exerciseName, createdAt: new Date().toISOString(), celebrationCount: 0 });
        }

        // Check E1RM PR
        if (bestSet.weight && bestSet.reps && bestSet.reps > 0) {
            const currentE1RM = estimateE1RM(bestSet.weight, bestSet.reps);
            let prevBestE1RM: number | null = null;
            for (const log of allLogs) {
                if (log.id === currentLog.id || !log.completedAt) continue;
                for (const e of log.entries) {
                    if (e.exerciseName !== entry.exerciseName || e.skipped) continue;
                    for (const s of e.sets) {
                        if (s.completed && s.weight && s.reps && s.reps > 0) {
                            const e1rm = estimateE1RM(s.weight, s.reps);
                            if (prevBestE1RM === null || e1rm > prevBestE1RM) prevBestE1RM = e1rm;
                        }
                    }
                }
            }

            if (prevBestE1RM !== null && currentE1RM > prevBestE1RM) {
                const title = `📈 New ${entry.exerciseName} E1RM!`;
                const desc = `Estimated 1RM now ${Math.round(currentE1RM)} ${units}`;
                const id = await publishMilestone(uid, displayName, photoURL,
                    'pr-e1rm', title, desc,
                    { value: Math.round(currentE1RM), unit: units, exerciseName: entry.exerciseName }
                );
                published.push({ id, uid, displayName, photoURL, type: 'pr-e1rm', title, description: desc, value: Math.round(currentE1RM), unit: units, exerciseName: entry.exerciseName, createdAt: new Date().toISOString(), celebrationCount: 0 });
            }
        }
    }

    // 3. Streak milestones
    const streak = settings.currentStreak;
    const streakMilestones: { count: number; type: MilestoneType }[] = [
        { count: 3, type: 'streak-3' },
        { count: 7, type: 'streak-7' },
        { count: 14, type: 'streak-14' },
        { count: 30, type: 'streak-30' },
        { count: 50, type: 'streak-50' },
    ];

    for (const sm of streakMilestones) {
        if (streak === sm.count) {
            const title = `🔥 ${sm.count}-Workout Streak!`;
            const desc = `Maintained a ${sm.count}-session training streak`;
            const id = await publishMilestone(uid, displayName, photoURL,
                sm.type, title, desc,
                { value: sm.count, unit: 'workouts' }
            );
            published.push({ id, uid, displayName, photoURL, type: sm.type, title, description: desc, value: sm.count, unit: 'workouts', createdAt: new Date().toISOString(), celebrationCount: 0 });
        }
    }

    // 4. Program week complete (all days of a week done)
    const weekLogs = allLogs.filter(l => l.weekNumber === currentLog.weekNumber && l.completedAt);
    const uniqueDays = new Set(weekLogs.map(l => l.dayNumber));
    // Typical week has 4 training days
    if (uniqueDays.size >= 4) {
        // Check we haven't already published this
        const existingQ = query(
            collection(firestore, 'milestones'),
            where('uid', '==', uid),
            where('type', '==', 'program-week'),
            where('value', '==', currentLog.weekNumber),
            limit(1)
        );
        const existingSnap = await getDocs(existingQ);
        if (existingSnap.empty) {
            const title = `📋 Week ${currentLog.weekNumber} Complete!`;
            const desc = `Finished all training days in Week ${currentLog.weekNumber}`;
            const id = await publishMilestone(uid, displayName, photoURL,
                'program-week', title, desc,
                { value: currentLog.weekNumber }
            );
            published.push({ id, uid, displayName, photoURL, type: 'program-week', title, description: desc, value: currentLog.weekNumber, createdAt: new Date().toISOString(), celebrationCount: 0 });
        }
    }

    return published;
}
