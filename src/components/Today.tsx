'use client';

import React, { useMemo } from 'react';
import { useApp } from '@/lib/context';
import { computeExerciseLoad, formatIntensity, formatReps, formatSets, formatWeight } from '@/lib/calculations';
import { getCompletedWorkoutSet, getCurrentProgramSelection, getWorkoutKey } from '@/lib/program-state';

interface TodayProps {
    onStartWorkout: (weekNumber: number, dayNumber: number) => void;
}

function getSessionTitle(dayLabel: string, exerciseName?: string): string {
    if (/^week\s*\d+\s*[,.-]?\s*day\s*\d+$/i.test(dayLabel) && exerciseName) {
        if (exerciseName.toLowerCase().includes('squat')) return 'Squat Day';
        if (exerciseName.toLowerCase().includes('bench')) return 'Bench Day';
        if (exerciseName.toLowerCase().includes('deadlift')) return 'Deadlift Day';
    }

    return dayLabel;
}

function getQueueLabel(exerciseName: string): string {
    const normalized = exerciseName.toLowerCase();
    if (normalized.includes('overhead')) return 'OHP';
    if (normalized.includes('squat')) return 'Squat';
    if (normalized.includes('deadlift')) return 'Deadlift';
    if (normalized.includes('bench')) return 'Bench';
    return exerciseName;
}

function getSessionContext(weekNumber: number, dayNumber: number, weekLabel: string, dayLabel: string): string {
    const compact = `W${weekNumber} · D${dayNumber}`;
    const normalizedWeekLabel = weekLabel.trim().toLowerCase();
    const normalizedDayLabel = dayLabel.trim().toLowerCase();

    if (
        normalizedWeekLabel === normalizedDayLabel ||
        /^week\s*\d+\s*[,.-]?\s*day\s*\d+$/i.test(weekLabel) ||
        /^week\s*\d+$/i.test(weekLabel)
    ) {
        return compact;
    }

    return `${compact} · ${weekLabel}`;
}

export function Today({ onStartWorkout }: TodayProps) {
    const { program, settings, workoutLogs } = useApp();
    const currentSelection = useMemo(() => getCurrentProgramSelection(program, workoutLogs), [program, workoutLogs]);
    const completedWorkouts = useMemo(() => getCompletedWorkoutSet(workoutLogs), [workoutLogs]);

    if (!program || !settings || !currentSelection) return null;

    const { week, day } = currentSelection;
    const sessionTitle = getSessionTitle(day.dayLabel, day.exercises[0]?.name);
    const sessionContext = getSessionContext(week.weekNumber, day.dayNumber, week.weekLabel, day.dayLabel);
    const currentKey = getWorkoutKey(week.weekNumber, day.dayNumber);
    const isCompleted = completedWorkouts.has(currentKey);
    const completedInWeek = week.days.filter((item) => completedWorkouts.has(getWorkoutKey(week.weekNumber, item.dayNumber))).length;

    return (
        <div className="today-screen">
            <section className="today-hero animate-slide-up">
                <p className="program-eyebrow">Today</p>
                <h2 className="today-title">{sessionTitle}</h2>
                <p className="today-subcopy">{sessionContext}</p>
                <button
                    className="btn btn-primary today-start-button"
                    onClick={() => onStartWorkout(week.weekNumber, day.dayNumber)}
                >
                    {isCompleted ? 'Repeat Session' : 'Start Session'}
                </button>
            </section>

            <div className="today-layout">
                <section className="card today-focus-card animate-fade-in">
                    <div className="today-card-header">
                        <div>
                            <p className="section-subtitle">Current Day</p>
                            <p className="today-focus-caption">{`${completedInWeek}/${week.days.length} days logged this week`}</p>
                        </div>
                    </div>

                    <div className="today-exercise-list">
                        {day.exercises.map((exercise) => {
                            const load = computeExerciseLoad(exercise, settings);

                            return (
                                <div key={exercise.id} className="today-exercise-row">
                                    <div>
                                        <div className="today-exercise-name">{exercise.name}</div>
                                        <div className="today-exercise-meta">
                                            <span>{`${formatSets(exercise.sets)} x ${formatReps(exercise.reps)}`}</span>
                                            <span>{formatIntensity(exercise.intensity)}</span>
                                        </div>
                                    </div>
                                    <div className="today-exercise-load">
                                        {load ? formatWeight(load.rounded, settings.units) : '—'}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </section>

                <section className="card today-queue-card animate-fade-in">
                    <div className="today-card-header">
                        <div>
                            <p className="section-subtitle">This Week</p>
                            <p className="today-focus-caption">Your place in the cycle</p>
                        </div>
                    </div>

                    <div className="today-week-queue">
                        {week.days.map((dayItem) => {
                            const dayKey = getWorkoutKey(week.weekNumber, dayItem.dayNumber);
                            const dayComplete = completedWorkouts.has(dayKey);
                            const isCurrent = dayItem.dayNumber === day.dayNumber;

                            return (
                                <div key={dayKey} className={`today-queue-item ${isCurrent ? 'current' : ''}`}>
                                    <div className="today-queue-left">
                                        <span className="today-queue-index">{`D${dayItem.dayNumber}`}</span>
                                        <span className="today-queue-name">
                                            {getSessionTitle(dayItem.dayLabel, dayItem.exercises[0]?.name)}
                                        </span>
                                    </div>
                                    <span className={`today-queue-status ${dayComplete ? 'done' : isCurrent ? 'current' : 'upcoming'}`}>
                                        {dayComplete ? 'Logged' : isCurrent ? 'Now' : 'Next'}
                                    </span>
                                </div>
                            );
                        })}
                    </div>

                    <div className="today-lift-strip">
                        {day.exercises.slice(0, 4).map((exercise) => (
                            <span key={exercise.id} className="today-lift-chip">
                                {getQueueLabel(exercise.name)}
                            </span>
                        ))}
                    </div>
                </section>
            </div>
        </div>
    );
}
