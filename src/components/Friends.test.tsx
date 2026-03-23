import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Friends } from './Friends';
import { useApp } from '@/lib/context';
import {
  acceptFriendRequest,
  ensureUserProfile,
  getFriendSettings,
  getFriendWorkoutLogs,
  getFriends,
  getIncomingRequests,
  getOutgoingRequests,
  getUserProfile,
  rejectFriendRequest,
  saveProfileForSearch,
  searchByFriendCode,
  sendFriendRequest,
  sendNudge,
} from '@/lib/friends';

vi.mock('@/lib/context', () => ({
  useApp: vi.fn(),
}));

vi.mock('@/lib/friends', () => ({
  getFriends: vi.fn(),
  getIncomingRequests: vi.fn(),
  getOutgoingRequests: vi.fn(),
  searchByFriendCode: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  rejectFriendRequest: vi.fn(),
  removeFriend: vi.fn(),
  sendNudge: vi.fn(),
  ensureUserProfile: vi.fn(),
  getUserProfile: vi.fn(),
  getFriendSettings: vi.fn(),
  getFriendWorkoutLogs: vi.fn(),
  saveProfileForSearch: vi.fn(),
}));

vi.mock('./FriendDetail', () => ({
  FriendDetail: ({ friend, onBack }: { friend: { displayName: string }; onBack: () => void }) => (
    <div>
      <div>{`Friend Detail: ${friend.displayName}`}</div>
      <button onClick={onBack}>Back to list</button>
    </div>
  ),
}));

vi.mock('./ActivityFeed', () => ({
  ActivityFeed: () => <div>Activity Feed</div>,
}));

const mockedUseApp = vi.mocked(useApp);
const mockedGetFriends = vi.mocked(getFriends);
const mockedGetIncomingRequests = vi.mocked(getIncomingRequests);
const mockedGetOutgoingRequests = vi.mocked(getOutgoingRequests);
const mockedSearchByFriendCode = vi.mocked(searchByFriendCode);
const mockedSendFriendRequest = vi.mocked(sendFriendRequest);
const mockedSendNudge = vi.mocked(sendNudge);
const mockedEnsureUserProfile = vi.mocked(ensureUserProfile);
const mockedGetUserProfile = vi.mocked(getUserProfile);
const mockedGetFriendSettings = vi.mocked(getFriendSettings);
const mockedGetFriendWorkoutLogs = vi.mocked(getFriendWorkoutLogs);
const mockedSaveProfileForSearch = vi.mocked(saveProfileForSearch);
const mockedAcceptFriendRequest = vi.mocked(acceptFriendRequest);
const mockedRejectFriendRequest = vi.mocked(rejectFriendRequest);

describe('Friends', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockedEnsureUserProfile.mockResolvedValue({
      uid: 'me',
      displayName: 'Ada',
      photoURL: null,
      friendCode: 'EGO-TEST',
      createdAt: '2026-03-23T00:00:00.000Z',
    });
    mockedSaveProfileForSearch.mockResolvedValue();
    mockedGetFriends.mockResolvedValue([
      {
        friendshipId: 'friendship-1',
        uid: 'friend-1',
        displayName: 'Sam',
        photoURL: null,
      },
    ]);
    mockedGetIncomingRequests.mockResolvedValue([]);
    mockedGetOutgoingRequests.mockResolvedValue([]);
    mockedGetFriendSettings.mockResolvedValue({
      currentStreak: 5,
    } as never);
    mockedGetFriendWorkoutLogs.mockResolvedValue([
      {
        id: 'log-1',
        date: '2026-03-22',
        weekNumber: 3,
        dayNumber: 2,
      },
    ] as never);
    mockedSearchByFriendCode.mockResolvedValue(null);
    mockedSendFriendRequest.mockResolvedValue('request-1');
    mockedSendNudge.mockResolvedValue();
    mockedGetUserProfile.mockResolvedValue({
      uid: 'friend-2',
      displayName: 'Rae',
      photoURL: null,
      friendCode: 'EGO-RAE',
      createdAt: '2026-03-23T00:00:00.000Z',
    });
    mockedAcceptFriendRequest.mockResolvedValue();
    mockedRejectFriendRequest.mockResolvedValue();
  });

  it('shows the signed-out empty state', () => {
    mockedUseApp.mockReturnValue({
      user: null,
    } as ReturnType<typeof useApp>);

    render(<Friends />);

    expect(screen.getByText(/Sign in with Google to add friends/i)).toBeInTheDocument();
  });

  it('loads the friend list and opens the friend detail view', async () => {
    const user = userEvent.setup();

    mockedUseApp.mockReturnValue({
      user: {
        uid: 'me',
        displayName: 'Ada',
        photoURL: null,
        email: 'ada@example.com',
      },
    } as ReturnType<typeof useApp>);

    render(<Friends />);

    await waitFor(() => {
      expect(mockedEnsureUserProfile).toHaveBeenCalledWith('me', 'Ada', null);
      expect(screen.getByText('Sam')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Activity' }));
    expect(screen.getByText('Activity Feed')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Friends' }));

    await user.click(screen.getByText('Sam'));
    expect(screen.getByText('Friend Detail: Sam')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: 'Back to list' }));
    expect(screen.getByText('Sam')).toBeInTheDocument();
  });

  it('searches by friend code and sends a request', async () => {
    const user = userEvent.setup();

    mockedUseApp.mockReturnValue({
      user: {
        uid: 'me',
        displayName: 'Ada',
        photoURL: null,
        email: 'ada@example.com',
      },
    } as ReturnType<typeof useApp>);
    mockedSearchByFriendCode.mockResolvedValue({
      uid: 'friend-2',
      displayName: 'Rae',
      photoURL: null,
      friendCode: 'EGO-RAE',
      createdAt: '2026-03-23T00:00:00.000Z',
    });

    render(<Friends />);

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /\+ Add/i })).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: /\+ Add/i }));
    await user.type(screen.getByPlaceholderText(/e.g. EGO-A3K/i), 'ego-rae');
    await user.click(screen.getByRole('button', { name: 'Search' }));

    await waitFor(() => {
      expect(mockedSearchByFriendCode).toHaveBeenCalledWith('EGO-RAE');
      expect(screen.getByText('Rae')).toBeInTheDocument();
    });

    await user.click(screen.getByRole('button', { name: 'Send Request' }));

    await waitFor(() => {
      expect(mockedGetUserProfile).toHaveBeenCalledWith('friend-2');
      expect(mockedSendFriendRequest).toHaveBeenCalledWith(
        'me',
        'Ada',
        null,
        'friend-2',
        'Rae',
        null
      );
    });
  });
});
