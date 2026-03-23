import { fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { History } from './History';
import { useApp } from '@/lib/context';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

const mockedUseApp = vi.mocked(useApp);

describe('History', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-23T12:00:00.000Z'));
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      workoutLogs: [
        {
          id: 'log-1',
          date: '2026-03-20',
          weekNumber: 3,
          dayNumber: 1,
          dayLabel: 'Competition Squat Day',
          notes: 'Moved well',
          startedAt: '2026-03-20T10:00:00.000Z',
          completedAt: '2026-03-20T11:00:00.000Z',
          entries: [
            {
              id: 'entry-1',
              prescriptionId: 'sq-1',
              exerciseName: 'Competition Squat',
              skipped: false,
              notes: '',
              sets: [
                { setIndex: 0, weight: 315, weightUnit: 'lbs', reps: 3, rpe: 8, completed: true },
              ],
            },
          ],
        },
      ],
      settings: {
        id: 'default',
        units: 'lbs',
        roundingIncrement: 5,
        trainingMaxes: {
          squat: 300,
          bench: 200,
          deadlift: 400,
        },
      },
      updateSettings: vi.fn().mockResolvedValue(undefined),
    } as ReturnType<typeof useApp>);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('opens workout details from the calendar and recent strip', async () => {
    render(<History />);

    fireEvent.click(screen.getByRole('button', { name: '20' }));

    expect(screen.getByText('Competition Squat')).toBeInTheDocument();
    expect(screen.getByText(/315lbs × 3/i)).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /w3d1/i }));

    expect(screen.getByRole('heading', { name: 'Week 3 · Competition Squat Day' })).toBeInTheDocument();
  });

  it('navigates between months and saves updated maxes', async () => {
    const updateSettings = vi.fn().mockResolvedValue(undefined);

    mockedUseApp.mockReturnValue({
      workoutLogs: [],
      settings: {
        id: 'default',
        units: 'lbs',
        roundingIncrement: 5,
        trainingMaxes: {
          squat: 300,
          bench: 200,
          deadlift: 400,
        },
      },
      updateSettings,
    } as ReturnType<typeof useApp>);

    render(<History />);

    expect(screen.getByText('March 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Prev' }));
    expect(screen.getByText('February 2026')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(screen.getByText('March 2026')).toBeInTheDocument();

    fireEvent.change(screen.getByLabelText('Squat lbs'), { target: { value: '325' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save Maxes' }));

    await Promise.resolve();

    expect(updateSettings).toHaveBeenCalledWith({
      trainingMaxes: {
        squat: 325,
        bench: 200,
        deadlift: 400,
      },
    });
  });
});
