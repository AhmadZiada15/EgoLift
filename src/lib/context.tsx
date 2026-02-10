'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserSettings, ProgramTemplate, WorkoutLog, UnitType } from './types';
import { getUserSettings, saveUserSettings, getAllWorkoutLogs, saveWorkoutLog, deleteWorkoutLog as dbDeleteWorkoutLog } from './db';
import {
    getCloudUserSettings,
    saveCloudUserSettings,
    getAllCloudWorkoutLogs,
    saveCloudWorkoutLog,
    deleteCloudWorkoutLog,
    syncLocalToCloud,
} from './firestore';
import { useAuth } from './auth';
import { getDefaultRounding } from './calculations';
import { User } from 'firebase/auth';

interface AppContextType {
    settings: UserSettings | null;
    program: ProgramTemplate | null;
    workoutLogs: WorkoutLog[];
    loading: boolean;
    user: User | null;
    authLoading: boolean;
    signInWithGoogle: () => Promise<void>;
    signOut: () => Promise<void>;
    syncStatus: 'idle' | 'syncing' | 'synced' | 'error';
    updateSettings: (settings: Partial<Omit<UserSettings, 'id'>>) => Promise<void>;
    addWorkoutLog: (log: WorkoutLog) => Promise<void>;
    deleteWorkoutLog: (id: string) => Promise<void>;
    refreshLogs: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function useApp() {
    const ctx = useContext(AppContext);
    if (!ctx) throw new Error('useApp must be used within AppProvider');
    return ctx;
}

export function AppProvider({ children }: { children: React.ReactNode }) {
    const { user, loading: authLoading, signInWithGoogle, signOut } = useAuth();

    const [settings, setSettings] = useState<UserSettings | null>(null);
    const [program, setProgram] = useState<ProgramTemplate | null>(null);
    const [workoutLogs, setWorkoutLogs] = useState<WorkoutLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');

    // Load program template
    useEffect(() => {
        fetch('/program_template.json')
            .then(r => r.json())
            .then(setProgram)
            .catch(console.error);
    }, []);

    // Load settings and logs — from Firestore when signed in, IndexedDB when anonymous
    useEffect(() => {
        if (authLoading) return;

        async function init() {
            setLoading(true);
            try {
                let s: UserSettings | undefined;
                let logs: WorkoutLog[];

                if (user) {
                    // Signed in: try to sync local data first, then load from cloud
                    setSyncStatus('syncing');
                    try {
                        await syncLocalToCloud(user.uid);
                        setSyncStatus('synced');
                    } catch (e) {
                        console.error('Sync error:', e);
                        setSyncStatus('error');
                    }

                    s = await getCloudUserSettings(user.uid);
                    logs = await getAllCloudWorkoutLogs(user.uid);
                } else {
                    // Anonymous: use IndexedDB
                    s = await getUserSettings();
                    logs = await getAllWorkoutLogs();
                }

                // Normalize: ensure personality fields exist (backward compat)
                if (s) {
                    const normalized: UserSettings = {
                        ...s,
                        personalityMode: s.personalityMode || 'dry-coach',
                        reactionsEnabled: s.reactionsEnabled ?? true,
                        missedWorkoutReminders: s.missedWorkoutReminders ?? true,
                        streaksEnabled: s.streaksEnabled ?? true,
                        maxReactionsPerWorkout: s.maxReactionsPerWorkout ?? 1,
                        disableReactionsDuringTaper: s.disableReactionsDuringTaper ?? false,
                        currentStreak: s.currentStreak ?? 0,
                        lastWorkoutDate: s.lastWorkoutDate ?? null,
                    };
                    setSettings(normalized);
                } else {
                    setSettings(null);
                }
                setWorkoutLogs(logs.sort((a, b) => b.date.localeCompare(a.date)));
            } catch (e) {
                console.error('Failed to load data:', e);
            } finally {
                setLoading(false);
            }
        }
        init();
    }, [user, authLoading]);

    const updateSettings = useCallback(async (partial: Partial<Omit<UserSettings, 'id'>>) => {
        const current = settings || {
            units: 'lbs' as UnitType,
            roundingIncrement: 5,
            trainingMaxes: { squat: 0, bench: 0, deadlift: 0 },
            onboardingComplete: false,
            personalityMode: 'dry-coach' as const,
            reactionsEnabled: true,
            missedWorkoutReminders: true,
            streaksEnabled: true,
            maxReactionsPerWorkout: 1,
            disableReactionsDuringTaper: false,
            currentStreak: 0,
            lastWorkoutDate: null,
        };
        const updated: UserSettings = {
            ...current,
            ...partial,
            id: 'default',
        };

        // Save to both local and cloud (if signed in)
        await saveUserSettings(updated);
        if (user) {
            await saveCloudUserSettings(user.uid, updated);
        }
        setSettings(updated);
    }, [settings, user]);

    const addWorkoutLog = useCallback(async (log: WorkoutLog) => {
        await saveWorkoutLog(log);
        if (user) {
            await saveCloudWorkoutLog(user.uid, log);
        }
        const logs = user
            ? await getAllCloudWorkoutLogs(user.uid)
            : await getAllWorkoutLogs();
        setWorkoutLogs(logs.sort((a, b) => b.date.localeCompare(a.date)));
    }, [user]);

    const deleteWorkoutLogHandler = useCallback(async (id: string) => {
        await dbDeleteWorkoutLog(id);
        if (user) {
            await deleteCloudWorkoutLog(user.uid, id);
        }
        setWorkoutLogs(prev => prev.filter(l => l.id !== id));
    }, [user]);

    const refreshLogs = useCallback(async () => {
        const logs = user
            ? await getAllCloudWorkoutLogs(user.uid)
            : await getAllWorkoutLogs();
        setWorkoutLogs(logs.sort((a, b) => b.date.localeCompare(a.date)));
    }, [user]);

    return (
        <AppContext.Provider value={{
            settings,
            program,
            workoutLogs,
            loading,
            user,
            authLoading,
            signInWithGoogle,
            signOut,
            syncStatus,
            updateSettings,
            addWorkoutLog,
            deleteWorkoutLog: deleteWorkoutLogHandler,
            refreshLogs,
        }}>
            {children}
        </AppContext.Provider>
    );
}
