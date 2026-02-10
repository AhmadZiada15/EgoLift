/**
 * personality.ts
 * Rule-based reaction engine for contextual, program-aware workout feedback.
 * 
 * Design: All messages are stored in a dictionary keyed by triggerType × personalityMode.
 * The engine evaluates triggers in priority order after workout completion and 
 * returns the highest-priority matching reaction(s).
 * 
 * Editable without redeployment — just update the MESSAGES dictionary.
 */

import { PersonalityMode, WorkoutLog, ExerciseLogEntry, UserSettings, SetLog } from './types';
import { estimateE1RM } from './calculations';

// ── Types ────────────────────────────────────────────────────────────────────

export type TriggerType =
    | 'pr-weight'
    | 'pr-e1rm'
    | 'pr-rep'
    | 'beat-previous'
    | 'rpe-drop'
    | 'rpe-sandbagging'
    | 'grind-complete'
    | 'missed-reps'
    | 'skipped-accessories'
    | 'deload-compliance'
    | 'phase-message'
    | 'streak'
    | 'missed-workout';

export type ProgramPhase =
    | 'accumulation'    // Weeks 1-4
    | 'intensification' // Weeks 5-8
    | 'peaking'         // Weeks 9-11
    | 'competition-prep'// Weeks 12-15
    | 'taper';          // Week 16

export interface Reaction {
    triggerType: TriggerType;
    message: string;
    category: 'PR' | 'PERFORMANCE' | 'PHASE' | 'STREAK' | 'NUDGE' | 'OBSERVATION';
    priority: number; // higher = shown first
}

// ── Program Phase Detection ──────────────────────────────────────────────────

export function getProgramPhase(weekNumber: number): ProgramPhase {
    if (weekNumber <= 4) return 'accumulation';
    if (weekNumber <= 8) return 'intensification';
    if (weekNumber <= 11) return 'peaking';
    if (weekNumber <= 15) return 'competition-prep';
    return 'taper';
}

// ── Message Dictionary ───────────────────────────────────────────────────────
// All tone variants for every trigger type. Each array has multiple options
// (picked randomly for variety). Order: [dry-coach, unhinged-spotter, supportive-disappointed]

type MessageVariants = Record<Exclude<PersonalityMode, 'silent'>, string[]>;

