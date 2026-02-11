'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { WorkoutLog, ExerciseLogEntry, SetLog, ExercisePrescription } from '@/lib/types';
import { computeExerciseLoad, formatWeight, formatIntensity, estimateE1RM, weightFromE1RM } from '@/lib/calculations';
import { evaluateReactions, getStreakMessage, calculateStreak, Reaction } from '@/lib/personality';
import { detectAndPublishMilestones } from '@/lib/milestones';
import { ReactionToast } from './ReactionToast';
import { v4 as uuidv4 } from 'uuid';

interface WorkoutLoggerProps {
    weekNumber: number;
    dayNumber: number;
    onFinish: () => void;
}

function createEmptySet(index: number, weight: number | null, reps: number | null, unit: 'lbs' | 'kg'): SetLog {
    return {
        setIndex: index,
        weight,
        weightUnit: unit,
        reps,
        rpe: null,
        completed: false,
    };
}

export function WorkoutLogger({ weekNumber, dayNumber, onFinish }: WorkoutLoggerProps) {
    const { program, settings, addWorkoutLog, workoutLogs, updateSettings, user } = useApp();

    const week = program?.weeks.find(w => w.weekNumber === weekNumber);
    const day = week?.days.find(d => d.dayNumber === dayNumber);

    const [entries, setEntries] = useState<ExerciseLogEntry[]>(() => {
        if (!day || !settings) return [];
        return day.exercises.map(exercise => {
            const load = computeExerciseLoad(exercise, settings);
            const prescribedSets = typeof exercise.sets === 'number' ? exercise.sets : 1;
            const prescribedReps = typeof exercise.reps === 'number' ? exercise.reps : null;
            const suggestedWeight = load?.rounded || null;

            return {
                id: uuidv4(),
                prescriptionId: exercise.id,
                exerciseName: exercise.name,
                skipped: false,
                notes: '',
                sets: Array.from({ length: prescribedSets }, (_, i) =>
                    createEmptySet(i, suggestedWeight, prescribedReps, settings.units)
                ),
            };
        });
    });

    const [workoutNotes, setWorkoutNotes] = useState('');
    const [expandedExercise, setExpandedExercise] = useState<number>(0);
    const startedAt = useMemo(() => new Date().toISOString(), []);
    const [showReactions, setShowReactions] = useState<Reaction[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!day || !settings) return null;

    // Find previous workout for auto-fill
    const prevWorkout = workoutLogs.find(
        l => l.weekNumber === weekNumber && l.dayNumber === dayNumber && l.completedAt
    );

    const updateSet = (exerciseIdx: number, setIdx: number, field: keyof SetLog, value: number | string | boolean | null) => {
        setEntries(prev => {
            const next = [...prev];
            const entry = { ...next[exerciseIdx] };
            const sets = [...entry.sets];
            sets[setIdx] = { ...sets[setIdx], [field]: value };
            entry.sets = sets;
            next[exerciseIdx] = entry;
            return next;
        });
    };

    const addSet = (exerciseIdx: number) => {
        setEntries(prev => {
            const next = [...prev];
            const entry = { ...next[exerciseIdx] };
            const lastSet = entry.sets[entry.sets.length - 1];
            entry.sets = [...entry.sets, createEmptySet(entry.sets.length, lastSet?.weight || null, lastSet?.reps || null, settings.units)];
            next[exerciseIdx] = entry;
            return next;
        });
    };

    const removeSet = (exerciseIdx: number, setIdx: number) => {
        setEntries(prev => {
            const next = [...prev];
            const entry = { ...next[exerciseIdx] };
            entry.sets = entry.sets.filter((_, i) => i !== setIdx).map((s, i) => ({ ...s, setIndex: i }));
            next[exerciseIdx] = entry;
            return next;
        });
    };

    const toggleSkip = (exerciseIdx: number) => {
        setEntries(prev => {
            const next = [...prev];
            next[exerciseIdx] = { ...next[exerciseIdx], skipped: !next[exerciseIdx].skipped };
            return next;
        });
    };

    const copyPreviousSet = (exerciseIdx: number, setIdx: number) => {
        if (setIdx === 0) return;
        const prevSet = entries[exerciseIdx].sets[setIdx - 1];
        updateSet(exerciseIdx, setIdx, 'weight', prevSet.weight);
        updateSet(exerciseIdx, setIdx, 'reps', prevSet.reps);
        updateSet(exerciseIdx, setIdx, 'rpe', prevSet.rpe);
    };

    const completeSet = (exerciseIdx: number, setIdx: number) => {
        updateSet(exerciseIdx, setIdx, 'completed', true);
    };

    const handleSave = async () => {
        if (isSaving) return;
        setIsSaving(true);

        const log: WorkoutLog = {
            id: uuidv4(),
            date: new Date().toISOString().split('T')[0],
            weekNumber,
            dayNumber,
            dayLabel: day.dayLabel,
            notes: workoutNotes,
            startedAt,
            completedAt: new Date().toISOString(),
            entries,
        };
        await addWorkoutLog(log);

        const allLogs = [...workoutLogs, log];

        // Calculate reactions
        if (settings.reactionsEnabled && settings.personalityMode !== 'silent') {
            const reactions = evaluateReactions(log, allLogs, settings);

            // Streak update
            const today = new Date().toISOString().split('T')[0];
            const newStreak = calculateStreak(settings.lastWorkoutDate, today, settings.currentStreak);
            const streakReaction = settings.streaksEnabled ? getStreakMessage(newStreak, settings.personalityMode) : null;

            // Update settings with new streak
            await updateSettings({
                currentStreak: newStreak,
                lastWorkoutDate: today,
            });

            // Publish milestones (fire-and-forget — don't block UI)
            if (user) {
                const updatedSettings = { ...settings, currentStreak: newStreak, lastWorkoutDate: today };
                detectAndPublishMilestones(
                    user.uid, user.displayName || 'User', user.photoURL, log, allLogs, updatedSettings
                ).catch(err => console.error('Milestone publish failed:', err));
            }

            // Combine reactions (streak message has special priority)
            const allReactions = streakReaction ? [streakReaction, ...reactions] : reactions;
            const limited = allReactions.slice(0, settings.maxReactionsPerWorkout);

            if (limited.length > 0) {
                setShowReactions(limited);
                return; // Don't finish yet — wait for toast dismissal
            }
        } else {
            // Still update streak even in silent mode
            const today = new Date().toISOString().split('T')[0];
            const newStreak = calculateStreak(settings.lastWorkoutDate, today, settings.currentStreak);
            await updateSettings({ currentStreak: newStreak, lastWorkoutDate: today });

            // Publish milestones in silent mode too
            if (user) {
                const updatedSettings = { ...settings, currentStreak: newStreak, lastWorkoutDate: today };
                detectAndPublishMilestones(
                    user.uid, user.displayName || 'User', user.photoURL, log, allLogs, updatedSettings
                ).catch(err => console.error('Milestone publish failed:', err));
            }
        }

        onFinish();
    };

    const completedSets = entries.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0);
    const totalSets = entries.reduce((sum, e) => sum + (e.skipped ? 0 : e.sets.length), 0);

    return (
        <div className="app-container" style={{ paddingBottom: '100px' }}>
            {/* Header */}
            <div className="app-header" style={{ justifyContent: 'space-between', padding: '0 16px' }}>
                <button className="btn btn-ghost btn-sm" onClick={onFinish}>✕ Cancel</button>
                <h1 style={{
                    fontSize: '14px', color: 'var(--text-secondary)', fontWeight: 600,
                    background: 'none', WebkitTextFillColor: 'var(--text-secondary)', WebkitBackgroundClip: 'unset'
                }}>
                    W{weekNumber} · {day.dayLabel}
                </h1>
                <button className="btn btn-ghost btn-sm" style={{ color: 'var(--accent-green)' }} onClick={handleSave}>
                    ✓ Save
                </button>
            </div>

            <div className="page-content">
                {/* Progress */}
                <div className="card-highlight mb-4" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                        <div className="stat-value" style={{ fontSize: '24px' }}>{completedSets}/{totalSets}</div>
                        <div className="stat-label">Sets Completed</div>
                    </div>
                    <div style={{
                        width: '60px', height: '60px', borderRadius: '50%',
                        background: `conic-gradient(var(--accent-red) ${totalSets ? (completedSets / totalSets * 360) : 0}deg, var(--bg-card) 0deg)`,
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                        <div style={{
                            width: '48px', height: '48px', borderRadius: '50%', background: 'var(--bg-primary)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            fontSize: '12px', fontWeight: 700,
                        }}>
                            {totalSets ? Math.round(completedSets / totalSets * 100) : 0}%
                        </div>
                    </div>
                </div>

                {/* Exercise List */}
                {entries.map((entry, exerciseIdx) => {
                    const prescription = day.exercises[exerciseIdx];
                    const load = prescription ? computeExerciseLoad(prescription, settings) : null;
                    const isExpanded = expandedExercise === exerciseIdx;
                    const isE1RM = prescription?.isE1RM;

                    // Calculate E1RM from top set if available
                    let e1rmSuggestion: number | null = null;
                    if (isE1RM && exerciseIdx > 0) {
                        // Look at the previous exercise entry (the top set) for the E1RM calculation
                        const topSetEntry = entries[exerciseIdx - 1];
                        if (topSetEntry && !topSetEntry.skipped) {
                            const completedTopSet = topSetEntry.sets.find(s => s.completed && s.weight && s.reps);
                            if (completedTopSet && completedTopSet.weight && completedTopSet.reps) {
                                e1rmSuggestion = estimateE1RM(completedTopSet.weight, completedTopSet.reps);
                            }
                        }
                    }

                    return (
                        <div key={entry.id} className={`card mb-2 ${entry.skipped ? '' : ''}`} style={{
                            opacity: entry.skipped ? 0.5 : 1,
                            transition: 'opacity 0.2s ease',
                        }}>
                            {/* Exercise Header */}
                            <div
                                className="flex justify-between items-center"
                                style={{ cursor: 'pointer', marginBottom: isExpanded ? '12px' : 0 }}
                                onClick={() => setExpandedExercise(isExpanded ? -1 : exerciseIdx)}
                            >
                                <div style={{ flex: 1 }}>
                                    <div className="exercise-name" style={{ marginBottom: '2px' }}>{entry.exerciseName}</div>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                                        {prescription && `${formatIntensity(prescription.intensity)}`}
                                        {load && ` · ${formatWeight(load.rounded, settings.units)}`}
                                        {isE1RM && e1rmSuggestion && prescription && typeof prescription.intensity === 'number' && (
                                            <span style={{ color: 'var(--accent-amber)' }}>
                                                {' '}· E1RM suggest: {formatWeight(weightFromE1RM(e1rmSuggestion, prescription.intensity, settings.roundingIncrement).rounded, settings.units)}
                                            </span>
                                        )}
                                    </div>
                                </div>
                                <div className="flex gap-2 items-center">
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={e => { e.stopPropagation(); toggleSkip(exerciseIdx); }}
                                        style={{ color: entry.skipped ? 'var(--accent-red)' : 'var(--text-muted)', fontSize: '11px' }}
                                    >
                                        {entry.skipped ? 'Unskip' : 'Skip'}
                                    </button>
                                    <span style={{ fontSize: '16px', color: 'var(--text-muted)', transition: 'transform 0.2s', transform: isExpanded ? 'rotate(180deg)' : '' }}>
                                        ▼
                                    </span>
                                </div>
                            </div>

                            {/* Set Logging */}
                            {isExpanded && !entry.skipped && (
                                <div className="fade-in">
                                    {/* Column headers */}
                                    <div className="set-row" style={{ borderBottom: '1px solid var(--border-subtle)', paddingBottom: '4px', marginBottom: '4px' }}>
                                        <div className="set-number" style={{ background: 'transparent', fontSize: '10px', color: 'var(--text-muted)' }}>SET</div>
                                        <div className="set-input"><div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>WEIGHT ({settings.units})</div></div>
                                        <div className="set-input"><div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>REPS</div></div>
                                        <div className="set-input" style={{ maxWidth: '60px' }}><div style={{ textAlign: 'center', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600 }}>RPE</div></div>
                                        <div style={{ width: '56px' }}></div>
                                    </div>

                                    {entry.sets.map((set, setIdx) => (
                                        <div key={setIdx} className="set-row">
                                            <div className={`set-number ${set.completed ? 'completed' : ''}`}>{setIdx + 1}</div>
                                            <div className="set-input">
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    placeholder={load ? String(load.rounded) : '—'}
                                                    value={set.weight ?? ''}
                                                    onChange={e => updateSet(exerciseIdx, setIdx, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                                                />
                                            </div>
                                            <div className="set-input">
                                                <input
                                                    type="number"
                                                    inputMode="numeric"
                                                    placeholder={prescription?.reps ? String(prescription.reps) : '—'}
                                                    value={set.reps ?? ''}
                                                    onChange={e => updateSet(exerciseIdx, setIdx, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                                                />
                                            </div>
                                            <div className="set-input" style={{ maxWidth: '60px' }}>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    placeholder="—"
                                                    value={set.rpe ?? ''}
                                                    onChange={e => updateSet(exerciseIdx, setIdx, 'rpe', e.target.value ? parseFloat(e.target.value) : null)}
                                                />
                                            </div>
                                            <div className="flex gap-1">
                                                {!set.completed ? (
                                                    <button
                                                        className="btn btn-icon btn-sm"
                                                        style={{ background: 'var(--accent-green)', color: 'white', width: '28px', height: '28px', fontSize: '12px' }}
                                                        onClick={() => completeSet(exerciseIdx, setIdx)}
                                                        title="Complete set"
                                                    >✓</button>
                                                ) : (
                                                    <button
                                                        className="btn btn-icon btn-sm"
                                                        style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', width: '28px', height: '28px', fontSize: '12px' }}
                                                        onClick={() => updateSet(exerciseIdx, setIdx, 'completed', false)}
                                                        title="Undo"
                                                    >↩</button>
                                                )}
                                            </div>
                                        </div>
                                    ))}

                                    {/* Actions */}
                                    <div className="flex gap-2 mt-2">
                                        <button className="btn btn-secondary btn-sm" onClick={() => addSet(exerciseIdx)}>
                                            + Add Set
                                        </button>
                                        {entry.sets.length > 1 && (
                                            <button className="btn btn-ghost btn-sm" onClick={() => removeSet(exerciseIdx, entry.sets.length - 1)}>
                                                − Remove
                                            </button>
                                        )}
                                        {entry.sets.length > 1 && (
                                            <button
                                                className="btn btn-ghost btn-sm"
                                                onClick={() => {
                                                    const lastIdx = entry.sets.length - 1;
                                                    if (lastIdx > 0) copyPreviousSet(exerciseIdx, lastIdx);
                                                }}
                                            >
                                                📋 Copy Prev
                                            </button>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    );
                })}

                {/* Notes */}
                <div className="card mt-4">
                    <div className="input-group">
                        <label className="input-label">Workout Notes</label>
                        <textarea
                            className="input"
                            rows={3}
                            placeholder="How did the session feel? Any notes..."
                            value={workoutNotes}
                            onChange={e => setWorkoutNotes(e.target.value)}
                            style={{ resize: 'vertical' }}
                        />
                    </div>
                </div>

                {/* Save Button */}
                <button className="btn btn-primary btn-full mt-4" onClick={handleSave} style={{ marginBottom: '24px' }} disabled={isSaving}>
                    {isSaving ? '⏳ Saving...' : '✓ Complete Workout'}
                </button>
            </div>

            {/* Reaction Toast */}
            {showReactions.length > 0 && (
                <ReactionToast
                    reactions={showReactions}
                    onDismiss={() => {
                        setShowReactions([]);
                        onFinish();
                    }}
                />
            )}
        </div>
    );
}
