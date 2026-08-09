import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const themeCss = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8');

const readHexToken = (name: string): string => {
  const value = themeCss.match(new RegExp(`${name}:\\s*(#[0-9A-F]{6})`, 'i'))?.[1];
  if (!value) throw new Error(`Missing colour token ${name}`);
  return value;
};

const relativeLuminance = (hex: string): number => {
  const channels = hex
    .slice(1)
    .match(/.{2}/g)!
    .map((channel) => parseInt(channel, 16) / 255)
    .map((channel) =>
      channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4
    );

  return 0.2126 * channels[0]! + 0.7152 * channels[1]! + 0.0722 * channels[2]!;
};

const contrastRatio = (first: string, second: string): number => {
  const lighter = Math.max(relativeLuminance(first), relativeLuminance(second));
  const darker = Math.min(relativeLuminance(first), relativeLuminance(second));
  return (lighter + 0.05) / (darker + 0.05);
};

describe('game status palette', () => {
  it('keeps text on amber above WCAG AA contrast', () => {
    const amber = readHexToken('--color-present');
    const foreground = readHexToken('--color-on-present');

    expect(contrastRatio(amber, foreground)).toBeGreaterThanOrEqual(4.5);
  });
});
