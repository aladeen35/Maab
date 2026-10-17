import { describe, expect, it } from 'vitest';
import { cronMatches } from './scheduler';

const at = (iso: string) => new Date(iso);

describe('مطابقة جدول المهام مع دقيقة النبضة', () => {
  it('كل دقيقة، وكل خمس، وكل عشر دقائق', () => {
    expect(cronMatches('* * * * *', at('2026-10-17T10:03:00Z'))).toBe(true);
    expect(cronMatches('*/5 * * * *', at('2026-10-17T10:05:00Z'))).toBe(true);
    expect(cronMatches('*/5 * * * *', at('2026-10-17T10:03:00Z'))).toBe(false);
    expect(cronMatches('*/10 * * * *', at('2026-10-17T10:40:00Z'))).toBe(true);
  });

  it('دقيقة محددة كل ساعة، ووقت يومي بتوقيت UTC', () => {
    expect(cronMatches('7 * * * *', at('2026-10-17T22:07:00Z'))).toBe(true);
    expect(cronMatches('7 * * * *', at('2026-10-17T22:08:00Z'))).toBe(false);
    expect(cronMatches('33 3 * * *', at('2026-10-17T03:33:00Z'))).toBe(true);
    expect(cronMatches('33 3 * * *', at('2026-10-17T04:33:00Z'))).toBe(false);
  });

  it('المدى والقوائم في الخانات', () => {
    expect(cronMatches('0 9-17 * * 1-5', at('2026-10-16T12:00:00Z'))).toBe(true);
    expect(cronMatches('0 9-17 * * 1-5', at('2026-10-17T12:00:00Z'))).toBe(false);
    expect(cronMatches('0,30 * * * *', at('2026-10-17T12:30:00Z'))).toBe(true);
  });
});
