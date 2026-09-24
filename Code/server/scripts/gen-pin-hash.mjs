import crypto from 'crypto';
import { promisify } from 'util';

const scryptAsync = promisify(crypto.scrypt);
const pin = process.argv[2] || '1234';
const salt = crypto.randomBytes(16).toString('hex');
const derived = await scryptAsync(pin, salt, 64);
const hash = `scrypt$${salt}$${derived.toString('hex')}`;
const parts = hash.split('$');
const check = await scryptAsync(pin, parts[1], 64);
if (!crypto.timingSafeEqual(check, Buffer.from(parts[2], 'hex'))) {
  throw new Error('hash verify failed');
}
process.stdout.write(hash + '\n');
