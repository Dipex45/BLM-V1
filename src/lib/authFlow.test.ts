jest.mock("./firebase", () => ({ db: {} }));

import { getEmailAuthError, getProviderAuthError, isFederatedUser, isStaffRole, landingPathForRole, passwordChecks } from './authFlow';

describe('auth flow helpers', () => {
  it('recognizes Google and Apple as federated providers', () => {
    expect(isFederatedUser({ providerData: [{ providerId: 'google.com' }] } as any)).toBe(true);
    expect(isFederatedUser({ providerData: [{ providerId: 'apple.com' }] } as any)).toBe(true);
    expect(isFederatedUser({ providerData: [{ providerId: 'password' }] } as any)).toBe(false);
  });

  it('explains when a provider has not been enabled', () => {
    expect(getProviderAuthError('Apple', 'auth/operation-not-allowed')).toBe(
      'Apple sign-in isn’t available yet. Please use another option or contact BLM.',
    );
  });

  it('does not expose raw Firebase codes for unknown provider failures', () => {
    expect(getProviderAuthError('Google', 'auth/internal-error')).toBe(
      'Google sign-in didn’t work. Please try again or use another option.',
    );
  });

  it('routes each role to its own workspace', () => {
    expect(landingPathForRole('super_admin')).toBe('/admin');
    expect(landingPathForRole('finance_admin')).toBe('/admin');
    expect(landingPathForRole('driver')).toBe('/driver');
    expect(landingPathForRole('customer')).toBe('/dashboard');
    expect(isStaffRole('customer')).toBe(false);
  });

  it('gives a clear message for wrong email/password combinations', () => {
    expect(getEmailAuthError('auth/invalid-credential')).toMatch(/Wrong email or password/);
    expect(getEmailAuthError('auth/operation-not-allowed')).toMatch(/isn’t switched on/);
  });

  it('enforces the password policy shown on the registration form', () => {
    expect(passwordChecks('short1').every((check) => check.ok)).toBe(false);
    expect(passwordChecks('longenough1').every((check) => check.ok)).toBe(true);
  });
});
