/**
 * firestore.ts
 * Cloud data layer using Firebase Firestore.
 * Mirrors the same API as db.ts (IndexedDB) but stores data per-user in the cloud.
 *
 * Firestore structure:
 *   users/{uid}/settings/default     — UserSettings document
 *   users/{uid}/workoutLogs/{logId}  — WorkoutLog documents
 */

import {
    doc,
    getDoc,
    setDoc,
    deleteDoc,
    collection,
    getDocs,
    query,
    orderBy,
} from 'firebase/firestore';
import { firestore } from './firebase';
import { UserSettings, WorkoutLog } from './types';
import { getUserSettings as getLocalSettings, getAllWorkoutLogs as getLocalLogs } from './db';

// ── User Settings ────────────────────────────────────────────────────────────

export async function getCloudUserSettings(uid: string): Promise<UserSettings | undefined> {
    const ref = doc(firestore, 'users', uid, 'settings', 'default');
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as UserSettings) : undefined;
}

export async function saveCloudUserSettings(uid: string, settings: Omit<UserSettings, 'id'>): Promise<void> {
    const ref = doc(firestore, 'users', uid, 'settings', 'default');
    await setDoc(ref, { ...settings, id: 'default' });
}

// ── Workout Logs ─────────────────────────────────────────────────────────────

export async function saveCloudWorkoutLog(uid: string, log: WorkoutLog): Promise<void> {
    const ref = doc(firestore, 'users', uid, 'workoutLogs', log.id);
    await setDoc(ref, log);
}

export async function getCloudWorkoutLog(uid: string, id: string): Promise<WorkoutLog | undefined> {
    const ref = doc(firestore, 'users', uid, 'workoutLogs', id);
    const snap = await getDoc(ref);
    return snap.exists() ? (snap.data() as WorkoutLog) : undefined;
}

export async function getAllCloudWorkoutLogs(uid: string): Promise<WorkoutLog[]> {
    const q = query(
        collection(firestore, 'users', uid, 'workoutLogs'),
        orderBy('date', 'desc')
    );
    const snap = await getDocs(q);
    return snap.docs.map(d => d.data() as WorkoutLog);
}

export async function deleteCloudWorkoutLog(uid: string, id: string): Promise<void> {
    const ref = doc(firestore, 'users', uid, 'workoutLogs', id);
    await deleteDoc(ref);
}

// ── Sync: Local → Cloud ──────────────────────────────────────────────────────

/**
 * One-time migration: push all local IndexedDB data to Firestore.
 * Skips any data that already exists in the cloud.
 */
export async function syncLocalToCloud(uid: string): Promise<{ settingsSynced: boolean; logsSynced: number }> {
    let settingsSynced = false;
    let logsSynced = 0;

    // Sync settings (only if cloud has none)
    const cloudSettings = await getCloudUserSettings(uid);
    if (!cloudSettings) {
        const localSettings = await getLocalSettings();
        if (localSettings) {
            await saveCloudUserSettings(uid, localSettings);
            settingsSynced = true;
        }
    }

    // Sync workout logs (skip any that already exist by ID)
    const localLogs = await getLocalLogs();
    const cloudLogs = await getAllCloudWorkoutLogs(uid);
    const cloudLogIds = new Set(cloudLogs.map(l => l.id));

    for (const log of localLogs) {
        if (!cloudLogIds.has(log.id)) {
            await saveCloudWorkoutLog(uid, log);
            logsSynced++;
        }
    }

    return { settingsSynced, logsSynced };
}
