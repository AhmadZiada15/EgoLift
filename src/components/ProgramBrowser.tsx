'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { computeExerciseLoad, formatIntensity, formatReps, formatSets, formatWeight } from '@/lib/calculations';
import { getCompletedWorkoutSet, getCurrentProgramSelection, getWorkoutKey } from '@/lib/program-state';

interface ProgramBrowserProps {
    onStartWorkout: (weekNumber: number, dayNumber: number) => void;
}

function getCompactExerciseName(name: string): string {
    const normalized = name.toLowerCase();
    if (normalized.includes('overhead')) return 'OHP';
    if (normalized.includes('paused bench')) return 'Pause Bench';
    if (normalized.includes('bench')) return 'Bench';
    if (normalized.includes('squat')) return 'Squat';
    if (normalized.includes('deadlift')) return 'Deadlift';
    if (normalized.includes('row')) return 'Row';
    return name.replace(/^competition\s+/i, '').trim();
}

function getSessionTitle(dayLabel: string, exerciseName?: string): string {
    if (/^week\s*\d+\s*[,.-]?\s*day\s*\d+$/i.test(dayLabel) && exerciseName) {
        return `${getCompactExerciseName(exerciseName)} Day`;
    }

    return dayLabel;
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

function getWeekTitle(weekNumber: number): string {
    return weekNumber === 16 ? 'Taper' : `Week ${weekNumber}`;
}

export function ProgramBrowser({ onStartWorkout }: ProgramBrowserProps) {
    const { program, settings, workoutLogs } = useApp();
    const currentSelection = useMemo(() => getCurrentProgramSelection(program, workoutLogs), [program, workoutLogs]);
    const [selectedWeek, setSelectedWeek] = useState<number>(() => currentSelection?.week.weekNumber ?? 1);
    const [selectedDay, setSelectedDay] = useState<number>(() => currentSelection?.day.dayNumber ?? 1);

    const week = useMemo(() => program?.weeks.find((item) => item.weekNumber === selectedWeek), [program, selectedWeek]);
    const day = useMemo(() => week?.days.find((item) => item.dayNumber === selectedDay), [week, selectedDay]);
    const completedWorkouts = useMemo(() => getCompletedWorkoutSet(workoutLogs), [workoutLogs]);

    useEffect(() => {
        if (!program || !currentSelection) return;

        const validWeek = program.weeks.some((item) => item.weekNumber === selectedWeek);
        if (!validWeek) {
            setSelectedWeek(currentSelection.week.weekNumber);
            setSelectedDay(currentSelection.day.dayNumber);
            return;
        }

        const nextWeek = program.weeks.find((item) => item.weekNumber === selectedWeek);
        const validDay = nextWeek?.days.some((item) => item.dayNumber === selectedDay);

        if (!validDay) {
            setSelectedDay(nextWeek?.days[0]?.dayNumber ?? currentSelection.day.dayNumber);
        }
    }, [currentSelection, program, selectedDay, selectedWeek]);

    if (!program || !settings || !week || !day) return null;

    const sessionTitle = getSessionTitle(day.dayLabel, day.exercises[0]?.name);
    const sessionContext = getSessionContext(selectedWeek, selectedDay, week.weekLabel, day.dayLabel);
    const isCompleted = completedWorkouts.has(getWorkoutKey(selectedWeek, selectedDay));
    return (
        <div className="program-overview-screen">
            <section className="program-overview-hero animate-slide-up">
                <div>
                    <p className="program-eyebrow">Program Overview</p>
                    <h2 className="program-hero-title">{sessionTitle}</h2>
                    <p className="program-overview-subcopy">{sessionContext}</p>
                </div>
                <button
                    className="btn btn-outline program-overview-start"
                    onClick={() => onStartWorkout(selectedWeek, selectedDay)}
                >
                    {isCompleted ? 'Repeat' : 'Start'}
                </button>
            </section>

            <div className="program-overview-layout">
                <section className="card program-week-browser animate-fade-in">
                    <div className="program-browser-card-header">
                        <div>
                            <p className="section-subtitle">{getWeekTitle(selectedWeek)}</p>
                            <p className="program-card-copy">{`Selected: Day ${selectedDay} · ${sessionTitle}`}</p>
                        </div>
                    </div>

                    <div className="program-week-list">
                        {program.weeks.map((weekItem) => {
                            const isOpen = selectedWeek === weekItem.weekNumber;
                            const completedDays = weekItem.days.filter((dayItem) =>
                                completedWorkouts.has(getWorkoutKey(weekItem.weekNumber, dayItem.dayNumber))
                            ).length;

                            return (
                                <div key={weekItem.weekNumber} className={`program-week-group ${isOpen ? 'open' : ''}`}>
                                    <button
                                        type="button"
                                        className={`program-week-button ${isOpen ? 'active' : ''}`}
                                        onClick={() => {
                                            setSelectedWeek(weekItem.weekNumber);
                                            setSelectedDay(weekItem.days[0]?.dayNumber ?? 1);
                                        }}
                                    >
                                        <div className="program-week-button-copy">
                                            <span className="program-week-button-title">{getWeekTitle(weekItem.weekNumber)}</span>
                                            <span className="program-week-button-meta">{`${completedDays}/${weekItem.days.length} done`}</span>
                                        </div>
                                        <span className="program-week-button-toggle" aria-hidden="true">
                                            {isOpen ? '−' : '+'}
                                        </span>
                                    </button>

                                    {isOpen && (
                                        <div className="program-week-focus-window">
                                            {weekItem.days.map((dayItem) => {
                                                const dayKey = getWorkoutKey(weekItem.weekNumber, dayItem.dayNumber);
                                                const dayComplete = completedWorkouts.has(dayKey);
                                                const isSelectedDay = selectedDay === dayItem.dayNumber;
                                                const dayTitle = getSessionTitle(dayItem.dayLabel, dayItem.exercises[0]?.name);

                                                return (
                                                    <div
                                                        key={dayKey}
                                                        className={`program-day-panel ${isSelectedDay ? 'active' : ''}`}
                                                    >
                                                        <button
                                                            type="button"
                                                            className={`program-day-button ${isSelectedDay ? 'active' : ''}`}
                                                            onClick={() => setSelectedDay(dayItem.dayNumber)}
                                                        >
                                                            <div className="program-day-button-copy">
                                                                <span className="program-day-button-kicker">{`Day ${dayItem.dayNumber}`}</span>
                                                                <span className="program-day-button-title">{dayTitle}</span>
                                                            </div>
                                                            <span className={`program-day-button-status ${dayComplete ? 'done' : 'open'}`}>
                                                                {dayComplete ? 'Logged' : 'Open'}
                                                            </span>
                                                        </button>

                                                        {isSelectedDay && (
                                                            <div className="program-day-expanded">
                                                                <div className="program-day-expanded-header">
                                                                    <div>
                                                                        <p className="program-day-expanded-kicker">{`Day ${dayItem.dayNumber}`}</p>
                                                                        <h3 className="program-day-expanded-title">{dayTitle}</h3>
                                                                    </div>
                                                                    <button
                                                                        className="btn btn-secondary btn-sm"
                                                                        onClick={() => onStartWorkout(weekItem.weekNumber, dayItem.dayNumber)}
                                                                    >
                                                                        {dayComplete ? 'Repeat' : 'Start'}
                                                                    </button>
                                                                </div>

                                                                <div className="program-day-exercise-list">
                                                                    {dayItem.exercises.map((exercise) => {
                                                                        const load = computeExerciseLoad(exercise, settings);

                                                                        return (
                                                                            <div key={exercise.id} className="program-day-exercise-row">
                                                                                <div>
                                                                                    <div className="program-day-exercise-name">{exercise.name}</div>
                                                                                    <div className="program-day-exercise-meta">
                                                                                        <span>{`${formatSets(exercise.sets)} x ${formatReps(exercise.reps)}`}</span>
                                                                                        <span>{formatIntensity(exercise.intensity)}</span>
                                                                                        {exercise.restSeconds && (
                                                                                            <span>
                                                                                                {exercise.restSeconds >= 60 ? `${exercise.restSeconds / 60}m rest` : `${exercise.restSeconds}s rest`}
                                                                                            </span>
                                                                                        )}
                                                                                    </div>
                                                                                </div>
                                                                                <div className="program-day-exercise-load">
                                                                                    {load ? formatWeight(load.rounded, settings.units) : '—'}
                                                                                </div>
                                                                            </div>
                                                                        );
                                                                    })}
                                                                </div>
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </section>
            </div>
        </div>
    );
}
