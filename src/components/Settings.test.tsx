import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Settings } from './Settings';
import { useApp } from '@/lib/context';
import { getPersonalityPreviews } from '@/lib/personality';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/lib/personality', () => ({
  getPersonalityPreviews: vi.fn(),
}));

const mockedUseApp = vi.mocked(useApp);
const mockedGetPersonalityPreviews = vi.mocked(getPersonalityPreviews);

describe('Settings', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedGetPersonalityPreviews.mockReturnValue([
      {
        mode: 'dry-coach',
        label: 'Dry Coach',
        description: 'Direct and minimal',
        examples: ['Lift the weight.'],
      },
      {
        mode: 'silent',
        label: 'Silent',
        description: 'No reactions',
        examples: [],
      },
    ] as never);
  });

  it('shows the sign-in card when no user is connected', async () => {
    const user = userEvent.setup();
    const signInWithGoogle = vi.fn().mockResolvedValue(undefined);

    mockedUseApp.mockReturnValue({
      settings: {
        id: 'default',
        units: 'lbs',
        roundingIncrement: 5,
        trainingMaxes: { squat: 300, bench: 200, deadlift: 400 },
        onboardingComplete: true,
        personalityMode: 'dry-coach',
        reactionsEnabled: true,
        missedWorkoutReminders: true,
        streaksEnabled: true,
        maxReactionsPerWorkout: 1,
        disableReactionsDuringTaper: false,
        currentStreak: 3,
        lastWorkoutDate: '2026-03-22',
      },
      updateSettings: vi.fn(),
      user: null,
      signInWithGoogle,
      signOut: vi.fn(),
      syncStatus: 'idle',
    } as ReturnType<typeof useApp>);

    render(<Settings />);

    await user.click(screen.getByRole('button', { name: /sign in with google/i }));

    await waitFor(() => {
      expect(signInWithGoogle).toHaveBeenCalledTimes(1);
    });
  });

  it('saves updated training settings and personality choices', async () => {
    const user = userEvent.setup();
    const updateSettings = vi.fn().mockResolvedValue(undefined);

    mockedUseApp.mockReturnValue({
      settings: {
        id: 'default',
        units: 'lbs',
        roundingIncrement: 5,
        trainingMaxes: { squat: 300, bench: 200, deadlift: 400 },
        onboardingComplete: true,
        personalityMode: 'dry-coach',
        reactionsEnabled: true,
        missedWorkoutReminders: true,
        streaksEnabled: true,
        maxReactionsPerWorkout: 1,
        disableReactionsDuringTaper: false,
        currentStreak: 3,
        lastWorkoutDate: '2026-03-22',
      },
      updateSettings,
      user: {
        uid: 'me',
        displayName: 'Ada',
        email: 'ada@example.com',
        photoURL: null,
      },
      signInWithGoogle: vi.fn(),
      signOut: vi.fn(),
      syncStatus: 'synced',
    } as ReturnType<typeof useApp>);

    render(<Settings />);

    await user.click(screen.getByRole('button', { name: 'Training' }));
    const squatInput = screen.getAllByRole('spinbutton')[0];
    await user.clear(squatInput);
    await user.type(squatInput, '315');

    await user.click(screen.getByRole('button', { name: 'Coach' }));
    await user.click(screen.getByText('Silent'));
    await user.click(screen.getByText('2'));
    await user.click(screen.getByRole('button', { name: /save settings/i }));

    await waitFor(() => {
      expect(updateSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          units: 'lbs',
          roundingIncrement: 5,
          trainingMaxes: {
            squat: 315,
            bench: 200,
            deadlift: 400,
          },
          personalityMode: 'silent',
          maxReactionsPerWorkout: 2,
          onboardingComplete: true,
        })
      );
    });
  });
});
