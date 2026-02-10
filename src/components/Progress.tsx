'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { estimateE1RM, convertWeight, formatWeight } from '@/lib/calculations';
import { WorkoutLog, ExerciseLogEntry, UnitType, ChartDataPoint } from '@/lib/types';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

type LiftFilter = 'squat' | 'bench' | 'deadlift';
type TimeRange = '4w' | '8w' | 'all';
type ChartType = 'topSet' | 'e1rm';

const LIFT_KEYWORDS: Record<LiftFilter, string[]> = {
    squat: ['squat', 'ssb', 'front squat'],
    bench: ['bench', 'press', 'close grip', 'touch and go', 'feet up', 'board', 'pin press'],
    deadlift: ['deadlift', 'sldl'],
};

const COMPETITION_KEYWORDS: Record<LiftFilter, string[]> = {
    squat: ['competition squat'],
    bench: ['competition pause bench', 'competition bench', 'paused bench'],
    deadlift: ['competition deadlift'],
};

function matchesLift(exerciseName: string, lift: LiftFilter, competitionOnly: boolean): boolean {
    const name = exerciseName.toLowerCase();
    const keywords = competitionOnly ? COMPETITION_KEYWORDS[lift] : LIFT_KEYWORDS[lift];
    return keywords.some(k => name.includes(k));
}

function getTopSetWeight(entry: ExerciseLogEntry): number | null {
    const completedSets = entry.sets.filter(s => s.completed && s.weight !== null);
    if (completedSets.length === 0) return null;
    return Math.max(...completedSets.map(s => s.weight!));
}

function getE1RMFromEntry(entry: ExerciseLogEntry): number | null {
    const completedSets = entry.sets.filter(s => s.completed && s.weight !== null && s.reps !== null);
    if (completedSets.length === 0) return null;

    let bestE1RM = 0;
    for (const set of completedSets) {
        const e1rm = estimateE1RM(set.weight!, set.reps!);
        if (e1rm > bestE1RM) bestE1RM = e1rm;
    }
    return bestE1RM > 0 ? Math.round(bestE1RM * 10) / 10 : null;
}

const COLORS: Record<LiftFilter, string> = {
    squat: '#e53e3e',
    bench: '#4299e1',
    deadlift: '#48bb78',
};

