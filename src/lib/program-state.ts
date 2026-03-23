import { ProgramDay, ProgramTemplate, ProgramWeek, WorkoutLog } from './types';

export type ProgramSelection = {
    week: ProgramWeek;
    day: ProgramDay;
};

export function getWorkoutKey(weekNumber: number, dayNumber: number): string {
    return `${weekNumber}-${dayNumber}`;
}

export function getCompletedWorkoutSet(workoutLogs: WorkoutLog[]): Set<string> {
    const completed = new Set<string>();

    workoutLogs.forEach((log) => {
        if (log.completedAt) {
            completed.add(getWorkoutKey(log.weekNumber, log.dayNumber));
        }
    });

    return completed;
}

export function getCurrentProgramSelection(
    program: ProgramTemplate | null,
    workoutLogs: WorkoutLog[]
): ProgramSelection | null {
    if (!program) return null;

    const completed = getCompletedWorkoutSet(workoutLogs);

    for (const week of program.weeks) {
        for (const day of week.days) {
            if (!completed.has(getWorkoutKey(week.weekNumber, day.dayNumber))) {
                return { week, day };
            }
        }
    }

    const finalWeek = program.weeks.at(-1);
    const finalDay = finalWeek?.days.at(-1);

    return finalWeek && finalDay ? { week: finalWeek, day: finalDay } : null;
}
