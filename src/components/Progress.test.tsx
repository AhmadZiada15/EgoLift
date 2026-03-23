import { fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Progress } from './Progress';
import { useApp } from '@/lib/context';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AreaChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Area: () => <div>Area</div>,
  XAxis: () => <div>XAxis</div>,
  YAxis: () => <div>YAxis</div>,
  CartesianGrid: () => <div>Grid</div>,
  Tooltip: () => <div>Tooltip</div>,
}));

const mockedUseApp = vi.mocked(useApp);

describe('Progress', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedUseApp.mockReturnValue({
      settings: {
        units: 'lbs',
      },
      workoutLogs: [
        {
          id: 'log-1',
          date: '2026-03-01',
          weekNumber: 1,
          dayNumber: 1,
          dayLabel: 'Squat Day',
          notes: '',
          startedAt: '2026-03-01T10:00:00.000Z',
          completedAt: '2026-03-01T11:00:00.000Z',
          entries: [
            {
              id: 'entry-1',
              prescriptionId: 'sq-1',
              exerciseName: 'Competition Squat',
              skipped: false,
              notes: '',
              sets: [
                { setIndex: 0, weight: 300, weightUnit: 'lbs', reps: 3, rpe: 8, completed: true },
              ],
            },
          ],
        },
        {
          id: 'log-2',
          date: '2026-03-15',
          weekNumber: 2,
          dayNumber: 1,
          dayLabel: 'Squat Day',
          notes: '',
          startedAt: '2026-03-15T10:00:00.000Z',
          completedAt: '2026-03-15T11:00:00.000Z',
          entries: [
            {
              id: 'entry-2',
              prescriptionId: 'sq-2',
              exerciseName: 'Competition Squat',
              skipped: false,
              notes: '',
              sets: [
                { setIndex: 0, weight: 320, weightUnit: 'lbs', reps: 2, rpe: 9, completed: true },
              ],
            },
          ],
        },
      ],
    } as ReturnType<typeof useApp>);
  });

  it('shows progress stats for the selected lift', () => {
    render(<Progress />);

    fireEvent.click(screen.getByRole('button', { name: 'Stats' }));
    expect(screen.getByText('Best Set')).toBeInTheDocument();
    expect(screen.getByText('Latest')).toBeInTheDocument();
    expect(screen.getAllByText('320').length).toBeGreaterThan(0);
    expect(screen.getByText('+20')).toBeInTheDocument();
    expect(screen.queryByText(/Peak E1RM/i)).not.toBeInTheDocument();
  });

  it('updates when switching to a lift with no data', async () => {
    const user = userEvent.setup();

    render(<Progress />);

    await user.click(screen.getByText('Bench'));

    expect(screen.getByText(/No data yet for bench/i)).toBeInTheDocument();
  });
});
