'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '@/lib/context';
import { convertWeight, formatWeight } from '@/lib/calculations';
import { UnitType, UserSettings } from '@/lib/types';

type LiftKey = 'squat' | 'bench' | 'deadlift';

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

function getDisplayMaxes(settings: UserSettings) {
    return {
        squat: settings.units === 'lbs'
            ? settings.trainingMaxes.squat
            : Math.round(convertWeight(settings.trainingMaxes.squat, 'lbs', 'kg') * 10) / 10,
        bench: settings.units === 'lbs'
            ? settings.trainingMaxes.bench
            : Math.round(convertWeight(settings.trainingMaxes.bench, 'lbs', 'kg') * 10) / 10,
        deadlift: settings.units === 'lbs'
            ? settings.trainingMaxes.deadlift
            : Math.round(convertWeight(settings.trainingMaxes.deadlift, 'lbs', 'kg') * 10) / 10,
    };
}

function detectLiftKey(exerciseName: string): LiftKey | null {
    const normalized = exerciseName.toLowerCase();
    if (normalized.includes('squat')) return 'squat';
    if (normalized.includes('bench')) return 'bench';
    if (normalized.includes('deadlift')) return 'deadlift';
    return null;
}

function toDisplayUnits(value: number, from: UnitType, to: UnitType): number {
    return from === to ? value : convertWeight(value, from, to);
}

