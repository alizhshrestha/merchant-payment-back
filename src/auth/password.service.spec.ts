import { PasswordService } from './password.service';

describe('PasswordService', () => {
  const service = new PasswordService();
  const password = 'A long test passphrase 🔐';

  it('uses unique salts and verifies the original password only', async () => {
    const first = await service.hash(password);
    const second = await service.hash(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(first.length).toBeLessThanOrEqual(255);
    expect(await service.verify(password, first)).toBe(true);
    expect(await service.verify('wrong password', first)).toBe(false);
  });

  it.each(['', 'plaintext', 'scrypt$v1$999999999$8$3$bad$bad'])(
    'rejects malformed hash %s',
    async (hash) => {
      expect(await service.verify(password, hash)).toBe(false);
    },
  );

  it('rejects empty and oversized passwords', async () => {
    await expect(service.hash('')).rejects.toThrow();
    await expect(service.hash('x'.repeat(1025))).rejects.toThrow();
    expect(await service.verify('x'.repeat(1025), 'invalid')).toBe(false);
  });
});