export function Progress() {
    const { workoutLogs, settings } = useApp();
    const [lift, setLift] = useState<LiftFilter>('squat');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [chartType, setChartType] = useState<ChartType>('topSet');
    const [competitionOnly, setCompetitionOnly] = useState(false);

    const chartData = useMemo(() => {
        if (!settings) return [];

        let filteredLogs = [...workoutLogs].reverse(); // chronological order

        // Time range filter
        if (timeRange !== 'all') {
            const weeks = timeRange === '4w' ? 4 : 8;
            const cutoff = new Date();
            cutoff.setDate(cutoff.getDate() - weeks * 7);
            const cutoffStr = cutoff.toISOString().split('T')[0];
            filteredLogs = filteredLogs.filter(l => l.date >= cutoffStr);
        }

        const points: ChartDataPoint[] = [];

        for (const log of filteredLogs) {
            for (const entry of log.entries) {
                if (entry.skipped) continue;
                if (!matchesLift(entry.exerciseName, lift, competitionOnly)) continue;

                const value = chartType === 'topSet'
                    ? getTopSetWeight(entry)
                    : getE1RMFromEntry(entry);

                if (value !== null) {
                    points.push({
                        date: log.date,
                        value: Math.round(value),
                        label: `W${log.weekNumber} ${log.dayLabel}`,
                        weekNumber: log.weekNumber,
                    });
                }
            }
        }

        // Deduplicate by date (take best value per date)
        const byDate = new Map<string, ChartDataPoint>();
        for (const p of points) {
            const existing = byDate.get(p.date);
            if (!existing || p.value > existing.value) {
                byDate.set(p.date, p);
            }
        }

        return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
    }, [workoutLogs, lift, timeRange, chartType, competitionOnly, settings]);

    // Stats
    const currentBest = chartData.length > 0 ? Math.max(...chartData.map(d => d.value)) : 0;
    const firstValue = chartData.length > 0 ? chartData[0].value : 0;
    const lastValue = chartData.length > 0 ? chartData[chartData.length - 1].value : 0;
    const improvement = lastValue - firstValue;

    if (!settings) return null;

    const CustomTooltip = ({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDataPoint }> }) => {
        if (!active || !payload?.length) return null;
        const data = payload[0].payload;
        return (
            <div style={{
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border-subtle)',
                borderRadius: '8px',
                padding: '8px 12px',
                fontSize: '12px',
            }}>
                <div style={{ fontWeight: 600 }}>{data.value} {settings.units}</div>
                <div style={{ color: 'var(--text-muted)' }}>{data.label}</div>
                <div style={{ color: 'var(--text-muted)' }}>{data.date}</div>
            </div>
        );
    };

    return (
        <div>
            <h2 className="section-title">Progress</h2>

            {/* Lift Selector */}
            <div className="pill-group mb-4">
                {(['squat', 'bench', 'deadlift'] as LiftFilter[]).map(l => (
                    <div
                        key={l}
                        className={`pill ${lift === l ? 'active' : ''}`}
                        onClick={() => setLift(l)}
                        style={lift === l ? { background: COLORS[l] } : {}}
                    >
                        {l.charAt(0).toUpperCase() + l.slice(1)}
                    </div>
                ))}
            </div>

            {/* Chart Type Toggle */}
            <div className="toggle-group mb-4">
                <div className={`toggle-option ${chartType === 'topSet' ? 'active' : ''}`}
                    onClick={() => setChartType('topSet')}>
                    Top Set
                </div>
                <div className={`toggle-option ${chartType === 'e1rm' ? 'active' : ''}`}
                    onClick={() => setChartType('e1rm')}>
                    Est. 1RM
                </div>
            </div>

            {/* Time Range */}
            <div className="pill-group mb-4">
                {[
                    { key: '4w' as TimeRange, label: '4 Weeks' },
                    { key: '8w' as TimeRange, label: '8 Weeks' },
                    { key: 'all' as TimeRange, label: 'All Time' },
                ].map(opt => (
                    <div
                        key={opt.key}
                        className={`pill ${timeRange === opt.key ? 'active' : ''}`}
                        onClick={() => setTimeRange(opt.key)}
                        style={timeRange === opt.key ? { background: 'var(--bg-card-hover)', borderColor: 'var(--border-active)', color: 'var(--text-primary)' } : {}}
                    >
                        {opt.label}
                    </div>
                ))}
            </div>

            {/* Variation Toggle */}
            <div className="flex items-center gap-2 mb-4" style={{ cursor: 'pointer' }} onClick={() => setCompetitionOnly(!competitionOnly)}>
                <div style={{
                    width: '18px', height: '18px', borderRadius: '4px',
                    border: '2px solid var(--border-active)',
                    background: competitionOnly ? COLORS[lift] : 'transparent',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '11px', color: 'white', transition: 'all 0.2s',
                }}>
                    {competitionOnly && '✓'}
                </div>
                <span className="text-sm text-secondary">Competition lifts only</span>
            </div>

            {/* Chart */}
            <div className="card mb-4">
                {chartData.length === 0 ? (
                    <div className="empty-state" style={{ padding: '32px 16px' }}>
                        <div className="empty-state-icon">📊</div>
                        <div className="empty-state-text">
                            No data yet for {lift}.<br />Log some workouts to see your progress!
                        </div>
                    </div>
                ) : (
                    <div style={{ width: '100%', height: 250 }}>
                        <ResponsiveContainer>
                            <AreaChart data={chartData} margin={{ top: 8, right: 8, left: -16, bottom: 8 }}>
                                <defs>
                                    <linearGradient id={`gradient-${lift}`} x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor={COLORS[lift]} stopOpacity={0.3} />
                                        <stop offset="95%" stopColor={COLORS[lift]} stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
                                <XAxis
                                    dataKey="date"
                                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                    tickFormatter={d => {
                                        const parts = d.split('-');
                                        return `${parts[1]}/${parts[2]}`;
                                    }}
                                />
                                <YAxis
                                    tick={{ fill: 'var(--text-muted)', fontSize: 10 }}
                                    domain={['dataMin - 10', 'dataMax + 10']}
                                />
                                <Tooltip content={<CustomTooltip />} />
                                <Area
                                    type="monotone"
                                    dataKey="value"
                                    stroke={COLORS[lift]}
                                    strokeWidth={2}
                                    fill={`url(#gradient-${lift})`}
                                    dot={{ fill: COLORS[lift], strokeWidth: 0, r: 4 }}
                                    activeDot={{ r: 6, fill: COLORS[lift], stroke: 'white', strokeWidth: 2 }}
                                />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                )}
            </div>

            {/* Stats Cards */}
            {chartData.length > 0 && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px' }}>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: COLORS[lift] }}>{currentBest}</div>
                        <div className="stat-label">{chartType === 'e1rm' ? 'Peak E1RM' : 'Best Set'}</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: COLORS[lift] }}>{lastValue}</div>
                        <div className="stat-label">Latest</div>
                    </div>
                    <div className="card" style={{ textAlign: 'center' }}>
                        <div style={{ fontSize: '20px', fontWeight: 800, color: improvement >= 0 ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                            {improvement >= 0 ? '+' : ''}{improvement}
                        </div>
                        <div className="stat-label">Change ({settings.units})</div>
                    </div>
                </div>
            )}

            {/* Formula Info */}
            <div className="card mt-4" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                <p className="text-sm text-muted">
                    📐 <strong>E1RM Formula:</strong> Epley method — E1RM = weight × (1 + reps / 30).
                    Calculated from your best logged set for each day.
                </p>
            </div>
        </div>
    );
}