export function History() {
    const { workoutLogs, settings, updateSettings } = useApp();
    const [selectedMonth, setSelectedMonth] = useState(() => new Date());
    const [selectedLog, setSelectedLog] = useState<string | null>(null);
    const [saved, setSaved] = useState(false);

    const [squat, setSquat] = useState('');
    const [bench, setBench] = useState('');
    const [deadlift, setDeadlift] = useState('');

    useEffect(() => {
        if (!settings) return;
        const displayMaxes = getDisplayMaxes(settings);
        setSquat(String(displayMaxes.squat));
        setBench(String(displayMaxes.bench));
        setDeadlift(String(displayMaxes.deadlift));
    }, [settings]);

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay();
        const daysInMonth = lastDay.getDate();
        const days: { date: Date; inMonth: boolean }[] = [];

        for (let i = 0; i < startDayOfWeek; i += 1) {
            days.push({ date: new Date(year, month, -startDayOfWeek + i + 1), inMonth: false });
        }

        for (let day = 1; day <= daysInMonth; day += 1) {
            days.push({ date: new Date(year, month, day), inMonth: true });
        }

        const trailingDays = 7 - (days.length % 7);
        if (trailingDays < 7) {
            for (let day = 1; day <= trailingDays; day += 1) {
                days.push({ date: new Date(year, month + 1, day), inMonth: false });
            }
        }

        return days;
    }, [month, year]);

    const workoutDates = useMemo(() => {
        const grouped = new Map<string, typeof workoutLogs>();
        workoutLogs.forEach((log) => {
            if (!grouped.has(log.date)) grouped.set(log.date, []);
            grouped.get(log.date)!.push(log);
        });
        return grouped;
    }, [workoutLogs]);

    const recentLogs = useMemo(
        () => [...workoutLogs].filter((log) => log.completedAt).sort((a, b) => b.date.localeCompare(a.date)),
        [workoutLogs]
    );
    const selectedWorkoutLog = selectedLog ? workoutLogs.find((log) => log.id === selectedLog) ?? null : null;
    const activeLog = selectedWorkoutLog ?? recentLogs[0] ?? null;
    const completedThisMonth = recentLogs.filter((log) => {
        const logDate = new Date(`${log.date}T00:00:00`);
        return logDate.getFullYear() === year && logDate.getMonth() === month;
    }).length;
    const today = new Date().toISOString().split('T')[0];

    const bestLogged = useMemo(() => {
        const best: Record<LiftKey, number | null> = {
            squat: null,
            bench: null,
            deadlift: null,
        };

        recentLogs.forEach((log) => {
            log.entries.forEach((entry) => {
                const lift = detectLiftKey(entry.exerciseName);
                if (!lift || entry.skipped) return;

                entry.sets.forEach((set) => {
                    if (!set.completed || set.weight === null || !settings) return;
                    const converted = toDisplayUnits(set.weight, set.weightUnit, settings.units);
                    best[lift] = best[lift] === null ? converted : Math.max(best[lift]!, converted);
                });
            });
        });

        return best;
    }, [recentLogs, settings]);

    if (!settings) return null;

    const handleSaveMaxes = async () => {
        const nextMaxes = {
            squat: settings.units === 'lbs' ? parseFloat(squat || '0') : convertWeight(parseFloat(squat || '0'), 'kg', 'lbs'),
            bench: settings.units === 'lbs' ? parseFloat(bench || '0') : convertWeight(parseFloat(bench || '0'), 'kg', 'lbs'),
            deadlift: settings.units === 'lbs' ? parseFloat(deadlift || '0') : convertWeight(parseFloat(deadlift || '0'), 'kg', 'lbs'),
        };

        await updateSettings({ trainingMaxes: nextMaxes });
        setSaved(true);
        window.setTimeout(() => setSaved(false), 1800);
    };

    return (
        <div className="calendar-screen">
            <section className="calendar-hero animate-slide-up">
                <div className="calendar-hero-copy">
                    <p className="program-eyebrow">Calendar</p>
                    <h2 className="calendar-hero-title">{`${MONTH_NAMES[month]} ${year}`}</h2>
                </div>
                <div className="calendar-hero-actions">
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMonth(new Date(year, month - 1, 1))}>Prev</button>
                    <button className="btn btn-ghost btn-sm" onClick={() => setSelectedMonth(new Date(year, month + 1, 1))}>Next</button>
                </div>
            </section>

            <div className="calendar-dashboard">
                <section className="card calendar-card animate-fade-in">
                    <div className="calendar-card-top">
                        <div>
                            <p className="section-subtitle">Sessions</p>
                            <p className="calendar-card-stat">{`${completedThisMonth} this month`}</p>
                        </div>
                        <p className="calendar-card-stat">{`${recentLogs.length} total`}</p>
                    </div>

                    <div className="calendar-grid">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((dayLabel) => (
                            <div key={dayLabel} className="calendar-header">{dayLabel}</div>
                        ))}
                        {calendarDays.map((day, index) => {
                            const dateKey = day.date.toISOString().split('T')[0];
                            const logsForDay = workoutDates.get(dateKey) ?? [];
                            const hasWorkout = logsForDay.length > 0;
                            const isToday = today === dateKey;

                            return (
                                <button
                                    key={`${dateKey}-${index}`}
                                    type="button"
                                    className={`calendar-day ${!day.inMonth ? 'other-month' : ''} ${hasWorkout ? 'has-workout' : ''} ${isToday ? 'today' : ''}`}
                                    onClick={() => {
                                        if (logsForDay[0]) {
                                            setSelectedLog(logsForDay[0].id);
                                        }
                                    }}
                                >
                                    {day.date.getDate()}
                                </button>
                            );
                        })}
                    </div>
                </section>

                <div className="calendar-side-stack">
                    <section className="card calendar-session-card animate-fade-in">
                        <div className="calendar-card-top">
                            <div>
                                <p className="section-subtitle">Selected Session</p>
                                <h3 className="calendar-session-title">
                                    {activeLog ? `Week ${activeLog.weekNumber} · ${activeLog.dayLabel}` : 'No session yet'}
                                </h3>
                            </div>
                            {activeLog && <p className="calendar-card-stat">{new Date(activeLog.date).toLocaleDateString()}</p>}
                        </div>

                        {activeLog ? (
                            <>
                                <div className="calendar-session-list">
                                    {activeLog.entries.map((entry) => (
                                        <div key={entry.id} className="calendar-session-row">
                                            <div>
                                                <div className="calendar-session-exercise">{entry.exerciseName}</div>
                                                <div className="calendar-session-sets">
                                                    {entry.skipped
                                                        ? 'Skipped'
                                                        : entry.sets
                                                            .filter((set) => set.completed)
                                                            .map((set) => `${set.weight ?? '—'}${settings.units} × ${set.reps ?? '—'}`)
                                                            .join(' · ') || 'No completed sets'}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                <div className="calendar-recent-strip">
                                    {recentLogs.slice(0, 4).map((log) => (
                                        <button
                                            key={log.id}
                                            type="button"
                                            className={`calendar-recent-pill ${activeLog.id === log.id ? 'active' : ''}`}
                                            onClick={() => setSelectedLog(log.id)}
                                        >
                                            {`W${log.weekNumber}D${log.dayNumber}`}
                                        </button>
                                    ))}
                                </div>
                            </>
                        ) : (
                            <div className="empty-state">
                                <div className="empty-state-text">No completed sessions yet.</div>
                            </div>
                        )}
                    </section>

                    <section className="card max-tracker-card animate-fade-in">
                        <div className="calendar-card-top">
                            <div>
                                <p className="section-subtitle">1RM Tracking</p>
                                <p className="calendar-card-stat">{`Updates program loads in ${settings.units}`}</p>
                            </div>
                            {saved && <span className="badge badge-subtle">Saved</span>}
                        </div>

                        <div className="max-tracker-grid">
                            <label className="input-group" htmlFor="calendar-squat-max">
                                <span className="input-label">{`Squat ${settings.units}`}</span>
                                <input
                                    id="calendar-squat-max"
                                    className="input input-compact"
                                    type="number"
                                    inputMode="decimal"
                                    value={squat}
                                    onChange={(event) => setSquat(event.target.value)}
                                />
                            </label>
                            <label className="input-group" htmlFor="calendar-bench-max">
                                <span className="input-label">{`Bench ${settings.units}`}</span>
                                <input
                                    id="calendar-bench-max"
                                    className="input input-compact"
                                    type="number"
                                    inputMode="decimal"
                                    value={bench}
                                    onChange={(event) => setBench(event.target.value)}
                                />
                            </label>
                            <label className="input-group" htmlFor="calendar-deadlift-max">
                                <span className="input-label">{`Deadlift ${settings.units}`}</span>
                                <input
                                    id="calendar-deadlift-max"
                                    className="input input-compact"
                                    type="number"
                                    inputMode="decimal"
                                    value={deadlift}
                                    onChange={(event) => setDeadlift(event.target.value)}
                                />
                            </label>
                        </div>

                        <button className="btn btn-primary btn-full" onClick={handleSaveMaxes}>
                            Save Maxes
                        </button>

                        <div className="max-tracker-summary">
                            {(['squat', 'bench', 'deadlift'] as LiftKey[]).map((lift) => (
                                <div key={lift} className="max-summary-row">
                                    <span className="max-summary-label">{lift}</span>
                                    <span className="max-summary-value">
                                        {bestLogged[lift] !== null ? formatWeight(bestLogged[lift]!, settings.units) : '—'}
                                    </span>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
