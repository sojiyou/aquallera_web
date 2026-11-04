import { hashPassword, isBcryptHash, verifyPassword } from './passwordHash';

describe('passwordHash', () => {
  test('hashes a password and verifies it', () => {
    const hash = hashPassword('Str0ng!Pass');

    expect(isBcryptHash(hash)).toBe(true);
    expect(hash).not.toContain('Str0ng!Pass');
    expect(verifyPassword('Str0ng!Pass', hash)).toBe(true);
    expect(verifyPassword('wrong-password', hash)).toBe(false);
  });

  test('keeps legacy plaintext values working during migration', () => {
    expect(verifyPassword('legacy-password', 'legacy-password')).toBe(true);
  });
});
