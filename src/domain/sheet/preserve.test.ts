import { describe, expect, it } from 'vitest';
import { parseSheetText } from './parse';
import { preserveIds } from './preserve';

describe('preserveIds', () => {
  it('内容が同じ行は編集前の ID を引き継ぐ', () => {
    const before = parseSheetText('{soc: サビ}\n[C]あいう\n[G]えお\n{eoc}').body;
    const after = parseSheetText('{soc: サビ}\n[C]あいう\n[F]追加した行\n[G]えお\n{eoc}').body;
    const merged = preserveIds(before, after);
    const [b] = before.sections;
    const [m] = merged.sections;
    expect(m.id).toBe(b.id);
    expect(m.lines[0].id).toBe(b.lines[0].id);
    expect(m.lines[2].id).toBe(b.lines[1].id);
    expect(m.lines[1].id).toBe(after.sections[0].lines[1].id);
  });
});
