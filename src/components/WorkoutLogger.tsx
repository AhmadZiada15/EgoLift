'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { WorkoutLog, ExerciseLogEntry, SetLog } from '@/lib/types';
import { computeExerciseLoad, formatWeight, formatIntensity, formatSets, formatReps, estimateE1RM, weightFromE1RM } from '@/lib/calculations';
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

function isExerciseComplete(entry: ExerciseLogEntry): boolean {
    return !entry.skipped && entry.sets.length > 0 && entry.sets.every((set) => set.completed);
}

function getExerciseStatus(entry: ExerciseLogEntry): 'skipped' | 'complete' | 'in-progress' | 'pending' {
    if (entry.skipped) return 'skipped';
    if (isExerciseComplete(entry)) return 'complete';
    if (entry.sets.some((set) => set.completed || set.weight !== null || set.reps !== null || set.rpe !== null)) return 'in-progress';
    return 'pending';
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
    const [activeExerciseIndex, setActiveExerciseIndex] = useState<number>(0);
    const startedAt = useMemo(() => new Date().toISOString(), []);
    const [showReactions, setShowReactions] = useState<Reaction[]>([]);
    const [isSaving, setIsSaving] = useState(false);

    if (!day || !settings) return null;

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

    const setExerciseCompletion = (exerciseIdx: number, completed: boolean) => {
        setEntries(prev => {
            const next = [...prev];
            const entry = { ...next[exerciseIdx] };
            entry.sets = entry.sets.map((set) => ({ ...set, completed }));
            next[exerciseIdx] = entry;
            return next;
        });
    };

    const toggleExerciseCompletion = (exerciseIdx: number) => {
        const entry = entries[exerciseIdx];
        if (!entry) return;
        const shouldComplete = entry.sets.some((set) => !set.completed);
        setExerciseCompletion(exerciseIdx, shouldComplete);
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
    const completedExercises = entries.filter((entry) => entry.skipped || isExerciseComplete(entry)).length;
    const activeEntry = entries[activeExerciseIndex] ?? entries[0];
    const activePrescription = day.exercises[activeExerciseIndex] ?? day.exercises[0];

    if (!activeEntry || !activePrescription) return null;

    const activeLoad = activePrescription ? computeExerciseLoad(activePrescription, settings) : null;
    const activeIsE1RM = activePrescription?.isE1RM;
    const sessionProgress = totalSets ? Math.round((completedSets / totalSets) * 100) : 0;
    const activeStatus = activeEntry ? getExerciseStatus(activeEntry) : 'pending';

    let activeE1RMSuggestion: number | null = null;
    if (activeIsE1RM && activeExerciseIndex > 0) {
        const topSetEntry = entries[activeExerciseIndex - 1];
        if (topSetEntry && !topSetEntry.skipped) {
            const completedTopSet = topSetEntry.sets.find((set) => set.completed && set.weight && set.reps);
            if (completedTopSet?.weight && completedTopSet?.reps) {
                activeE1RMSuggestion = estimateE1RM(completedTopSet.weight, completedTopSet.reps);
            }
        }
    }

    return (
        <div className="app-container workout-logger-page" style={{ paddingBottom: '120px' }}>
            <div className="app-header workout-logger-header">
                <button className="btn btn-ghost btn-sm" onClick={onFinish}>Back</button>
                <h1 className="workout-logger-header-title">{`Week ${weekNumber} · ${day.dayLabel}`}</h1>
                <button className="btn btn-ghost btn-sm" onClick={handleSave} disabled={isSaving}>Save</button>
            </div>

            <div className="page-content">
                <section className="workout-focus animate-slide-up">
                    <p className="program-eyebrow">{`Week ${weekNumber} · Day ${dayNumber}`}</p>
                    <div className="workout-focus-topline">
                        <span className="workout-focus-index">{`Exercise ${activeExerciseIndex + 1} of ${entries.length}`}</span>
                        <span className={`workout-focus-status workout-focus-status-${activeStatus}`}>{activeStatus.replace('-', ' ')}</span>
                    </div>
                    <h2 className="workout-focus-title">{activeEntry.exerciseName}</h2>
                    <div className="workout-focus-meta">
                        <span>{`${formatSets(activePrescription?.sets ?? null)} sets`}</span>
                        <span>&middot;</span>
                        <span>{`${formatReps(activePrescription?.reps ?? null)} reps`}</span>
                        <span>&middot;</span>
                        <span>{formatIntensity(activePrescription?.intensity ?? null)}</span>
                        {activeLoad && (
                            <>
                                <span>&middot;</span>
                                <span>{formatWeight(activeLoad.rounded, settings.units)}</span>
                            </>
                        )}
                    </div>
                    {activeLoad && (
                        <div className="workout-suggested-load">
                            <span className="workout-suggested-label">Suggested</span>
                            <span className="workout-suggested-value">{formatWeight(activeLoad.rounded, settings.units)}</span>
                            <span className="workout-suggested-copy">You can edit any set if you lift something different.</span>
                        </div>
                    )}
                    {activeIsE1RM && activeE1RMSuggestion && activePrescription && typeof activePrescription.intensity === 'number' && (
                        <p className="workout-e1rm-note">
                            {`E1RM suggestion ${formatWeight(weightFromE1RM(activeE1RMSuggestion, activePrescription.intensity, settings.roundingIncrement).rounded, settings.units)}`}
                        </p>
                    )}
                    <div className="workout-progress-block">
                        <div className="workout-progress-track" aria-hidden="true">
                            <div className="workout-progress-fill" style={{ width: `${sessionProgress}%` }} />
                        </div>
                        <div className="workout-progress-meta">
                            <span>{`${completedSets}/${totalSets} sets complete`}</span>
                            <span>{`${completedExercises}/${entries.length} exercises closed`}</span>
                        </div>
                    </div>
                </section>

                <section className="card workout-set-editor animate-fade-in">
                    <div className="workout-set-editor-top">
                        <div>
                            <p className="section-subtitle">Set Logging</p>
                            <p className="workout-set-editor-copy">Edit weights as needed, then check off each set or complete the whole exercise.</p>
                        </div>
                        <button
                            className="btn btn-secondary btn-sm"
                            onClick={() => toggleExerciseCompletion(activeExerciseIndex)}
                        >
                            {isExerciseComplete(activeEntry) ? 'Reset Exercise' : 'Complete Exercise'}
                        </button>
                    </div>
                    {activeEntry.skipped ? (
                        <div className="workout-skipped-state">
                            <p className="workout-skipped-copy">This exercise is currently skipped.</p>
                            <button className="btn btn-secondary btn-sm" onClick={() => toggleSkip(activeExerciseIndex)}>
                                Return Exercise
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="workout-set-grid-header">
                                <div>#</div>
                                <div>{settings.units}</div>
                                <div>Reps</div>
                                <div>RPE</div>
                                <div aria-hidden="true" />
                            </div>

                            {activeEntry.sets.map((set, setIdx) => (
                                <div key={setIdx} className="workout-set-grid-row">
                                    <div className={`set-number ${set.completed ? 'completed' : ''}`}>{setIdx + 1}</div>
                                    <div className="set-input">
                                        <input
                                            aria-label={`Weight set ${setIdx + 1}`}
                                            type="number"
                                            inputMode="decimal"
                                            placeholder={activeLoad ? String(activeLoad.rounded) : '—'}
                                            value={set.weight ?? ''}
                                            onChange={e => updateSet(activeExerciseIndex, setIdx, 'weight', e.target.value ? parseFloat(e.target.value) : null)}
                                        />
                                    </div>
                                    <div className="set-input">
                                        <input
                                            aria-label={`Reps set ${setIdx + 1}`}
                                            type="number"
                                            inputMode="numeric"
                                            placeholder={activePrescription?.reps ? String(activePrescription.reps) : '—'}
                                            value={set.reps ?? ''}
                                            onChange={e => updateSet(activeExerciseIndex, setIdx, 'reps', e.target.value ? parseInt(e.target.value) : null)}
                                        />
                                    </div>
                                    <div className="set-input workout-rpe-input">
                                        <input
                                            aria-label={`RPE set ${setIdx + 1}`}
                                            type="number"
                                            inputMode="decimal"
                                            placeholder="—"
                                            value={set.rpe ?? ''}
                                            onChange={e => updateSet(activeExerciseIndex, setIdx, 'rpe', e.target.value ? parseFloat(e.target.value) : null)}
                                        />
                                    </div>
                                    <div className="workout-set-action">
                                        {!set.completed ? (
                                            <button
                                                className="btn btn-icon btn-sm workout-complete-set"
                                                onClick={() => completeSet(activeExerciseIndex, setIdx)}
                                                title="Complete set"
                                                aria-label={`Complete set ${setIdx + 1}`}
                                            >
                                                Done
                                            </button>
                                        ) : (
                                            <button
                                                className="btn btn-icon btn-sm workout-undo-set"
                                                onClick={() => updateSet(activeExerciseIndex, setIdx, 'completed', false)}
                                                title="Undo set"
                                                aria-label={`Undo set ${setIdx + 1}`}
                                            >
                                                Undo
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}

                            <div className="workout-row-actions">
                                <button className="btn btn-secondary btn-sm" onClick={() => addSet(activeExerciseIndex)}>
                                    Add Set
                                </button>
                                {activeEntry.sets.length > 1 && (
                                    <button className="btn btn-ghost btn-sm" onClick={() => removeSet(activeExerciseIndex, activeEntry.sets.length - 1)}>
                                        Remove Last
                                    </button>
                                )}
                                {activeEntry.sets.length > 1 && (
                                    <button
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => {
                                            const lastIdx = activeEntry.sets.length - 1;
                                            if (lastIdx > 0) copyPreviousSet(activeExerciseIndex, lastIdx);
                                        }}
                                    >
                                        Copy Prev
                                    </button>
                                )}
                                <button className="btn btn-ghost btn-sm" onClick={() => toggleSkip(activeExerciseIndex)}>
                                    Skip Exercise
                                </button>
                            </div>
                        </>
                    )}
                </section>

                <div className="program-divider" />

                <section className="workout-sequence animate-fade-in">
                    <p className="section-subtitle">Session Flow</p>
                    <div className="workout-sequence-list">
                        {entries.map((entry, exerciseIdx) => {
                            const status = getExerciseStatus(entry);
                            const completedSetCount = entry.sets.filter((set) => set.completed).length;
                            const exercisePrescription = day.exercises[exerciseIdx];

                            return (
                                <button
                                    key={entry.id}
                                    type="button"
                                    className={`workout-sequence-item ${activeExerciseIndex === exerciseIdx ? 'active' : ''}`}
                                    onClick={() => {
                                        if (activeExerciseIndex === exerciseIdx) {
                                            toggleExerciseCompletion(exerciseIdx);
                                            return;
                                        }

                                        setActiveExerciseIndex(exerciseIdx);
                                    }}
                                >
                                    <div className="workout-sequence-copy">
                                        <div className="workout-sequence-name">{entry.exerciseName}</div>
                                        <div className="workout-sequence-meta">
                                            {`${formatSets(exercisePrescription?.sets ?? null)} x ${formatReps(exercisePrescription?.reps ?? null)}`}
                                        </div>
                                    </div>
                                    <div className="workout-sequence-right">
                                        <span className={`workout-sequence-status workout-sequence-status-${status}`}>{status.replace('-', ' ')}</span>
                                        <span className="workout-sequence-count">{`${completedSetCount}/${entry.sets.length}`}</span>
                                    </div>
                                </button>
                            );
                        })}
                    </div>
                </section>

                {/* Notes */}
                <div className="card mt-4 workout-notes-card">
                    <div className="input-group">
                        <label className="input-label" htmlFor="workout-notes">Workout Notes</label>
                        <textarea
                            id="workout-notes"
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
                <button className="btn btn-primary btn-full mt-4 workout-finish-button" onClick={handleSave} style={{ marginBottom: '24px' }} disabled={isSaving}>
                    {isSaving ? 'Saving Session...' : 'Finish Session'}
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
