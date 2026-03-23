import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ProgramBrowser } from './ProgramBrowser';
import { useApp } from '@/lib/context';
import type { ProgramTemplate, UserSettings, WorkoutLog } from '@/lib/types';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

const mockedUseApp = vi.mocked(useApp);

const settings: UserSettings = {
  id: 'default',
  units: 'lbs',
  roundingIncrement: 5,
  trainingMaxes: {
    squat: 300,
    bench: 200,
    deadlift: 400,
  },
  onboardingComplete: true,
  personalityMode: 'dry-coach',
  reactionsEnabled: true,
  missedWorkoutReminders: true,
  streaksEnabled: true,
  maxReactionsPerWorkout: 1,
  disableReactionsDuringTaper: false,
  currentStreak: 0,
  lastWorkoutDate: null,
};

const program: ProgramTemplate = {
  meta: {
    source: 'test',
    parsedAt: '2026-03-23T00:00:00.000Z',
    defaultTrainingMaxes: {
      squat: 300,
      bench: 200,
      deadlift: 400,
      roundTo: 5,
      units: 'lbs',
    },
    e1rmFormula: 'Epley',
    e1rmFormulaDescription: 'weight * (1 + reps / 30)',
  },
  weeks: [
    {
      weekNumber: 1,
      weekLabel: 'Base Week',
      days: [
        {
          dayNumber: 1,
          dayLabel: 'Squat Day',
          exercises: [
            {
              id: 'sq-1',
              name: 'Competition Squat',
              sets: 4,
              reps: 3,
              intensity: 0.75,
              tempo: null,
              restSeconds: 180,
              computedLoadRule: { liftType: 'squat', percent: 0.75 },
              isE1RM: false,
            },
          ],
        },
        {
          dayNumber: 2,
          dayLabel: 'Bench Day',
          exercises: [
            {
              id: 'bp-1',
              name: 'Bench Press',
              sets: 5,
              reps: 4,
              intensity: 0.7,
              tempo: null,
              restSeconds: 120,
              computedLoadRule: { liftType: 'bench', percent: 0.7 },
              isE1RM: false,
            },
          ],
        },
      ],
    },
    {
      weekNumber: 2,
      weekLabel: 'Peak Week',
      days: [
        {
          dayNumber: 1,
          dayLabel: 'Peak Singles',
          exercises: [
            {
              id: 'dl-1',
              name: 'Deadlift',
              sets: 3,
              reps: 1,
              intensity: 0.8,
              tempo: null,
              restSeconds: 240,
              computedLoadRule: { liftType: 'deadlift', percent: 0.8 },
              isE1RM: false,
            },
          ],
        },
        {
          dayNumber: 2,
          dayLabel: 'Tune-Up Bench',
          exercises: [
            {
              id: 'bp-2',
              name: 'Close Grip Bench',
              sets: 4,
              reps: 3,
              intensity: 0.72,
              tempo: '20X1',
              restSeconds: 90,
              computedLoadRule: { liftType: 'bench', percent: 0.72 },
              isE1RM: false,
            },
          ],
        },
      ],
    },
  ],
};

function createWorkoutLogs(): WorkoutLog[] {
  return [
    {
      id: 'log-1',
      date: '2026-03-20',
      weekNumber: 2,
      dayNumber: 1,
      dayLabel: 'Peak Singles',
      notes: '',
      startedAt: '2026-03-20T10:00:00.000Z',
      completedAt: '2026-03-20T11:00:00.000Z',
      entries: [],
    },
  ];
}

describe('ProgramBrowser', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      program,
      settings,
      workoutLogs: createWorkoutLogs(),
    } as ReturnType<typeof useApp>);
  });

  it('opens one week at a time', async () => {
    const user = userEvent.setup();

    render(<ProgramBrowser onStartWorkout={vi.fn()} />);

    expect(screen.getByText('Competition Squat')).toBeInTheDocument();
    expect(screen.queryByText('Close Grip Bench')).not.toBeInTheDocument();
    expect(screen.queryByText('Week Preview')).not.toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /week 2/i }));

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.queryByText('Competition Squat')).not.toBeInTheDocument();
  });

  it('selecting a week resets to its first day', async () => {
    const user = userEvent.setup();

    render(<ProgramBrowser onStartWorkout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /day 2bench day open/i }));
    expect(screen.getByText('Bench Press')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /week 2/i }));

    expect(screen.getByText('Deadlift')).toBeInTheDocument();
    expect(screen.queryByText('Close Grip Bench')).not.toBeInTheDocument();
  });

  it('clicking a day expands its exercises inline', async () => {
    const user = userEvent.setup();

    render(<ProgramBrowser onStartWorkout={vi.fn()} />);

    await user.click(screen.getByRole('button', { name: /week 2/i }));
    expect(screen.getByText('Deadlift')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /day 2tune-up bench open/i }));

    expect(screen.getByText('Close Grip Bench')).toBeInTheDocument();
    expect(screen.queryByText('Deadlift')).not.toBeInTheDocument();
  });

  it('start and repeat use the selected day from the expanded miniwindow', async () => {
    const user = userEvent.setup();
    const onStartWorkout = vi.fn();

    render(<ProgramBrowser onStartWorkout={onStartWorkout} />);

    await user.click(screen.getByRole('button', { name: /week 2/i }));
    await user.click(screen.getAllByRole('button', { name: 'Repeat' })[1]);

    expect(onStartWorkout).toHaveBeenCalledWith(2, 1);

    await user.click(screen.getByRole('button', { name: /day 2tune-up bench open/i }));
    await user.click(screen.getAllByRole('button', { name: 'Start' })[1]);

    expect(onStartWorkout).toHaveBeenCalledWith(2, 2);
  });

  it('removes the old summary metrics from program overview', () => {
    render(<ProgramBrowser onStartWorkout={vi.fn()} />);

    expect(screen.queryByText('Cycle')).not.toBeInTheDocument();
    expect(screen.queryByText('Logged sessions')).not.toBeInTheDocument();
    expect(screen.queryByText('Volume')).not.toBeInTheDocument();
    expect(screen.queryByText('0 lbs')).not.toBeInTheDocument();
    expect(screen.queryByText('Squat—')).not.toBeInTheDocument();
  });
});
