import { describe, it, expect } from 'vitest';
import { urlBase64ToUint8Array } from './vapid.util';

describe('urlBase64ToUint8Array', () => {
  it('decodes a standard base64 string to the correct bytes', () => {
    // 'hello' encodes to 'aGVsbG8=' in base64
    const result = urlBase64ToUint8Array('aGVsbG8=');
    expect(result).toBeInstanceOf(Uint8Array);
    expect(Array.from(result)).toEqual([104, 101, 108, 108, 111]);
  });

  it('replaces URL-safe characters (- and _) before decoding', () => {
    // '+/8=' in standard base64 becomes '-_8=' in URL-safe base64
    const urlSafe = urlBase64ToUint8Array('-_8=');
    const standard = urlBase64ToUint8Array('+/8=');
    expect(Array.from(urlSafe)).toEqual(Array.from(standard));
  });

  it('adds missing padding so atob does not throw on unpadded input', () => {
    // 'aGk=' padded and 'aGk' unpadded must decode identically
    const padded = urlBase64ToUint8Array('aGk=');
    const unpadded = urlBase64ToUint8Array('aGk');
    expect(Array.from(padded)).toEqual(Array.from(unpadded));
  });

  it('returns a non-empty Uint8Array for a realistic VAPID public key', () => {
    const vapid =
      'BLsgE7MaIjf8Sy4zDHI6x0XxybHN0LilOVMHDPnRs03OpISqd4fvdrIYrXdUWBHFaH-GleWDFe1Mg0g_DGNM5OY';
    const result = urlBase64ToUint8Array(vapid);
    expect(result).toBeInstanceOf(Uint8Array);
    expect(result.length).toBe(65); // uncompressed EC public key is always 65 bytes
  });
});
