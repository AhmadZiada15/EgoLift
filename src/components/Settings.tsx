'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { UnitType, PersonalityMode, UserSettings } from '@/lib/types';
import { convertWeight, getDefaultRounding } from '@/lib/calculations';
import { getPersonalityPreviews } from '@/lib/personality';

export function Settings() {
    const { settings, updateSettings, user, signInWithGoogle, signOut, syncStatus } = useApp();
    const previews = getPersonalityPreviews();

    if (!settings) return null;

    const resetKey = [
        settings.units,
        settings.roundingIncrement,
        settings.trainingMaxes.squat,
        settings.trainingMaxes.bench,
        settings.trainingMaxes.deadlift,
        settings.personalityMode,
        settings.reactionsEnabled,
        settings.missedWorkoutReminders,
        settings.streaksEnabled,
        settings.maxReactionsPerWorkout,
        settings.disableReactionsDuringTaper,
        settings.currentStreak,
        settings.lastWorkoutDate ?? '',
        user?.uid ?? 'anonymous',
    ].join('|');

    return (
        <SettingsContent
            key={resetKey}
            settings={settings}
            updateSettings={updateSettings}
            user={user}
            signInWithGoogle={signInWithGoogle}
            signOut={signOut}
            syncStatus={syncStatus}
            previews={previews}
        />
    );
}

