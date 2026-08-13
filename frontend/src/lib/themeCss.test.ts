import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const css = readFileSync(join(process.cwd(), 'src/index.css'), 'utf8');

describe('semantic theme CSS', () => {
  it('defines light and dark semantic readability tokens', () => {
    expect(css).toContain(':root[data-theme="light"]');
    expect(css).toContain(':root[data-theme="dark"]');
    [
      '--ph-text-primary',
      '--ph-text-secondary',
      '--ph-text-muted',
      '--ph-text-disabled',
      '--ph-bg-surface',
      '--ph-bg-input',
      '--ph-border-strong',
      '--ph-focus-ring',
    ].forEach((token) => expect(css).toContain(token));
  });

  it('maps shared component states to semantic status tokens', () => {
    [
      '--ph-success-bg',
      '--ph-success-text',
      '--ph-warning-bg',
      '--ph-warning-text',
      '--ph-danger-bg',
      '--ph-danger-text',
      '--ph-info-bg',
      '--ph-info-text',
      '--ph-risk-critical-text',
    ].forEach((token) => expect(css).toContain(token));
    expect(css).toContain('input:disabled');
    expect(css).toContain('button:disabled');
    expect(css).toContain('input::placeholder');
  });
});
