import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppShell } from './AppShell';
import { useApp } from '@/lib/context';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('./Onboarding', () => ({
  Onboarding: () => <div>Onboarding Screen</div>,
}));

vi.mock('./ProgramBrowser', () => ({
  ProgramBrowser: ({ onStartWorkout }: { onStartWorkout: (weekNumber: number, dayNumber: number) => void }) => (
    <div>
      <div>Overview Screen</div>
      <button onClick={() => onStartWorkout(3, 2)}>Start overview workout</button>
    </div>
  ),
}));

vi.mock('./Today', () => ({
  Today: ({ onStartWorkout }: { onStartWorkout: (weekNumber: number, dayNumber: number) => void }) => (
    <div>
      <div>Today Screen</div>
      <button onClick={() => onStartWorkout(4, 1)}>Start today workout</button>
    </div>
  ),
}));

vi.mock('./WorkoutLogger', () => ({
  WorkoutLogger: ({
    weekNumber,
    dayNumber,
    onFinish,
  }: {
    weekNumber: number;
    dayNumber: number;
    onFinish: () => void;
  }) => (
    <div>
      <div>{`Workout ${weekNumber}-${dayNumber}`}</div>
      <button onClick={onFinish}>Finish workout</button>
    </div>
  ),
}));

vi.mock('./History', () => ({
  History: () => <div>Calendar Screen</div>,
}));

vi.mock('./Settings', () => ({
  Settings: () => <div>Settings Screen</div>,
}));

const mockedUseApp = vi.mocked(useApp);

function createAppState(overrides: Record<string, unknown> = {}) {
  return {
    settings: {
      onboardingComplete: true,
    },
    loading: false,
    user: null,
    ...overrides,
  } as ReturnType<typeof useApp>;
}

describe('AppShell', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows the loading screen while app data is loading', () => {
    mockedUseApp.mockReturnValue(createAppState({ loading: true }));

    render(<AppShell />);

    expect(screen.getByText('Loading program...')).toBeInTheDocument();
  });

  it('renders onboarding when setup is not complete', () => {
    mockedUseApp.mockReturnValue(
      createAppState({
        settings: { onboardingComplete: false },
      })
    );

    render(<AppShell />);

    expect(screen.getByText('Onboarding Screen')).toBeInTheDocument();
  });

  it('switches tabs and returns to today after finishing a workout', async () => {
    const user = userEvent.setup();
    mockedUseApp.mockReturnValue(createAppState());

    render(<AppShell />);

    expect(screen.getByText('Today Screen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Overview' }));
    expect(screen.getByText('Overview Screen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Start overview workout' }));
    expect(screen.getByText('Workout 3-2')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByText('Overview Screen')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Today' }));
    await user.click(screen.getByRole('button', { name: 'Start today workout' }));
    expect(screen.getByText('Workout 4-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Finish workout' }));
    expect(screen.getByText('Today Screen')).toBeInTheDocument();
  });

  it('opens on the requested initial tab', () => {
    mockedUseApp.mockReturnValue(createAppState());

    render(<AppShell initialTab="calendar" />);

    expect(screen.getByText('Calendar Screen')).toBeInTheDocument();
  });

  it('shows the signed-in user avatar while keeping navigation available', async () => {
    mockedUseApp.mockReturnValue(
      createAppState({
        user: {
          uid: 'user-1',
          displayName: 'Ada',
          email: 'ada@example.com',
          photoURL: null,
        },
      })
    );

    render(<AppShell />);

    await waitFor(() => {
      expect(screen.getByTitle('Ada')).toBeInTheDocument();
    });

    expect(screen.getByRole('button', { name: 'Calendar' })).toBeInTheDocument();
  });
});