function getDisplayTrainingMaxes(settings: UserSettings) {
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

function SettingsContent({
    settings,
    updateSettings,
    user,
    signInWithGoogle,
    signOut,
    syncStatus,
    previews,
}: {
    settings: UserSettings;
    updateSettings: ReturnType<typeof useApp>['updateSettings'];
    user: ReturnType<typeof useApp>['user'];
    signInWithGoogle: ReturnType<typeof useApp>['signInWithGoogle'];
    signOut: ReturnType<typeof useApp>['signOut'];
    syncStatus: ReturnType<typeof useApp>['syncStatus'];
    previews: ReturnType<typeof getPersonalityPreviews>;
}) {
    const [section, setSection] = useState<'account' | 'coach' | 'training' | 'about'>('account');
    const initialMaxes = getDisplayTrainingMaxes(settings);
    const [signingIn, setSigningIn] = useState(false);

    const [units, setUnits] = useState<UnitType>(settings.units);
    const [squat, setSquat] = useState(String(initialMaxes.squat));
    const [bench, setBench] = useState(String(initialMaxes.bench));
    const [deadlift, setDeadlift] = useState(String(initialMaxes.deadlift));
    const [rounding, setRounding] = useState(String(settings.roundingIncrement));
    const [saved, setSaved] = useState(false);

    const [personalityMode, setPersonalityMode] = useState<PersonalityMode>(settings.personalityMode || 'dry-coach');
    const [reactionsEnabled, setReactionsEnabled] = useState(settings.reactionsEnabled ?? true);
    const [missedWorkoutReminders, setMissedWorkoutReminders] = useState(settings.missedWorkoutReminders ?? true);
    const [streaksEnabled, setStreaksEnabled] = useState(settings.streaksEnabled ?? true);
    const [maxReactions, setMaxReactions] = useState(settings.maxReactionsPerWorkout ?? 1);
    const [disableTaperReactions, setDisableTaperReactions] = useState(settings.disableReactionsDuringTaper ?? false);

    const handleUnitChange = (newUnit: UnitType) => {
        if (newUnit === units) return;

        const convertVal = (val: string) => {
            const num = parseFloat(val);
            if (isNaN(num)) return '';
            const converted = convertWeight(num, units, newUnit);
            return String(Math.round(converted * 10) / 10);
        };

        setSquat(convertVal(squat));
        setBench(convertVal(bench));
        setDeadlift(convertVal(deadlift));
        setRounding(String(getDefaultRounding(newUnit)));
        setUnits(newUnit);
    };

    const handleSave = async () => {
        const squatLbs = units === 'lbs' ? parseFloat(squat) : convertWeight(parseFloat(squat), 'kg', 'lbs');
        const benchLbs = units === 'lbs' ? parseFloat(bench) : convertWeight(parseFloat(bench), 'kg', 'lbs');
        const deadliftLbs = units === 'lbs' ? parseFloat(deadlift) : convertWeight(parseFloat(deadlift), 'kg', 'lbs');

        await updateSettings({
            units,
            roundingIncrement: parseFloat(rounding),
            trainingMaxes: {
                squat: squatLbs,
                bench: benchLbs,
                deadlift: deadliftLbs,
            },
            onboardingComplete: true,
            personalityMode,
            reactionsEnabled,
            missedWorkoutReminders,
            streaksEnabled,
            maxReactionsPerWorkout: maxReactions,
            disableReactionsDuringTaper: disableTaperReactions,
        });

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const selectedPreview = previews.find(p => p.mode === personalityMode);

    return (
        <div className="settings-screen">
            <section className="settings-hero animate-slide-up">
                <p className="program-eyebrow">Account & Preferences</p>
                <div className="settings-hero-top">
                    <div>
                        <h2 className="settings-title">Settings</h2>
                        <p className="settings-subcopy">
                            Tune the training experience, cloud access, coach voice, and the exact loading rules behind your program.
                        </p>
                    </div>
                    <div className="settings-hero-badge">
                        {user ? 'Cloud' : 'Local'}
                    </div>
                </div>
            </section>

            <div className="screen-segmented-control settings-screen-switcher" role="tablist" aria-label="Settings section">
                <button type="button" className={`screen-segment ${section === 'account' ? 'active' : ''}`} onClick={() => setSection('account')}>Account</button>
                <button type="button" className={`screen-segment ${section === 'coach' ? 'active' : ''}`} onClick={() => setSection('coach')}>Coach</button>
                <button type="button" className={`screen-segment ${section === 'training' ? 'active' : ''}`} onClick={() => setSection('training')}>Training</button>
                <button type="button" className={`screen-segment ${section === 'about' ? 'active' : ''}`} onClick={() => setSection('about')}>About</button>
            </div>

            <div className="screen-panel settings-screen-panel">
                {section === 'account' && (
                    <div className="card settings-panel-card">
                        <p className="section-subtitle">Account</p>
                        {user ? (
                            <div className="account-card">
                                <div className="account-info">
                                    <div className="account-avatar">
                                        {user.photoURL ? (
                                            <img src={user.photoURL} alt="" className="avatar-img-lg" referrerPolicy="no-referrer" />
                                        ) : (
                                            <span className="avatar-initial-lg">{(user.displayName || user.email || '?')[0].toUpperCase()}</span>
                                        )}
                                    </div>
                                    <div>
                                        <div className="account-name">{user.displayName || 'User'}</div>
                                        <div className="account-email">{user.email}</div>
                                        <div className="account-sync">
                                            {syncStatus === 'synced' && 'Data synced to cloud'}
                                            {syncStatus === 'syncing' && 'Syncing...'}
                                            {syncStatus === 'error' && 'Sync error'}
                                            {syncStatus === 'idle' && 'Cloud storage active'}
                                        </div>
                                    </div>
                                </div>
                                <button className="btn btn-secondary btn-sm" onClick={signOut}>
                                    Sign Out
                                </button>
                            </div>
                        ) : (
                            <div className="account-card-anonymous">
                                <p className="text-sm text-muted" style={{ marginBottom: '12px' }}>
                                    Sign in to sync your data across devices and keep your progress safe in the cloud.
                                </p>
                                <button
                                    className="btn btn-google btn-full"
                                    onClick={async () => {
                                        setSigningIn(true);
                                        try { await signInWithGoogle(); } catch { /* handled */ }
                                        setSigningIn(false);
                                    }}
                                    disabled={signingIn}
                                >
                                    <svg className="google-icon" viewBox="0 0 24 24" width="18" height="18">
                                        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                                    </svg>
                                    {signingIn ? 'Signing in...' : 'Sign in with Google'}
                                </button>
                            </div>
                        )}
                    </div>
                )}

                {section === 'coach' && (
                    <div className="settings-panel-stack">
                        <div className="card settings-panel-card">
                            <p className="section-subtitle">Coach Personality</p>
                            <div className="personality-grid">
                                {previews.map(p => (
                                    <button
                                        key={p.mode}
                                        type="button"
                                        className={`personality-card ${personalityMode === p.mode ? 'active' : ''}`}
                                        onClick={() => setPersonalityMode(p.mode)}
                                    >
                                        <div className="personality-card-title">{p.label}</div>
                                        <div className="personality-card-desc">{p.description}</div>
                                    </button>
                                ))}
                            </div>

                            {selectedPreview && selectedPreview.mode !== 'silent' && (
                                <div className="personality-preview fade-in">
                                    <p className="input-label mb-1" style={{ fontSize: '10px', letterSpacing: '0.08em' }}>Preview</p>
                                    {selectedPreview.examples.map((ex, i) => (
                                        <div key={i} className="personality-preview-msg">
                                            &ldquo;{ex}&rdquo;
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>

                        <div className="card settings-panel-card">
                            <p className="section-subtitle">Notifications</p>
                            <ToggleRow label="Workout reactions" description="Show reactions after completing a workout" enabled={reactionsEnabled} onChange={setReactionsEnabled} />
                            <ToggleRow label="Missed workout reminders" description="Nudge when a scheduled session is missed" enabled={missedWorkoutReminders} onChange={setMissedWorkoutReminders} />
                            <ToggleRow label="Streak tracking" description="Count consecutive training sessions" enabled={streaksEnabled} onChange={setStreaksEnabled} />
                            <ToggleRow label="Mute during taper" description="Disable reactions in Week 16" enabled={disableTaperReactions} onChange={setDisableTaperReactions} />

                            <div className="toggle-row" style={{ borderTop: '1px solid var(--border-subtle)', paddingTop: '12px', marginTop: '12px' }}>
                                <div>
                                    <div className="toggle-row-label">Max reactions per workout</div>
                                </div>
                                <div className="pill-group" style={{ gap: '4px' }}>
                                    {[1, 2, 3].map(n => (
                                        <button
                                            key={n}
                                            type="button"
                                            className={`pill ${maxReactions === n ? 'active' : ''}`}
                                            onClick={() => setMaxReactions(n)}
                                            style={{ padding: '4px 12px', fontSize: '12px', minWidth: '32px', textAlign: 'center' }}
                                        >
                                            {n}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {settings.streaksEnabled && settings.currentStreak > 0 && (
                            <div className="card-highlight">
                                <div className="stat-row">
                                    <div>
                                        <div className="stat-value" style={{ fontSize: '28px' }}>{settings.currentStreak}</div>
                                        <div className="stat-label">Current Streak</div>
                                    </div>
                                    {settings.lastWorkoutDate && (
                                        <div style={{ textAlign: 'right' }}>
                                            <div className="text-sm text-muted">Last workout</div>
                                            <div className="text-sm" style={{ color: 'var(--text-secondary)' }}>
                                                {new Date(settings.lastWorkoutDate).toLocaleDateString()}
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {section === 'training' && (
                    <div className="settings-panel-stack">
                        <div className="card settings-panel-card">
                            <p className="section-subtitle">Units</p>
                            <div className="toggle-group">
                                <button type="button" className={`toggle-option ${units === 'lbs' ? 'active' : ''}`} onClick={() => handleUnitChange('lbs')}>
                                    Pounds (lbs)
                                </button>
                                <button type="button" className={`toggle-option ${units === 'kg' ? 'active' : ''}`} onClick={() => handleUnitChange('kg')}>
                                    Kilograms (kg)
                                </button>
                            </div>
                        </div>

                        <div className="card settings-panel-card">
                            <p className="section-subtitle">Training Maxes</p>
                            <div className="flex flex-col gap-3">
                                <div className="input-group">
                                    <label className="input-label" htmlFor="settings-squat" style={{ fontSize: '11px' }}>Squat ({units})</label>
                                    <input id="settings-squat" className="input input-compact" type="number" inputMode="decimal" value={squat} onChange={e => setSquat(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label" htmlFor="settings-bench" style={{ fontSize: '11px' }}>Bench ({units})</label>
                                    <input id="settings-bench" className="input input-compact" type="number" inputMode="decimal" value={bench} onChange={e => setBench(e.target.value)} />
                                </div>
                                <div className="input-group">
                                    <label className="input-label" htmlFor="settings-deadlift" style={{ fontSize: '11px' }}>Deadlift ({units})</label>
                                    <input id="settings-deadlift" className="input input-compact" type="number" inputMode="decimal" value={deadlift} onChange={e => setDeadlift(e.target.value)} />
                                </div>
                            </div>
                        </div>

                        <div className="card settings-panel-card">
                            <p className="section-subtitle">Rounding Increment ({units})</p>
                            <input
                                aria-label={`Rounding Increment (${units})`}
                                className="input input-compact"
                                type="number"
                                inputMode="decimal"
                                value={rounding}
                                onChange={e => setRounding(e.target.value)}
                            />

                            <div className="pill-group mt-2">
                                {(units === 'lbs' ? ['2.5', '5', '10'] : ['1', '1.25', '2.5', '5']).map(v => (
                                    <button type="button" key={v} className={`pill ${rounding === v ? 'active' : ''}`} onClick={() => setRounding(v)} style={{ fontSize: '12px', padding: '6px 12px' }}>
                                        {v}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {section === 'about' && (
                    <div className="card settings-panel-card" style={{ borderColor: 'rgba(255,255,255,0.04)' }}>
                        <p className="text-sm text-muted mb-2"><strong>About</strong></p>
                        <p className="text-sm text-muted">
                            EgoLift — 16-Week Program Tracker<br />
                            {user ? 'Your data is synced to the cloud.' : 'All data is stored locally on your device.'}<br /><br />
                            <strong>Load Calculation:</strong> MROUND(Training Max × Intensity%, Rounding Increment)<br />
                            <strong>E1RM Formula:</strong> Epley — weight × (1 + reps / 30)<br /><br />
                            Program data parsed from the official spreadsheet template.
                        </p>
                    </div>
                )}
            </div>

            <button className="btn btn-primary btn-full settings-save-button" onClick={handleSave}>
                {saved ? 'Saved!' : 'Save Settings'}
            </button>

            {saved && (
                <div className="text-center mt-2 fade-in" style={{ color: 'var(--accent-green)', fontSize: '13px', fontWeight: 600 }}>
                    Settings updated successfully
                </div>
            )}
        </div>
    );
}

// ── Toggle Row Component ─────────────────────────────────────────────────────

function ToggleRow({ label, description, enabled, onChange }: {
    label: string;
    description: string;
    enabled: boolean;
    onChange: (val: boolean) => void;
}) {
    return (
        <div className="toggle-row">
            <div>
                <div className="toggle-row-label">{label}</div>
                <div className="toggle-row-desc">{description}</div>
            </div>
            <button
                type="button"
                className={`toggle-switch ${enabled ? 'on' : ''}`}
                onClick={() => onChange(!enabled)}
                aria-label={label}
            >
                <div className="toggle-switch-thumb" />
            </button>
        </div>
    );
}
