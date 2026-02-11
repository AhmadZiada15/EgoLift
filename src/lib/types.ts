// Type definitions for the EgoLift Training App

export interface ProgramTemplate {
    meta: {
        source: string;
        parsedAt: string;
        defaultTrainingMaxes: DefaultMaxes;
        e1rmFormula: string;
        e1rmFormulaDescription: string;
    };
    weeks: ProgramWeek[];
}

export interface DefaultMaxes {
    squat: number;
    bench: number;
    deadlift: number;
    roundTo: number;
    units: string;
}

export interface ProgramWeek {
    weekNumber: number;
    weekLabel: string;
    days: ProgramDay[];
}

export interface ProgramDay {
    dayNumber: number;
    dayLabel: string;
    exercises: ExercisePrescription[];
}

export interface ExercisePrescription {
    id: string;
    name: string;
    sets: number | string | null;
    reps: number | string | null;
    intensity: number | string | null;
    tempo: string | null;
    restSeconds: number | null;
    computedLoadRule: ComputedLoadRule | null;
    isE1RM: boolean;
}

export interface ComputedLoadRule {
    liftType: 'squat' | 'bench' | 'deadlift';
    percent: number;
}

export type UnitType = 'lbs' | 'kg';

export type PersonalityMode = 'dry-coach' | 'unhinged-spotter' | 'supportive-disappointed' | 'silent';

export interface UserSettings {
    id: string;
    units: UnitType;
    roundingIncrement: number;
    trainingMaxes: {
        squat: number; // stored in lbs internally
        bench: number;
        deadlift: number;
    };
    onboardingComplete: boolean;
    // Personality system
    personalityMode: PersonalityMode;
    reactionsEnabled: boolean;
    missedWorkoutReminders: boolean;
    streaksEnabled: boolean;
    maxReactionsPerWorkout: number;
    disableReactionsDuringTaper: boolean;
    currentStreak: number;
    lastWorkoutDate: string | null;
}

export interface WorkoutLog {
    id: string;
    date: string; // ISO date string
    weekNumber: number;
    dayNumber: number;
    dayLabel: string;
    notes: string;
    startedAt: string;
    completedAt: string | null;
    entries: ExerciseLogEntry[];
}

export interface ExerciseLogEntry {
    id: string;
    prescriptionId: string | null; // null if custom exercise
    exerciseName: string;
    skipped: boolean;
    sets: SetLog[];
    notes: string;
}

export interface SetLog {
    setIndex: number;
    weight: number | null; // in user's selected units at time of logging
    weightUnit: UnitType;
    reps: number | null;
    rpe: number | null;
    completed: boolean;
}

export interface ChartDataPoint {
    date: string;
    value: number;
    label?: string;
    weekNumber?: number;
}

// ── Friends System ───────────────────────────────────────────────────────────

export interface UserProfile {
    uid: string;
    displayName: string;
    photoURL: string | null;
    friendCode: string; // e.g. "EGO-A3K"
    createdAt: string;
}

export interface FriendRequest {
    id: string;
    from: string; // uid
    to: string;   // uid
    fromName: string;
    fromPhoto: string | null;
    toName: string;
    toPhoto: string | null;
    status: 'pending' | 'accepted' | 'rejected';
    createdAt: string;
}

export interface Friendship {
    id: string;
    users: [string, string]; // two UIDs
    userMap: Record<string, { displayName: string; photoURL: string | null }>;
    createdAt: string;
}

export interface Nudge {
    id: string;
    from: string;
    to: string;
    fromName: string;
    fromPhoto: string | null;
    message: string;
    createdAt: string;
    read: boolean;
}

export interface FriendWithProfile {
    friendshipId: string;
    uid: string;
    displayName: string;
    photoURL: string | null;
    // Populated separately
    lastWorkout?: string | null;
    currentStreak?: number;
    weekProgress?: string; // e.g. "W4D2"
}

// ── Milestones & Celebrations ────────────────────────────────────────────────

export type MilestoneType =
    | 'pr-weight'      // New weight PR on a lift
    | 'pr-e1rm'        // New estimated 1RM
    | 'streak-3'       // 3-workout streak
    | 'streak-7'       // 7-workout streak
    | 'streak-14'      // 14-workout streak
    | 'streak-30'      // 30-workout streak
    | 'streak-50'      // 50-workout streak
    | 'phase-complete' // Completed a training phase
    | 'program-week'   // Completed a full training week
    | 'first-workout'; // Very first workout logged

export interface Milestone {
    id: string;
    uid: string;
    displayName: string;
    photoURL: string | null;
    type: MilestoneType;
    title: string;       // e.g. "New Squat PR!"
    description: string; // e.g. "Hit 315 lbs on Competition Squat"
    value?: number;      // e.g. the weight or streak count
    unit?: string;       // e.g. "lbs", "kg", "days"
    exerciseName?: string;
    createdAt: string;
    celebrationCount: number; // total reactions received
}

export interface Celebration {
    id: string;
    milestoneId: string;
    fromUid: string;
    fromName: string;
    fromPhoto: string | null;
    emoji: string; // 🎉🔥💪👏🏆
    createdAt: string;
}