const MESSAGES: Record<TriggerType, MessageVariants> = {
    'pr-weight': {
        'dry-coach': [
            "That's your best since installing this app.",
            "New weight PR. Write it down.",
            "Heavier than ever. Noted.",
        ],
        'unhinged-spotter': [
            "PR ALERT. Don't play it cool, I saw that.",
            "That bar has never been that heavy. You're welcome.",
            "New weight. New you. Same questionable form, probably.",
        ],
        'supportive-disappointed': [
            "I'm so proud... you finally did it.",
            "A PR! I was starting to worry about you.",
            "New weight PR. I never doubted you. (I did.)",
        ],
    },
    'pr-e1rm': {
        'dry-coach': [
            "New estimated 1RM. The math doesn't lie.",
            "E1RM up. Your ceiling just moved.",
        ],
        'unhinged-spotter': [
            "Your calculator just got stronger. New E1RM.",
            "Epley says you're stronger. Epley is rarely wrong.",
        ],
        'supportive-disappointed': [
            "Your estimated max went up! I'm... emotional.",
            "New E1RM. The spreadsheet would be proud.",
        ],
    },
    'pr-rep': {
        'dry-coach': [
            "More reps at that weight than ever before.",
            "Rep PR. Endurance or desperation — either counts.",
        ],
        'unhinged-spotter': [
            "You just out-repped yourself. What's happening.",
            "Rep PR. Your muscles didn't know they could do that.",
        ],
        'supportive-disappointed': [
            "More reps than ever! I'm tearing up a little.",
            "A rep PR! You're full of surprises.",
        ],
    },
    'beat-previous': {
        'dry-coach': [
            "That moved better than last week. Don't pretend it didn't.",
            "Weight's up from last time. Progress is progress.",
            "Heavier than last session. That's the point.",
        ],
        'unhinged-spotter': [
            "Last week's you just got humiliated.",
            "Stronger than Tuesday. Tuesday was weak anyway.",
            "You beat your past self. Past you is crying.",
        ],
        'supportive-disappointed': [
            "You improved! I almost can't believe it.",
            "Better than last time! Growth is beautiful.",
            "Look at you, doing more than before. I'm moved.",
        ],
    },
    'rpe-drop': {
        'dry-coach': [
            "Same weight. Lower RPE. Your nervous system noticed.",
            "Easier at the same weight. That's adaptation.",
        ],
        'unhinged-spotter': [
            "Same weight felt lighter? Suspicious. But I'll allow it.",
            "Your RPE went down. Either you're adapting or lying.",
        ],
        'supportive-disappointed': [
            "Same weight, but easier! Your body is learning.",
            "Lower RPE at the same weight. That's quiet strength.",
        ],
    },
    'rpe-sandbagging': {
        'dry-coach': [
            "Be honest. That was not an 8.",
            "Your RPE doesn't match the math. Just saying.",
        ],
        'unhinged-spotter': [
            "RPE 8? With that weight? At your max? Sure.",
            "I've seen your training max. That RPE is fiction.",
        ],
        'supportive-disappointed': [
            "I trust you, but... that RPE seems generous.",
            "Are you sure about that RPE? I just want honesty between us.",
        ],
    },
    'grind-complete': {
        'dry-coach': [
            "Technically successful. Emotionally questionable.",
            "Got the reps. Didn't look pretty. Doesn't need to.",
        ],
        'unhinged-spotter': [
            "That was ugly. But it counted. Ugly counts.",
            "RPE 9.5+. Your soul left and came back.",
        ],
        'supportive-disappointed': [
            "You fought for every rep and I respect that deeply.",
            "That was hard to watch... but you did it.",
        ],
    },
    'missed-reps': {
        'dry-coach': [
            "Fell short on reps. It happens. Log it and move on.",
            "Missed prescribed reps. The data is the data.",
        ],
        'unhinged-spotter': [
            "Reps were prescribed, not suggested. But fine.",
            "The program said more reps. The program is disappointed.",
        ],
        'supportive-disappointed': [
            "You didn't quite get all the reps... but you tried, and that counts.",
            "Missing reps happens to everyone. I still believe in you.",
        ],
    },
    'skipped-accessories': {
        'dry-coach': [
            "Accessories were optional. You chose violence.",
            "Skipped accessories. Bold strategy.",
        ],
        'unhinged-spotter': [
            "GHR? Never heard of her. — You, apparently.",
            "Accessories skipped. Your tendons will remember this.",
        ],
        'supportive-disappointed': [
            "You skipped the accessories, and that's okay... I guess.",
            "The accessories are sad you left them behind.",
        ],
    },
    'deload-compliance': {
        'dry-coach': [
            "You actually held back. Discipline noted.",
            "Deload weights respected. Maturity.",
        ],
        'unhinged-spotter': [
            "You didn't ego lift during taper? WHO ARE YOU?",
            "Light weights during deload. Growth as a person.",
        ],
        'supportive-disappointed': [
            "You listened to the program during deload! I'm so proud.",
            "Taking it easy when told to. Emotional growth.",
        ],
    },
    'phase-message': {
        'dry-coach': [
            '', // Filled dynamically by phase
        ],
        'unhinged-spotter': [''],
        'supportive-disappointed': [''],
    },
    'streak': {
        'dry-coach': [''],
        'unhinged-spotter': [''],
        'supportive-disappointed': [''],
    },
    'missed-workout': {
        'dry-coach': [''],
        'unhinged-spotter': [''],
        'supportive-disappointed': [''],
    },
};

// ── Phase-Specific Messages ──────────────────────────────────────────────────

