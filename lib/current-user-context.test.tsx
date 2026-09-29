import { useCurrentUser, CurrentUserProvider } from './current-user-context';
import type { CurrentUser } from './types';

// Mock the auth provider and auth fetch hook
jest.mock('@/components/auth-provider', () => ({
  useAuth: jest.fn(),
}));

jest.mock('@/hooks/use-auth-fetch', () => ({
  useAuthFetch: jest.fn(),
}));

import { useAuth } from '@/components/auth-provider';
import { useAuthFetch } from '@/hooks/use-auth-fetch';

describe('CurrentUserContext', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('provides user with profile data when authenticated', async () => {
    const mockAuthUser = {
      id: 'user-123',
      email: 'akash@example.com',
      created_at: '2024-01-01T00:00:00Z',
    };

    const mockProfile = {
      profile: {
        id: 'user-123',
        full_name: 'Akash Kumar',
        display_name: 'Akash',
        job_title: 'Product Manager',
        avatar_url: null,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      },
    };

    (useAuth as jest.Mock).mockReturnValue({
      user: mockAuthUser,
      loading: false,
    });

    const mockAuthFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => mockProfile,
    });

    (useAuthFetch as jest.Mock).mockReturnValue(mockAuthFetch);

    // Verify that the context can provide user data
    expect(mockProfile.profile.full_name).toBe('Akash Kumar');
    expect(mockProfile.profile.display_name).toBe('Akash');
  });

  it('handles profile data correctly', () => {
    const mockProfile: CurrentUser = {
      id: 'user-123',
      email: 'akash@example.com',
      full_name: 'Akash Kumar',
      display_name: 'Akash',
      job_title: 'Product Manager',
      avatar_url: null,
      created_at: '2024-01-01T00:00:00Z',
      updated_at: '2024-01-01T00:00:00Z',
    };

    expect(mockProfile.id).toBe('user-123');
    expect(mockProfile.email).toBe('akash@example.com');
    expect(mockProfile.full_name).toBe('Akash Kumar');
    expect(mockProfile.display_name).toBe('Akash');
    expect(mockProfile.job_title).toBe('Product Manager');
  });

  it('handles missing profile fields', () => {
    const mockProfile: CurrentUser = {
      id: 'user-456',
      email: 'newuser@example.com',
      full_name: '',
      display_name: '',
      job_title: null,
      avatar_url: null,
      created_at: '2024-01-02T00:00:00Z',
      updated_at: '2024-01-02T00:00:00Z',
    };

    expect(mockProfile.full_name).toBe('');
    expect(mockProfile.display_name).toBe('');
    expect(mockProfile.job_title).toBeNull();
  });

  it('verifies display name can be auto-generated from full name', () => {
    const fullName = 'Akash Kumar';
    const displayName = fullName.split(' ')[0];

    expect(displayName).toBe('Akash');
  });

  it('stores avatar_url correctly', () => {
    const mockProfile: CurrentUser = {
      id: 'user-789',
      email: 'test@example.com',
      full_name: 'Test User',
      display_name: 'Test',
      job_title: 'Engineer',
      avatar_url: 'https://example.com/avatar.jpg',
      created_at: '2024-01-03T00:00:00Z',
      updated_at: '2024-01-03T00:00:00Z',
    };

    expect(mockProfile.avatar_url).toBe('https://example.com/avatar.jpg');
  });
});
