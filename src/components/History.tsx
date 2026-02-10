'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';

export function History() {
    const { workoutLogs, settings } = useApp();
    const [selectedMonth, setSelectedMonth] = useState(() => new Date());
    const [selectedLog, setSelectedLog] = useState<string | null>(null);

    const year = selectedMonth.getFullYear();
    const month = selectedMonth.getMonth();

    // Calendar data
    const calendarDays = useMemo(() => {
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const startDayOfWeek = firstDay.getDay(); // 0=Sun
        const daysInMonth = lastDay.getDate();

        const days: { date: Date; inMonth: boolean }[] = [];

        // Fill previous month
        for (let i = 0; i < startDayOfWeek; i++) {
            const d = new Date(year, month, -startDayOfWeek + i + 1);
            days.push({ date: d, inMonth: false });
        }

        // Current month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push({ date: new Date(year, month, i), inMonth: true });
        }

        // Fill next month
        const remaining = 7 - (days.length % 7);
        if (remaining < 7) {
            for (let i = 1; i <= remaining; i++) {
                days.push({ date: new Date(year, month + 1, i), inMonth: false });
            }
        }

        return days;
    }, [year, month]);

    const workoutDates = useMemo(() => {
        const map = new Map<string, typeof workoutLogs>();
        workoutLogs.forEach(log => {
            const key = log.date;
            if (!map.has(key)) map.set(key, []);
            map.get(key)!.push(log);
        });
        return map;
    }, [workoutLogs]);

    const today = new Date().toISOString().split('T')[0];
    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

    const selectedWorkoutLog = selectedLog ? workoutLogs.find(l => l.id === selectedLog) : null;

    const prevMonth = () => setSelectedMonth(new Date(year, month - 1, 1));
    const nextMonth = () => setSelectedMonth(new Date(year, month + 1, 1));

    return (
        <div>
            <h2 className="section-title">History</h2>

            {/* Month Navigator */}
            <div className="flex justify-between items-center mb-4">
                <button className="btn btn-ghost" onClick={prevMonth}>◀</button>
                <span className="font-bold">{monthNames[month]} {year}</span>
                <button className="btn btn-ghost" onClick={nextMonth}>▶</button>
            </div>

            {/* Calendar Grid */}
            <div className="card mb-4">
                <div className="calendar-grid">
                    {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(d => (
                        <div key={d} className="calendar-header">{d}</div>
                    ))}
                    {calendarDays.map((day, idx) => {
                        const dateStr = day.date.toISOString().split('T')[0];
                        const hasWorkout = workoutDates.has(dateStr);
                        const isToday = dateStr === today;
                        const logsForDay = workoutDates.get(dateStr) || [];

                        return (
                            <div
                                key={idx}
                                className={`calendar-day ${!day.inMonth ? 'other-month' : ''} ${hasWorkout ? 'has-workout' : ''} ${isToday ? 'today' : ''}`}
                                onClick={() => {
                                    if (logsForDay.length > 0) {
                                        setSelectedLog(logsForDay[0].id);
                                    }
                                }}
                            >
                                {day.date.getDate()}
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Stats */}
            <div className="card-highlight mb-4">
                <div className="stat-row">
                    <div>
                        <div className="stat-value">{workoutLogs.filter(l => l.completedAt).length}</div>
                        <div className="stat-label">Total Workouts</div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                        <div className="stat-value" style={{ fontSize: '24px' }}>
                            {workoutLogs.filter(l => {
                                const lastWeek = new Date();
                                lastWeek.setDate(lastWeek.getDate() - 7);
                                return l.date >= lastWeek.toISOString().split('T')[0];
                            }).length}
                        </div>
                        <div className="stat-label">This Week</div>
                    </div>
                </div>
            </div>

            {/* Selected Workout Detail */}
            {selectedWorkoutLog && (
                <div className="card fade-in mb-4">
                    <div className="flex justify-between items-center mb-2">
                        <h3 style={{ fontSize: '16px', fontWeight: 700 }}>
                            Week {selectedWorkoutLog.weekNumber} · {selectedWorkoutLog.dayLabel}
                        </h3>
                        <button className="btn btn-ghost btn-sm" onClick={() => setSelectedLog(null)}>✕</button>
                    </div>
                    <p className="text-sm text-muted mb-4">{new Date(selectedWorkoutLog.date).toLocaleDateString()}</p>

                    {selectedWorkoutLog.entries.map(entry => (
                        <div key={entry.id} className="exercise-row">
                            <div className="exercise-name">
                                {entry.exerciseName}
                                {entry.skipped && <span style={{ color: 'var(--accent-red)', fontSize: '11px', marginLeft: '8px' }}>SKIPPED</span>}
                            </div>
                            {!entry.skipped && entry.sets.length > 0 && (
                                <div style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                                    {entry.sets.filter(s => s.completed).map((set, i) => (
                                        <span key={i} style={{ marginRight: '12px' }}>
                                            {set.weight ?? '—'}{settings?.units} × {set.reps ?? '—'}
                                            {set.rpe ? ` @${set.rpe}` : ''}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}

                    {selectedWorkoutLog.notes && (
                        <div className="mt-2" style={{ fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                            📝 {selectedWorkoutLog.notes}
                        </div>
                    )}
                </div>
            )}

            {/* Recent Workouts List */}
            <p className="section-subtitle">Recent Workouts</p>
            {workoutLogs.length === 0 ? (
                <div className="empty-state">
                    <div className="empty-state-icon">📅</div>
                    <div className="empty-state-text">No workouts logged yet.<br />Start a workout from the Program tab!</div>
                </div>
            ) : (
                workoutLogs.slice(0, 10).map(log => (
                    <div
                        key={log.id}
                        className="card mb-2"
                        style={{ cursor: 'pointer' }}
                        onClick={() => setSelectedLog(log.id)}
                    >
                        <div className="flex justify-between items-center">
                            <div>
                                <div style={{ fontSize: '14px', fontWeight: 600 }}>
                                    Week {log.weekNumber} · {log.dayLabel}
                                </div>
                                <div className="text-sm text-muted">{new Date(log.date).toLocaleDateString()}</div>
                            </div>
                            <div style={{ textAlign: 'right' }}>
                                <div style={{ fontSize: '12px', color: 'var(--accent-green)' }}>
                                    {log.entries.filter(e => !e.skipped).length} exercises
                                </div>
                                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>
                                    {log.entries.reduce((sum, e) => sum + e.sets.filter(s => s.completed).length, 0)} sets
                                </div>
                            </div>
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}