const PHASE_MESSAGES: Record<ProgramPhase, MessageVariants> = {
    accumulation: {
        'dry-coach': [
            "Volume is supposed to feel like this. Unfortunately.",
            "Weeks 1-4. Build the base. Trust the process.",
        ],
        'unhinged-spotter': [
            "Volume phase. Where reps go to multiply.",
            "So many reps. So much suffering. So much growth.",
        ],
        'supportive-disappointed': [
            "This volume is building something beautiful inside you.",
            "It's a lot of reps, but each one matters. I promise.",
        ],
    },
    intensification: {
        'dry-coach': [
            "Heavy, not heroic. Don't freestyle.",
            "Intensity is climbing. Stay with the percentages.",
        ],
        'unhinged-spotter': [
            "The weights are getting real now. Act accordingly.",
            "Intensification. Where boys become lifters.",
        ],
        'supportive-disappointed': [
            "The weights are getting heavier and I believe in you.",
            "Intensity phase. You were made for this.",
        ],
    },
    peaking: {
        'dry-coach': [
            "This is not the time to discover your limits.",
            "Peak phase. Execute the plan. Nothing extra.",
        ],
        'unhinged-spotter': [
            "Peaking. Every rep is a career decision now.",
            "The heavy singles are here. Don't be a hero.",
        ],
        'supportive-disappointed': [
            "You're peaking, and it's beautiful to watch.",
            "This is where it all comes together. I'm emotional.",
        ],
    },
    'competition-prep': {
        'dry-coach': [
            "Competition prep. Precision over intensity.",
            "Opener territory. Trust your training.",
        ],
        'unhinged-spotter': [
            "Comp prep. If you freestyle now, we're done.",
            "This is where you prove the spreadsheet works.",
        ],
        'supportive-disappointed': [
            "Competition is so close! Everything has led to this.",
            "You've done the work. Now it's about execution.",
        ],
    },
    taper: {
        'dry-coach': [
            "Do less. This is not a trick.",
            "Taper week. Your job is to rest and stay sharp.",
        ],
        'unhinged-spotter': [
            "TAPER. WEEK. Do NOT add volume. I am WATCHING.",
            "If you go heavy during taper I will uninstall myself.",
        ],
        'supportive-disappointed': [
            "Taper week. Rest is training too, even if it doesn't feel like it.",
            "You've earned this rest. Please take it.",
        ],
    },
};

// ── Streak Messages ──────────────────────────────────────────────────────────

interface StreakMilestone {
    day: number;
    messages: MessageVariants;
}

const STREAK_MILESTONES: StreakMilestone[] = [
    {
        day: 1,
        messages: {
            'dry-coach': ["Every block starts somewhere."],
            'unhinged-spotter': ["Day one. Don't make it your last."],
            'supportive-disappointed': ["A new beginning. I believe in this version of you."],
        },
    },
    {
        day: 3,
        messages: {
            'dry-coach': ["Three sessions in. Not bad."],
            'unhinged-spotter': ["Three in a row. Getting dangerous."],
            'supportive-disappointed': ["Three sessions! You're building something here."],
        },
    },
    {
        day: 5,
        messages: {
            'dry-coach': ["You're being suspiciously consistent."],
            'unhinged-spotter': ["Five sessions. Who even are you?"],
            'supportive-disappointed': ["Five sessions! I'm genuinely impressed."],
        },
    },
    {
        day: 7,
        messages: {
            'dry-coach': ["A full week of compliance. Respect."],
            'unhinged-spotter': ["Seven sessions. You're officially not a quitter."],
            'supportive-disappointed': ["A whole week! I'm tearing up, honestly."],
        },
    },
    {
        day: 14,
        messages: {
            'dry-coach': ["This is officially a habit now."],
            'unhinged-spotter': ["Two weeks straight. The gym should name a rack after you."],
            'supportive-disappointed': ["Two weeks of consistency. I've never been more proud."],
        },
    },
    {
        day: 21,
        messages: {
            'dry-coach': ["Three weeks. Routine established."],
            'unhinged-spotter': ["21 sessions. Psychologists say you're addicted now."],
            'supportive-disappointed': ["Three weeks! You're officially reliable. That means a lot to me."],
        },
    },
    {
        day: 30,
        messages: {
            'dry-coach': ["Statistically, most people quit before this."],
            'unhinged-spotter': ["30 sessions. You're statistically an anomaly."],
            'supportive-disappointed': ["30 sessions. I didn't think we'd get here. I'm so sorry for doubting you."],
        },
    },
    {
        day: 50,
        messages: {
            'dry-coach': ["50 sessions. No comment needed."],
            'unhinged-spotter': ["FIFTY. You absolute machine."],
            'supportive-disappointed': ["Fifty sessions. I need a moment."],
        },
    },
];

// ── Missed Workout Messages ──────────────────────────────────────────────────

interface MissedWorkoutTier {
    hoursMin: number;
    hoursMax: number;
    messages: MessageVariants;
}

const MISSED_WORKOUT_TIERS: MissedWorkoutTier[] = [
    {
        hoursMin: 2,
        hoursMax: 12,
        messages: {
            'dry-coach': ["Today was a training day. Just checking."],
            'unhinged-spotter': ["Hey. You had a session scheduled. Just so you know."],
            'supportive-disappointed': ["I noticed you haven't trained today... everything okay?"],
        },
    },
    {
        hoursMin: 12,
        hoursMax: 24,
        messages: {
            'dry-coach': ["Your squat day is still waiting."],
            'unhinged-spotter': ["The barbell misses you. It told me."],
            'supportive-disappointed': ["It's been a while since your scheduled session. I worry."],
        },
    },
    {
        hoursMin: 24,
        hoursMax: 48,
        messages: {
            'dry-coach': ["We'll pretend this was planned."],
            'unhinged-spotter': ["48 hours. This is becoming a lifestyle choice."],
            'supportive-disappointed': ["I'm not mad, I'm just... concerned."],
        },
    },
];

