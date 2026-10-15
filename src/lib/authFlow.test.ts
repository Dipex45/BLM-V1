import { getProviderAuthError, isFederatedUser } from './authFlow';

describe('auth flow helpers', () => {
  it('recognizes Google and Apple as federated providers', () => {
    expect(isFederatedUser({ providerData: [{ providerId: 'google.com' }] } as any)).toBe(true);
    expect(isFederatedUser({ providerData: [{ providerId: 'apple.com' }] } as any)).toBe(true);
    expect(isFederatedUser({ providerData: [{ providerId: 'password' }] } as any)).toBe(false);
  });

  it('explains when a provider has not been enabled', () => {
    expect(getProviderAuthError('Apple', 'auth/operation-not-allowed')).toBe(
      'Apple sign-in is not enabled yet. Contact BLM support or use email and password.',
    );
  });

  it('does not expose raw Firebase codes for unknown provider failures', () => {
    expect(getProviderAuthError('Google', 'auth/internal-error')).toBe(
      'Google sign-in could not be completed. Try again or use email and password.',
    );
  });
});
