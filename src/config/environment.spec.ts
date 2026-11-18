import { environmentSchema } from './environment';

const validEnvironment = {
  POSTGRES_HOST: '127.0.0.1',
  POSTGRES_PORT: '5432',
  POSTGRES_USER: 'merchant',
  POSTGRES_PASSWORD: 'test-password',
  POSTGRES_DB: 'merchant_payment',
};

describe('Environment validation', () => {
  it('accepts local settings and converts port strings to numbers', () => {
    const result = environmentSchema.validate(validEnvironment);
    expect(result.error).toBeUndefined();
    expect(result.value).toMatchObject({ PORT: 3000, POSTGRES_PORT: 5432 });
  });

  it.each([undefined, ''])(
    'rejects a missing or empty password (%s)',
    (password) => {
      const result = environmentSchema.validate({
        ...validEnvironment,
        POSTGRES_PASSWORD: password,
      });
      expect(result.error?.message).toContain('POSTGRES_PASSWORD');
    },
  );

  it.each(['abc', '0', '65536', '5432.5'])(
    'rejects invalid port %s',
    (port) => {
      const result = environmentSchema.validate({
        ...validEnvironment,
        POSTGRES_PORT: port,
      });
      expect(result.error?.message).toContain('POSTGRES_PORT');
    },
  );
});
