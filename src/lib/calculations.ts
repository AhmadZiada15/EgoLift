/**
 * calculations.ts
 * Load calculation, unit conversion, and E1RM estimation utilities.
 * 
 * Rounding uses MROUND behavior (round to nearest multiple of increment).
 * E1RM uses the Epley formula: weight × (1 + reps / 30)
 */

import { UnitType, UserSettings, ExercisePrescription } from './types';

const LBS_TO_KG = 0.45359237;
const KG_TO_LBS = 1 / LBS_TO_KG;

/**
 * Round a value to the nearest multiple of `increment`.
 * Equivalent to Excel's MROUND function.
 */
export function roundToIncrement(value: number, increment: number): number {
    if (increment === 0) return value;
    return Math.round(value / increment) * increment;
}

/**
 * Convert weight between lbs and kg.
 */
export function convertWeight(value: number, from: UnitType, to: UnitType): number {
    if (from === to) return value;
    return from === 'lbs' ? value * LBS_TO_KG : value * KG_TO_LBS;
}

/**
 * Compute the suggested load for a percentage-based exercise.
 * 
 * @param trainingMaxLbs - The training max in lbs (internal storage unit)
 * @param percent - The intensity as a decimal (e.g., 0.67)
 * @param roundingIncrement - Rounding increment in user's display units
 * @param displayUnits - User's preferred display units
 * @returns Object with rounded and exact load in display units
 */
export function computeLoad(
    trainingMaxLbs: number,
    percent: number,
    roundingIncrement: number,
    displayUnits: UnitType
): { rounded: number; exact: number } {
    // Convert TM to display units first, then apply percentage and round
    const tmInDisplayUnits = displayUnits === 'lbs' ? trainingMaxLbs : convertWeight(trainingMaxLbs, 'lbs', 'kg');
    const exact = tmInDisplayUnits * percent;
    const rounded = roundToIncrement(exact, roundingIncrement);
    return { rounded, exact };
}

/**
 * Compute suggested load for an exercise prescription.
 */
export function computeExerciseLoad(
    exercise: ExercisePrescription,
    settings: UserSettings
): { rounded: number; exact: number } | null {
    if (!exercise.computedLoadRule) return null;
    if (typeof exercise.intensity !== 'number') return null;

    const { liftType, percent } = exercise.computedLoadRule;
    const trainingMaxLbs = settings.trainingMaxes[liftType];

    return computeLoad(trainingMaxLbs, percent, settings.roundingIncrement, settings.units);
}

/**
 * Estimate 1RM using the Epley formula.
 * E1RM = weight × (1 + reps / 30)
 * 
 * Valid for reps > 1. For 1 rep, E1RM = weight.
 */
export function estimateE1RM(weight: number, reps: number): number {
    if (reps <= 0) return 0;
    if (reps === 1) return weight;
    return weight * (1 + reps / 30);
}

/**
 * Calculate weight from E1RM and target percentage.
 */
export function weightFromE1RM(
    e1rm: number,
    percent: number,
    roundingIncrement: number
): { rounded: number; exact: number } {
    const exact = e1rm * percent;
    const rounded = roundToIncrement(exact, roundingIncrement);
    return { rounded, exact };
}

/**
 * Format weight for display with unit suffix.
 */
export function formatWeight(weight: number, units: UnitType): string {
    const rounded = Math.round(weight * 10) / 10;
    return `${rounded} ${units}`;
}

/**
 * Format intensity for display.
 */
export function formatIntensity(intensity: number | string | null): string {
    if (intensity === null) return '—';
    if (typeof intensity === 'number') {
        return `${Math.round(intensity * 100)}%`;
    }
    return String(intensity);
}

/**
 * Format sets for display (handles both numeric and string like "1+2F").
 */
export function formatSets(sets: number | string | null): string {
    if (sets === null) return '—';
    return String(sets);
}

/**
 * Format reps for display.
 */
export function formatReps(reps: number | string | null): string {
    if (reps === null) return '—';
    return String(reps);
}

/**
 * Get default rounding increment for a unit type.
 */
export function getDefaultRounding(units: UnitType): number {
    return units === 'lbs' ? 5 : 2.5;
}
