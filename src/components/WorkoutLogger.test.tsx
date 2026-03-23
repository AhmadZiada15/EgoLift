import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { WorkoutLogger } from './WorkoutLogger';
import { useApp } from '@/lib/context';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/lib/personality', () => ({
  evaluateReactions: vi.fn(() => []),
  getStreakMessage: vi.fn(() => null),
  calculateStreak: vi.fn(() => 4),
}));

vi.mock('@/lib/milestones', () => ({
  detectAndPublishMilestones: vi.fn(),
}));

vi.mock('./ReactionToast', () => ({
  ReactionToast: () => <div>Reaction Toast</div>,
}));

let uuidCounter = 0;

vi.mock('uuid', () => ({
  v4: vi.fn(() => {
    uuidCounter += 1;
    return `test-uuid-${uuidCounter}`;
  }),
}));

const mockedUseApp = vi.mocked(useApp);

function createAppState() {
  return {
    program: {
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
                {
                  id: 'bp-1',
                  name: 'Bench Press',
                  sets: 3,
                  reps: 5,
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
      ],
    },
    settings: {
      id: 'default',
      units: 'lbs',
      roundingIncrement: 5,
      trainingMaxes: {
        squat: 300,
        bench: 200,
        deadlift: 400,
      },
      onboardingComplete: true,
      personalityMode: 'silent',
      reactionsEnabled: false,
      missedWorkoutReminders: true,
      streaksEnabled: true,
      maxReactionsPerWorkout: 1,
      disableReactionsDuringTaper: false,
      currentStreak: 3,
      lastWorkoutDate: '2026-03-21',
    },
    addWorkoutLog: vi.fn().mockResolvedValue(undefined),
    workoutLogs: [],
    updateSettings: vi.fn().mockResolvedValue(undefined),
    user: null,
  } as ReturnType<typeof useApp>;
}

describe('WorkoutLogger', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    uuidCounter = 0;
  });

  it('switches focus between exercises without losing the session context', async () => {
    const user = userEvent.setup();
    mockedUseApp.mockReturnValue(createAppState());

    render(<WorkoutLogger weekNumber={1} dayNumber={1} onFinish={vi.fn()} />);

    expect(screen.getByRole('heading', { name: 'Competition Squat' })).toBeInTheDocument();
    expect(screen.getByText('Exercise 1 of 2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /bench press/i }));

    expect(screen.getByRole('heading', { name: 'Bench Press' })).toBeInTheDocument();
    expect(screen.getByText('Exercise 2 of 2')).toBeInTheDocument();
  });

  it('adds a set and saves the workout through the existing completion flow', async () => {
    const user = userEvent.setup();
    const appState = createAppState();
    const onFinish = vi.fn();

    mockedUseApp.mockReturnValue(appState);

    render(<WorkoutLogger weekNumber={1} dayNumber={1} onFinish={onFinish} />);

    expect(screen.getAllByLabelText(/weight/i)).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: /add set/i }));

    expect(screen.getAllByLabelText(/weight/i)).toHaveLength(5);

    await user.click(screen.getByRole('button', { name: /finish session/i }));

    await waitFor(() => {
      expect(appState.addWorkoutLog).toHaveBeenCalledTimes(1);
      expect(appState.updateSettings).toHaveBeenCalledWith({
        currentStreak: 4,
        lastWorkoutDate: expect.any(String),
      });
      expect(onFinish).toHaveBeenCalledTimes(1);
    });
  });

  it('captures entered set values in the saved workout log', async () => {
    const user = userEvent.setup();
    const appState = createAppState();

    mockedUseApp.mockReturnValue(appState);

    render(<WorkoutLogger weekNumber={1} dayNumber={1} onFinish={vi.fn()} />);

    const weightInputs = screen.getAllByLabelText(/weight set/i);
    const repInputs = screen.getAllByLabelText(/reps set/i);

    await user.clear(weightInputs[0]);
    await user.type(weightInputs[0], '235');
    await user.clear(repInputs[0]);
    await user.type(repInputs[0], '4');
    await user.click(screen.getByRole('button', { name: 'Complete set 1' }));
    await user.click(screen.getByRole('button', { name: /finish session/i }));

    await waitFor(() => {
      expect(appState.addWorkoutLog).toHaveBeenCalledTimes(1);
    });

    const savedLog = vi.mocked(appState.addWorkoutLog).mock.calls[0][0];
    expect(savedLog.entries[0].sets[0]).toMatchObject({
      weight: 235,
      reps: 4,
      completed: true,
    });
  });

  it('shows the suggested load and lets the user complete all sets from the active exercise', async () => {
    const user = userEvent.setup();
    mockedUseApp.mockReturnValue(createAppState());

    render(<WorkoutLogger weekNumber={1} dayNumber={1} onFinish={vi.fn()} />);

    expect(screen.getByText('Suggested')).toBeInTheDocument();
    expect(screen.getAllByText('225 lbs').length).toBeGreaterThan(0);

    await user.click(screen.getByRole('button', { name: 'Complete Exercise' }));

    expect(screen.getAllByRole('button', { name: /undo set/i })).toHaveLength(4);

    await user.click(screen.getByRole('button', { name: /competition squat/i }));

    expect(screen.getAllByRole('button', { name: /complete set/i })).toHaveLength(4);
  });
});
