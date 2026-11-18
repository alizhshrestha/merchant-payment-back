import { authEnvironmentSchema } from './auth-environment';

describe('JWT configuration', () => {
  it('accepts a 32-byte hex secret', () => {
    expect(
      authEnvironmentSchema.validate({ JWT_SECRET: 'a1'.repeat(32) }).error,
    ).toBeUndefined();
  });
  it.each([undefined, '', 'short-secret', 'z'.repeat(64)])(
    'rejects invalid secret %s',
    (secret) => {
      expect(
        authEnvironmentSchema.validate({ JWT_SECRET: secret }).error,
      ).toBeDefined();
    },
  );
});
