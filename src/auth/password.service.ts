import { Injectable } from '@nestjs/common';
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const OPTIONS = { N: 32768, r: 8, p: 3, maxmem: 64 * 1024 * 1024 };
const PREFIX = 'scrypt$v1$32768$8$3';
const FORMAT = /^scrypt\$v1\$32768\$8\$3\$([a-f0-9]{32})\$([a-f0-9]{128})$/;

function derive(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(password, salt, 64, OPTIONS, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });
}

@Injectable()
export class PasswordService {
  async hash(password: string): Promise<string> {
    if (!password || Buffer.byteLength(password, 'utf8') > 1024) {
      throw new Error('Password must contain between 1 and 1024 UTF-8 bytes');
    }
    const salt = randomBytes(16);
    const key = await derive(password, salt);
    return `${PREFIX}$${salt.toString('hex')}$${key.toString('hex')}`;
  }

  async verify(password: string, encodedHash: string): Promise<boolean> {
    if (!password || Buffer.byteLength(password, 'utf8') > 1024) return false;
    const match = FORMAT.exec(encodedHash);
    if (!match) return false;
    const key = await derive(password, Buffer.from(match[1], 'hex'));
    return timingSafeEqual(key, Buffer.from(match[2], 'hex'));
  }
}
