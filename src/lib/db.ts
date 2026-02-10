/**
 * db.ts
 * IndexedDB database layer using the `idb` library.
 * Stores user settings and workout logs locally.
 */

import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { UserSettings, WorkoutLog } from './types';

interface TrainingAppDB extends DBSchema {
    userSettings: {
        key: string;
        value: UserSettings;
    };
    workoutLogs: {
        key: string;
        value: WorkoutLog;
        indexes: {
            'by-date': string;
            'by-week-day': [number, number];
        };
    };
}

const DB_NAME = 'egolift-app';
const DB_VERSION = 1;

let dbPromise: Promise<IDBPDatabase<TrainingAppDB>> | null = null;

function getDB(): Promise<IDBPDatabase<TrainingAppDB>> {
    if (!dbPromise) {
        dbPromise = openDB<TrainingAppDB>(DB_NAME, DB_VERSION, {
            upgrade(db) {
                // User settings store
                if (!db.objectStoreNames.contains('userSettings')) {
                    db.createObjectStore('userSettings', { keyPath: 'id' });
                }

                // Workout logs store
                if (!db.objectStoreNames.contains('workoutLogs')) {
                    const logStore = db.createObjectStore('workoutLogs', { keyPath: 'id' });
                    logStore.createIndex('by-date', 'date');
                    logStore.createIndex('by-week-day', ['weekNumber', 'dayNumber']);
                }
            },
        });
    }
    return dbPromise;
}

// ── User Settings ────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'default';

export async function getUserSettings(): Promise<UserSettings | undefined> {
    const db = await getDB();
    return db.get('userSettings', SETTINGS_KEY);
}

export async function saveUserSettings(settings: Omit<UserSettings, 'id'>): Promise<void> {
    const db = await getDB();
    await db.put('userSettings', { ...settings, id: SETTINGS_KEY });
}

// ── Workout Logs ─────────────────────────────────────────────────────────────

export async function saveWorkoutLog(log: WorkoutLog): Promise<void> {
    const db = await getDB();
    await db.put('workoutLogs', log);
}

export async function getWorkoutLog(id: string): Promise<WorkoutLog | undefined> {
    const db = await getDB();
    return db.get('workoutLogs', id);
}

export async function getWorkoutLogByWeekDay(weekNumber: number, dayNumber: number): Promise<WorkoutLog[]> {
    const db = await getDB();
    return db.getAllFromIndex('workoutLogs', 'by-week-day', [weekNumber, dayNumber]);
}

export async function getAllWorkoutLogs(): Promise<WorkoutLog[]> {
    const db = await getDB();
    return db.getAll('workoutLogs');
}

export async function getWorkoutLogsByDateRange(startDate: string, endDate: string): Promise<WorkoutLog[]> {
    const db = await getDB();
    const range = IDBKeyRange.bound(startDate, endDate);
    return db.getAllFromIndex('workoutLogs', 'by-date', range);
}

export async function deleteWorkoutLog(id: string): Promise<void> {
    const db = await getDB();
    await db.delete('workoutLogs', id);
}
