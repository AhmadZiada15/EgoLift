'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { computeExerciseLoad, formatIntensity, formatSets, formatReps, formatWeight } from '@/lib/calculations';

interface ProgramBrowserProps {
    onStartWorkout: (weekNumber: number, dayNumber: number) => void;
}

export function ProgramBrowser({ onStartWorkout }: ProgramBrowserProps) {
    const { program, settings, workoutLogs } = useApp();
    const [selectedWeek, setSelectedWeek] = useState(1);
    const [selectedDay, setSelectedDay] = useState(1);

    const week = useMemo(() => program?.weeks.find(w => w.weekNumber === selectedWeek), [program, selectedWeek]);
    const day = useMemo(() => week?.days.find(d => d.dayNumber === selectedDay), [week, selectedDay]);

    const completedWorkouts = useMemo(() => {
        const set = new Set<string>();
        workoutLogs.forEach(log => {
            if (log.completedAt) set.add(`${log.weekNumber}-${log.dayNumber}`);
        });
        return set;
    }, [workoutLogs]);

    if (!program || !settings) return null;

    const isCompleted = completedWorkouts.has(`${selectedWeek}-${selectedDay}`);

    return (
        <div>
            <h2 className="section-title">Program</h2>

            {/* Week Selector */}
            <p className="section-subtitle">Week</p>
            <div className="overflow-x mb-4" style={{ paddingBottom: '4px' }}>
                <div className="pill-group" style={{ flexWrap: 'nowrap', minWidth: 'max-content' }}>
                    {program.weeks.map(w => (
                        <div
                            key={w.weekNumber}
                            className={`pill ${selectedWeek === w.weekNumber ? 'active' : ''}`}
                            onClick={() => { setSelectedWeek(w.weekNumber); setSelectedDay(1); }}
                            style={{ position: 'relative' }}
                        >
                            {w.weekNumber === 16 ? 'Taper' : `W${w.weekNumber}`}
                            {w.days.every(d => completedWorkouts.has(`${w.weekNumber}-${d.dayNumber}`)) && (
                                <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '10px' }}>✅</span>
                            )}
                        </div>
                    ))}
                </div>
            </div>

            {/* Day Selector */}
            {week && (
                <>
                    <p className="section-subtitle">{week.weekLabel}</p>
                    <div className="pill-group mb-4">
                        {week.days.map(d => (
                            <div
                                key={d.dayNumber}
                                className={`pill ${selectedDay === d.dayNumber ? 'active' : ''}`}
                                onClick={() => setSelectedDay(d.dayNumber)}
                                style={{ position: 'relative' }}
                            >
                                {d.dayLabel}
                                {completedWorkouts.has(`${selectedWeek}-${d.dayNumber}`) && (
                                    <span style={{ position: 'absolute', top: '-4px', right: '-4px', fontSize: '10px' }}>✅</span>
                                )}
                            </div>
                        ))}
                    </div>
                </>
            )}

            {/* Day Plan */}
            {day && (
                <div className="card fade-in">
                    <div className="flex justify-between items-center mb-4">
                        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                            Week {selectedWeek} · {day.dayLabel}
                        </h3>
                        {isCompleted && (
                            <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>
                                ✓ Completed
                            </span>
                        )}
                    </div>

                    {day.exercises.map((exercise, idx) => {
                        const load = computeExerciseLoad(exercise, settings);
                        return (
                            <div key={exercise.id} className="exercise-row" style={{ animationDelay: `${idx * 50}ms` }}>
                                <div className="exercise-name">{exercise.name}</div>
                                <div className="exercise-details">
                                    <div className="exercise-detail">
                                        <span className="label">Sets</span>
                                        <span className="value">{formatSets(exercise.sets)}</span>
                                    </div>
                                    <div className="exercise-detail">
                                        <span className="label">Reps</span>
                                        <span className="value">{formatReps(exercise.reps)}</span>
                                    </div>
                                    <div className="exercise-detail">
                                        <span className="label">Intensity</span>
                                        <span className="value exercise-intensity">{formatIntensity(exercise.intensity)}</span>
                                    </div>
                                    {load && (
                                        <div className="exercise-detail">
                                            <span className="label">Load</span>
                                            <span className="value exercise-load">{formatWeight(load.rounded, settings.units)}</span>
                                        </div>
                                    )}
                                    {exercise.tempo && (
                                        <div className="exercise-detail">
                                            <span className="label">Tempo</span>
                                            <span className="value">{exercise.tempo}</span>
                                        </div>
                                    )}
                                    {exercise.restSeconds && (
                                        <div className="exercise-detail">
                                            <span className="label">Rest</span>
                                            <span className="value">{exercise.restSeconds >= 60 ? `${exercise.restSeconds / 60}m` : `${exercise.restSeconds}s`}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}

                    <button
                        className="btn btn-primary btn-full mt-4"
                        onClick={() => onStartWorkout(selectedWeek, selectedDay)}
                    >
                        {isCompleted ? '🔄 Log Again' : '🏋️ Start Workout'}
                    </button>
                </div>
            )}
        </div>
    );
}
