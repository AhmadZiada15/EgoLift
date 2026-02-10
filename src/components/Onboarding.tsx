'use client';

import React, { useState } from 'react';
import { useApp } from '@/lib/context';
import { UnitType } from '@/lib/types';
import { getDefaultRounding, convertWeight } from '@/lib/calculations';

export function Onboarding() {
    const { updateSettings, program, signInWithGoogle, user } = useApp();
    const [signingIn, setSigningIn] = useState(false);
    const [step, setStep] = useState(0);
    const [units, setUnits] = useState<UnitType>('lbs');
    const [squat, setSquat] = useState('');
    const [bench, setBench] = useState('');
    const [deadlift, setDeadlift] = useState('');
    const [rounding, setRounding] = useState('');

    const defaults = program?.meta.defaultTrainingMaxes;

    const steps = ['welcome', 'units', 'maxes', 'rounding', 'confirm'];

    const handleComplete = async () => {
        const squatLbs = units === 'lbs' ? parseFloat(squat) : convertWeight(parseFloat(squat), 'kg', 'lbs');
        const benchLbs = units === 'lbs' ? parseFloat(bench) : convertWeight(parseFloat(bench), 'kg', 'lbs');
        const deadliftLbs = units === 'lbs' ? parseFloat(deadlift) : convertWeight(parseFloat(deadlift), 'kg', 'lbs');

        await updateSettings({
            units,
            roundingIncrement: parseFloat(rounding) || getDefaultRounding(units),
            trainingMaxes: {
                squat: squatLbs,
                bench: benchLbs,
                deadlift: deadliftLbs,
            },
            onboardingComplete: true,
        });
    };

    const canProceed = () => {
        switch (steps[step]) {
            case 'maxes':
                return squat && bench && deadlift &&
                    parseFloat(squat) > 0 && parseFloat(bench) > 0 && parseFloat(deadlift) > 0;
            case 'rounding':
                return rounding && parseFloat(rounding) > 0;
            default:
                return true;
        }
    };

    return (
        <div className="onboarding-container">
            <div className="step-indicator">
                {steps.map((_, i) => (
                    <div key={i} className={`step-dot ${i === step ? 'active' : i < step ? 'done' : ''}`} />
                ))}
            </div>

            {steps[step] === 'welcome' && (
                <div className="onboarding-step slide-up">
                    <div style={{ fontSize: '64px', marginBottom: '16px' }}>🏋️</div>
                    <h1 className="onboarding-title">EgoLift</h1>
                    <p className="onboarding-subtitle">
                        16-Week Powerlifting Program<br />
                        Track your training, visualize your progress
                    </p>
                    {!user && (
                        <button
                            className="btn btn-google btn-full"
                            onClick={async () => {
                                setSigningIn(true);
                                try { await signInWithGoogle(); } catch { /* handled */ }
                                setSigningIn(false);
                            }}
                            disabled={signingIn}
                        >
                            <svg className="google-icon" viewBox="0 0 24 24" width="20" height="20">
                                <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#4285F4" />
                                <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
                                <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05" />
                                <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
                            </svg>
                            {signingIn ? 'Signing in...' : 'Sign in with Google'}
                        </button>
                    )}
                    {user && (
                        <div className="auth-signed-in-badge">
                            ✓ Signed in as {user.displayName || user.email}
                        </div>
                    )}
                    <button className="btn btn-primary btn-full" onClick={() => setStep(1)} style={{ marginTop: user ? '12px' : '8px' }}>
                        {user ? 'Continue Setup' : 'Get Started'}
                    </button>
                    {!user && (
                        <p className="text-xs text-muted" style={{ marginTop: '8px', opacity: 0.6 }}>
                            You can also sign in later from Settings
                        </p>
                    )}
                </div>
            )}

            {steps[step] === 'units' && (
                <div className="onboarding-step slide-up">
                    <h2 className="section-title">Choose Your Units</h2>
                    <p className="onboarding-subtitle">
                        All weights will be displayed in your preferred unit
                    </p>
                    <div className="toggle-group">
                        <div className={`toggle-option ${units === 'lbs' ? 'active' : ''}`} onClick={() => { setUnits('lbs'); setRounding('5'); }}>
                            Pounds (lbs)
                        </div>
                        <div className={`toggle-option ${units === 'kg' ? 'active' : ''}`} onClick={() => { setUnits('kg'); setRounding('2.5'); }}>
                            Kilograms (kg)
                        </div>
                    </div>
                    <div className="flex gap-3 mt-4">
                        <button className="btn btn-secondary" onClick={() => setStep(0)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={() => setStep(2)}>Next</button>
                    </div>
                </div>
            )}

            {steps[step] === 'maxes' && (
                <div className="onboarding-step slide-up">
                    <h2 className="section-title">Training Maxes</h2>
                    <p className="onboarding-subtitle">
                        Enter your current training maxes (or ~90% of your true 1RM).
                        These are used to calculate your working weights.
                    </p>

                    <div className="input-group">
                        <label className="input-label">Squat ({units})</label>
                        <input
                            className="input"
                            type="number"
                            inputMode="decimal"
                            placeholder={defaults ? `e.g. ${units === 'lbs' ? defaults.squat : Math.round(convertWeight(defaults.squat, 'lbs', 'kg'))}` : 'e.g. 315'}
                            value={squat}
                            onChange={e => setSquat(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Bench ({units})</label>
                        <input
                            className="input"
                            type="number"
                            inputMode="decimal"
                            placeholder={defaults ? `e.g. ${units === 'lbs' ? defaults.bench : Math.round(convertWeight(defaults.bench, 'lbs', 'kg'))}` : 'e.g. 255'}
                            value={bench}
                            onChange={e => setBench(e.target.value)}
                        />
                    </div>

                    <div className="input-group">
                        <label className="input-label">Deadlift ({units})</label>
                        <input
                            className="input"
                            type="number"
                            inputMode="decimal"
                            placeholder={defaults ? `e.g. ${units === 'lbs' ? defaults.deadlift : Math.round(convertWeight(defaults.deadlift, 'lbs', 'kg'))}` : 'e.g. 365'}
                            value={deadlift}
                            onChange={e => setDeadlift(e.target.value)}
                        />
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button className="btn btn-secondary" onClick={() => setStep(1)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canProceed()} onClick={() => setStep(3)}>Next</button>
                    </div>
                </div>
            )}

            {steps[step] === 'rounding' && (
                <div className="onboarding-step slide-up">
                    <h2 className="section-title">Rounding Increment</h2>
                    <p className="onboarding-subtitle">
                        Weights will be rounded to the nearest multiple of this value.
                        Standard: {units === 'lbs' ? '5 lbs' : '2.5 kg'}
                    </p>

                    <div className="input-group">
                        <label className="input-label">Round to ({units})</label>
                        <input
                            className="input"
                            type="number"
                            inputMode="decimal"
                            value={rounding}
                            onChange={e => setRounding(e.target.value)}
                            placeholder={units === 'lbs' ? '5' : '2.5'}
                        />
                    </div>

                    <div className="pill-group mt-2">
                        {(units === 'lbs' ? ['2.5', '5', '10'] : ['1', '1.25', '2.5', '5']).map(v => (
                            <div key={v} className={`pill ${rounding === v ? 'active' : ''}`} onClick={() => setRounding(v)}>
                                {v} {units}
                            </div>
                        ))}
                    </div>

                    <div className="flex gap-3 mt-4">
                        <button className="btn btn-secondary" onClick={() => setStep(2)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} disabled={!canProceed()} onClick={() => setStep(4)}>Next</button>
                    </div>
                </div>
            )}

            {steps[step] === 'confirm' && (
                <div className="onboarding-step slide-up">
                    <h2 className="section-title">Confirm Setup</h2>

                    <div className="card" style={{ textAlign: 'left' }}>
                        <div style={{ marginBottom: '12px' }}>
                            <span className="text-sm text-muted">UNITS</span>
                            <div className="font-bold">{units.toUpperCase()}</div>
                        </div>
                        <div style={{ marginBottom: '12px' }}>
                            <span className="text-sm text-muted">TRAINING MAXES</span>
                            <div>Squat: <span className="font-bold">{squat} {units}</span></div>
                            <div>Bench: <span className="font-bold">{bench} {units}</span></div>
                            <div>Deadlift: <span className="font-bold">{deadlift} {units}</span></div>
                        </div>
                        <div>
                            <span className="text-sm text-muted">ROUNDING</span>
                            <div className="font-bold">{rounding} {units}</div>
                        </div>
                    </div>

                    <p className="text-sm text-muted mt-2">You can change these in Settings anytime.</p>

                    <div className="flex gap-3 mt-4">
                        <button className="btn btn-secondary" onClick={() => setStep(3)}>Back</button>
                        <button className="btn btn-primary" style={{ flex: 1 }} onClick={handleComplete}>
                            🚀 Start Training
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