const CONSECUTIVE_MISS_MESSAGE: MessageVariants = {
    'dry-coach': ["At this point, this is a lifestyle choice."],
    'unhinged-spotter': ["Three missed sessions. Your barbell filed a missing persons report."],
    'supportive-disappointed': ["Three sessions missed. I'm still here whenever you're ready. No pressure. (Some pressure.)"],
};

// ── Utility ──────────────────────────────────────────────────────────────────

function pickRandom<T>(arr: T[]): T {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getMessageForMode(variants: MessageVariants, mode: PersonalityMode): string {
    if (mode === 'silent') return '';
    const messages = variants[mode];
    return pickRandom(messages);
}

// ── Helper: Check if exercise is an accessory ────────────────────────────────

const MAIN_LIFT_KEYWORDS = [
    'competition squat', 'competition pause bench', 'competition deadlift',
    'paused bench', 'squat', 'bench', 'deadlift', 'sldl', 'close grip',
    '2ct pause', '3ct pause', 'pin squat', 'pin bench',
];

function isAccessory(exerciseName: string): boolean {
    const name = exerciseName.toLowerCase();
    // If it matches a main lift keyword, it's not an accessory
    for (const kw of MAIN_LIFT_KEYWORDS) {
        if (name.includes(kw)) return false;
    }
    return true;
}

// ── Helper: Get best previous weight for an exercise ─────────────────────────

function getBestPreviousWeight(exerciseName: string, currentLogId: string, allLogs: WorkoutLog[]): number | null {
    let best: number | null = null;
    for (const log of allLogs) {
        if (log.id === currentLogId) continue;
        if (!log.completedAt) continue;
        for (const entry of log.entries) {
            if (entry.exerciseName !== exerciseName || entry.skipped) continue;
            for (const set of entry.sets) {
                if (set.completed && set.weight !== null) {
                    if (best === null || set.weight > best) best = set.weight;
                }
            }
        }
    }
    return best;
}

function getBestPreviousE1RM(exerciseName: string, currentLogId: string, allLogs: WorkoutLog[]): number | null {
    let best: number | null = null;
    for (const log of allLogs) {
        if (log.id === currentLogId) continue;
        if (!log.completedAt) continue;
        for (const entry of log.entries) {
            if (entry.exerciseName !== exerciseName || entry.skipped) continue;
            for (const set of entry.sets) {
                if (set.completed && set.weight && set.reps && set.reps > 0) {
                    const e1rm = estimateE1RM(set.weight, set.reps);
                    if (best === null || e1rm > best) best = e1rm;
                }
            }
        }
    }
    return best;
}

function getBestPreviousReps(exerciseName: string, weight: number, currentLogId: string, allLogs: WorkoutLog[]): number | null {
    let best: number | null = null;
    for (const log of allLogs) {
        if (log.id === currentLogId) continue;
        if (!log.completedAt) continue;
        for (const entry of log.entries) {
            if (entry.exerciseName !== exerciseName || entry.skipped) continue;
            for (const set of entry.sets) {
                if (set.completed && set.weight === weight && set.reps !== null) {
                    if (best === null || set.reps > best) best = set.reps;
                }
            }
        }
    }
    return best;
}

function getLastRPEForExercise(exerciseName: string, weight: number, currentLogId: string, allLogs: WorkoutLog[]): number | null {
    // Find the most recent RPE for the same exercise at similar weight
    for (const log of allLogs) {
        if (log.id === currentLogId) continue;
        if (!log.completedAt) continue;
        for (const entry of log.entries) {
            if (entry.exerciseName !== exerciseName || entry.skipped) continue;
            for (const set of entry.sets) {
                if (set.completed && set.rpe !== null && set.weight !== null && Math.abs(set.weight - weight) <= 5) {
                    return set.rpe;
                }
            }
        }
    }
    return null;
}

// ── Main Evaluation Engine ───────────────────────────────────────────────────

export function evaluateReactions(
    currentLog: WorkoutLog,
    allLogs: WorkoutLog[],
    settings: UserSettings,
): Reaction[] {
    if (!settings.reactionsEnabled) return [];
    if (settings.personalityMode === 'silent') return [];
    if (settings.disableReactionsDuringTaper && currentLog.weekNumber === 16) return [];

    const mode = settings.personalityMode;
    const reactions: Reaction[] = [];

    // Scan all entries for triggers
    for (const entry of currentLog.entries) {
        if (entry.skipped) continue;

        const completedSets = entry.sets.filter(s => s.completed && s.weight !== null);
        if (completedSets.length === 0) continue;

        const bestWeight = Math.max(...completedSets.map(s => s.weight!));
        const bestSet = completedSets.reduce((best, s) =>
            (s.weight! > best.weight! || (s.weight === best.weight && (s.reps || 0) > (best.reps || 0))) ? s : best
        );

        // PR: Weight
        const prevBestWeight = getBestPreviousWeight(entry.exerciseName, currentLog.id, allLogs);
        if (prevBestWeight !== null && bestWeight > prevBestWeight) {
            reactions.push({
                triggerType: 'pr-weight',
                message: getMessageForMode(MESSAGES['pr-weight'], mode),
                category: 'PR',
                priority: 100,
            });
        }

        // PR: E1RM
        if (bestSet.weight && bestSet.reps && bestSet.reps > 0) {
            const currentE1RM = estimateE1RM(bestSet.weight, bestSet.reps);
            const prevBestE1RM = getBestPreviousE1RM(entry.exerciseName, currentLog.id, allLogs);
            if (prevBestE1RM !== null && currentE1RM > prevBestE1RM) {
                reactions.push({
                    triggerType: 'pr-e1rm',
                    message: getMessageForMode(MESSAGES['pr-e1rm'], mode),
                    category: 'PR',
                    priority: 95,
                });
            }
        }

        // PR: Rep at weight
        if (bestSet.weight && bestSet.reps) {
            const prevBestReps = getBestPreviousReps(entry.exerciseName, bestSet.weight, currentLog.id, allLogs);
            if (prevBestReps !== null && bestSet.reps > prevBestReps) {
                reactions.push({
                    triggerType: 'pr-rep',
                    message: getMessageForMode(MESSAGES['pr-rep'], mode),
                    category: 'PR',
                    priority: 90,
                });
            }
        }

        // Beat previous (not PR, just better than last session for same week/day/exercise)
        if (prevBestWeight !== null && bestWeight > prevBestWeight * 0.98) {
            // Already handled by PR above; skip if it's a full PR
            if (prevBestWeight === null || bestWeight <= prevBestWeight) {
                // Actually didn't beat — this is for "close to" cases, skip
            }
        }

        // RPE Drop (same weight, lower RPE)
        if (bestSet.rpe !== null && bestSet.weight !== null) {
            const lastRPE = getLastRPEForExercise(entry.exerciseName, bestSet.weight, currentLog.id, allLogs);
            if (lastRPE !== null && bestSet.rpe < lastRPE) {
                reactions.push({
                    triggerType: 'rpe-drop',
                    message: getMessageForMode(MESSAGES['rpe-drop'], mode),
                    category: 'PERFORMANCE',
                    priority: 70,
                });
            }
        }

        // RPE Sandbagging (heuristic: if weight is < 70% of TM and they report RPE 8+)
        if (bestSet.rpe !== null && bestSet.rpe >= 8 && bestSet.weight !== null) {
            const liftName = entry.exerciseName.toLowerCase();
            let tmLbs: number | null = null;
            if (liftName.includes('squat')) tmLbs = settings.trainingMaxes.squat;
            else if (liftName.includes('bench')) tmLbs = settings.trainingMaxes.bench;
            else if (liftName.includes('deadlift')) tmLbs = settings.trainingMaxes.deadlift;

            if (tmLbs) {
                const tm = settings.units === 'lbs' ? tmLbs : tmLbs * 0.45359237;
                const pctOfTM = bestSet.weight / tm;
                if (pctOfTM < 0.65 && bestSet.rpe >= 8) {
                    reactions.push({
                        triggerType: 'rpe-sandbagging',
                        message: getMessageForMode(MESSAGES['rpe-sandbagging'], mode),
                        category: 'OBSERVATION',
                        priority: 50,
                    });
                }
            }
        }

        // Grind Complete (RPE 9.5+ but all reps completed)
        if (bestSet.rpe !== null && bestSet.rpe >= 9.5) {
            reactions.push({
                triggerType: 'grind-complete',
                message: getMessageForMode(MESSAGES['grind-complete'], mode),
                category: 'PERFORMANCE',
                priority: 60,
            });
        }
    }

    // Skipped accessories check
    const skippedAccessories = currentLog.entries.filter(e => e.skipped && isAccessory(e.exerciseName));
    if (skippedAccessories.length > 0) {
        reactions.push({
            triggerType: 'skipped-accessories',
            message: getMessageForMode(MESSAGES['skipped-accessories'], mode),
            category: 'OBSERVATION',
            priority: 30,
        });
    }

    // Phase message (always add as low-priority background flavor)
    const phase = getProgramPhase(currentLog.weekNumber);
    const phaseMsg = getMessageForMode(PHASE_MESSAGES[phase], mode);
    if (phaseMsg) {
        reactions.push({
            triggerType: 'phase-message',
            message: phaseMsg,
            category: 'PHASE',
            priority: 10,
        });
    }

    // Sort by priority (highest first), return up to max
    reactions.sort((a, b) => b.priority - a.priority);
    return reactions.slice(0, settings.maxReactionsPerWorkout);
}

// ── Streak Helpers ───────────────────────────────────────────────────────────

export function getStreakMessage(streakCount: number, mode: PersonalityMode): Reaction | null {
    if (mode === 'silent') return null;

    // Find the highest milestone <= current streak
    let milestone: StreakMilestone | null = null;
    for (const m of STREAK_MILESTONES) {
        if (streakCount === m.day) {
            milestone = m;
            break;
        }
    }

    if (!milestone) return null;

    return {
        triggerType: 'streak',
        message: getMessageForMode(milestone.messages, mode),
        category: 'STREAK',
        priority: 80,
    };
}

export function calculateStreak(lastWorkoutDate: string | null, today: string, currentStreak: number): number {
    if (!lastWorkoutDate) return 1;

    const last = new Date(lastWorkoutDate);
    const now = new Date(today);
    const diffDays = Math.floor((now.getTime() - last.getTime()) / (1000 * 60 * 60 * 24));

    // If same day, don't increment
    if (diffDays === 0) return currentStreak;
    // If within 3 days (allows for rest days), increment
    if (diffDays <= 3) return currentStreak + 1;
    // If more than 3 days gap, reset
    return 1;
}

// ── Missed Workout Messages ─────────────────────────────────────────────────

export function getMissedWorkoutMessage(
    hoursMissed: number,
    consecutiveMisses: number,
    mode: PersonalityMode,
): Reaction | null {
    if (mode === 'silent') return null;

    // Consecutive miss escalation
    if (consecutiveMisses >= 3) {
        return {
            triggerType: 'missed-workout',
            message: getMessageForMode(CONSECUTIVE_MISS_MESSAGE, mode),
            category: 'NUDGE',
            priority: 50,
        };
    }

    // Time-based tier
    for (const tier of MISSED_WORKOUT_TIERS) {
        if (hoursMissed >= tier.hoursMin && hoursMissed < tier.hoursMax) {
            return {
                triggerType: 'missed-workout',
                message: getMessageForMode(tier.messages, mode),
                category: 'NUDGE',
                priority: 40,
            };
        }
    }

    // After 48 hours, stop (no harassment)
    return null;
}

// ── Preview Messages (for Settings UI) ──────────────────────────────────────

export interface PersonalityPreview {
    mode: PersonalityMode;
    label: string;
    description: string;
    examples: string[];
}

export function getPersonalityPreviews(): PersonalityPreview[] {
    return [
        {
            mode: 'dry-coach',
            label: 'Dry Coach',
            description: 'Calm, slightly sarcastic, minimal fuss',
            examples: [
                "That moved better than last week. Don't pretend it didn't.",
                "Accessories were optional. You chose violence.",
                "Do less. This is not a trick.",
            ],
        },
        {
            mode: 'unhinged-spotter',
            label: 'Unhinged Spotter',
            description: 'Aggressive humor, mild guilt-tripping',
            examples: [
                "Last week's you just got humiliated.",
                "Your squat day is still waiting.",
                "TAPER. WEEK. Do NOT add volume. I am WATCHING.",
            ],
        },
        {
            mode: 'supportive-disappointed',
            label: 'Supportive but Disappointed',
            description: 'Encouraging yet emotionally manipulative',
            examples: [
                "I'm so proud... you finally did it.",
                "I'm not mad, I'm just... concerned.",
                "I never doubted you. (I did.)",
            ],
        },
        {
            mode: 'silent',
            label: 'Silent Logger',
            description: 'No humor, no commentary. Just data.',
            examples: [
                "—",
            ],
        },
    ];
}
