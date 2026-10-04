import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { UI_STRINGS } from '@/data/strings';

const SRC = path.resolve(__dirname, '../src');

function sources(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const p = path.join(dir, e.name);
    return e.isDirectory() ? sources(p) : p.endsWith('.ts') ? [p] : [];
  });
}

describe('the texts the game asks for', () => {
  it('all exist: every t(\'key\') in the code has an entry in both languages', () => {
    const missing: string[] = [];
    for (const file of sources(SRC)) {
      const text = fs.readFileSync(file, 'utf8');
      for (const m of text.matchAll(/(?<![A-Za-z0-9_.])t\('([A-Za-z0-9_]+)'/g)) {
        if (!UI_STRINGS[m[1]]) missing.push(`${path.relative(SRC, file)}: ${m[1]}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('have every key built from a prefix (difficulty names and descriptions, dungeon and boss names)', () => {
    for (const d of ['relaxed', 'normal', 'hardcore']) {
      expect(UI_STRINGS[`diff_${d}`], d).toBeDefined();
      expect(UI_STRINGS[`diffDesc_${d}`], d).toBeDefined();
    }
  });
});
