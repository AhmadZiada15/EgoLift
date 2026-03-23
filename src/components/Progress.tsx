'use client';

import React, { useState, useMemo } from 'react';
import { useApp } from '@/lib/context';
import { estimateE1RM } from '@/lib/calculations';
import { ExerciseLogEntry, ChartDataPoint } from '@/lib/types';
import { XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Area, AreaChart } from 'recharts';

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
    squat: '#f5ede0',
    bench: '#c97b8e',
    deadlift: '#c9b5a8',
};

function ProgressTooltip({
    active,
    payload,
    units,
}: {
    active?: boolean;
    payload?: Array<{ payload: ChartDataPoint }>;
    units: string;
}) {
    if (!active || !payload?.length) return null;

    const data = payload[0].payload;
    return (
        <div className="progress-tooltip">
            <div className="progress-tooltip-value">{data.value} {units}</div>
            <div className="progress-tooltip-label">{data.label}</div>
            <div className="progress-tooltip-date">{data.date}</div>
        </div>
    );
}

export function Progress() {
    const { workoutLogs, settings } = useApp();
    const [lift, setLift] = useState<LiftFilter>('squat');
    const [timeRange, setTimeRange] = useState<TimeRange>('all');
    const [chartType, setChartType] = useState<ChartType>('topSet');
    const [competitionOnly, setCompetitionOnly] = useState(false);
    const [panel, setPanel] = useState<'chart' | 'stats'>('chart');

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
    const timeRangeLabel = timeRange === '4w' ? '4 weeks' : timeRange === '8w' ? '8 weeks' : 'all time';
    const liftLabel = lift.charAt(0).toUpperCase() + lift.slice(1);

    if (!settings) return null;

    return (
        <div className="progress-screen">
            <section className="progress-hero animate-slide-up">
                <p className="program-eyebrow">Performance Trends</p>
                <div className="progress-hero-top">
                    <div>
                        <h2 className="progress-hero-title">{liftLabel}</h2>
                        <p className="progress-hero-copy">
                            {chartType === 'topSet' ? 'Track your heaviest working sets.' : 'Track estimated max strength over time.'}
                        </p>
                    </div>
                    <div className="progress-hero-value-block">
                        <div className="progress-hero-value">{currentBest ? `${currentBest}` : '—'}</div>
                        <div className="progress-hero-unit">{settings.units}</div>
                    </div>
                </div>
                <div className="progress-hero-meta">
                    <span>{chartType === 'topSet' ? 'Top Set' : 'Estimated 1RM'}</span>
                    <span>&middot;</span>
                    <span>{timeRangeLabel}</span>
                    <span>&middot;</span>
                    <span>{competitionOnly ? 'competition only' : 'all variations'}</span>
                </div>
            </section>

            <section className="card progress-filter-card">
                <div className="pill-group">
                    {(['squat', 'bench', 'deadlift'] as LiftFilter[]).map(l => (
                        <button
                            key={l}
                            type="button"
                            className={`pill ${lift === l ? 'active' : ''}`}
                            onClick={() => setLift(l)}
                            style={lift === l ? { background: 'var(--accent-red)', color: 'var(--bg-primary)' } : {}}
                        >
                            {l.charAt(0).toUpperCase() + l.slice(1)}
                        </button>
                    ))}
                </div>

                <div className="toggle-group">
                    <button
                        type="button"
                        className={`toggle-option ${chartType === 'topSet' ? 'active' : ''}`}
                        onClick={() => setChartType('topSet')}
                    >
                        Top Set
                    </button>
                    <button
                        type="button"
                        className={`toggle-option ${chartType === 'e1rm' ? 'active' : ''}`}
                        onClick={() => setChartType('e1rm')}
                    >
                        Est. 1RM
                    </button>
                </div>

                <div className="progress-filter-row">
                    <div className="pill-group">
                        {[
                            { key: '4w' as TimeRange, label: '4 Weeks' },
                            { key: '8w' as TimeRange, label: '8 Weeks' },
                            { key: 'all' as TimeRange, label: 'All Time' },
                        ].map(opt => (
                            <button
                                key={opt.key}
                                type="button"
                                className={`pill ${timeRange === opt.key ? 'active' : ''}`}
                                onClick={() => setTimeRange(opt.key)}
                                style={timeRange === opt.key ? { background: 'var(--bg-card-hover)', borderColor: 'var(--border-active)', color: 'var(--text-primary)' } : {}}
                            >
                                {opt.label}
                            </button>
                        ))}
                    </div>

                    <button
                        type="button"
                        className="progress-variation-toggle"
                        onClick={() => setCompetitionOnly(!competitionOnly)}
                    >
                        <div className={`progress-variation-check ${competitionOnly ? 'active' : ''}`}>
                            {competitionOnly && '✓'}
                        </div>
                        <span className="text-sm text-secondary">Competition only</span>
                    </button>
                </div>
            </section>

            <div className="screen-segmented-control" role="tablist" aria-label="Progress view">
                <button type="button" className={`screen-segment ${panel === 'chart' ? 'active' : ''}`} onClick={() => setPanel('chart')}>Chart</button>
                <button type="button" className={`screen-segment ${panel === 'stats' ? 'active' : ''}`} onClick={() => setPanel('stats')}>Stats</button>
            </div>

            <div className="screen-panel progress-screen-panel">
                {panel === 'chart' && (
                    <div className="card progress-chart-card">
                        {chartData.length === 0 ? (
                            <div className="empty-state progress-empty-state" style={{ padding: '32px 16px' }}>
                                <div className="empty-state-icon">📊</div>
                                <div className="empty-state-text">
                                    No data yet for {lift}.<br />Log some workouts to see your progress!
                                </div>
                            </div>
                        ) : (
                            <div style={{ width: '100%', height: 210 }}>
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
                                        <Tooltip content={<ProgressTooltip units={settings.units} />} />
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
                )}

                {panel === 'stats' && (
                    <div className="progress-stats-panel">
                        {chartData.length > 0 && (
                            <div className="progress-stats-grid">
                                <div className="card progress-stat-card">
                                    <div className="progress-stat-value">{currentBest}</div>
                                    <div className="stat-label">{chartType === 'e1rm' ? 'Peak E1RM' : 'Best Set'}</div>
                                </div>
                                <div className="card progress-stat-card">
                                    <div className="progress-stat-value">{lastValue}</div>
                                    <div className="stat-label">Latest</div>
                                </div>
                                <div className="card progress-stat-card">
                                    <div className={`progress-stat-value ${improvement >= 0 ? 'positive' : 'negative'}`}>
                                        {improvement >= 0 ? '+' : ''}{improvement}
                                    </div>
                                    <div className="stat-label">Change ({settings.units})</div>
                                </div>
                            </div>
                        )}

                        <div className="card progress-formula-card">
                            <p className="text-sm text-muted">
                                <strong>E1RM Formula:</strong> Epley method. Estimated 1RM = weight × (1 + reps / 30), using the best logged set for each day.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
