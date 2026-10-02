export type IdGen = (prefix: string) => string;

/** ランダムな短い ID（行・セクション用） */
export const randomId: IdGen = (prefix) => {
  const rand = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${rand}`;
};

/** テスト用の連番 ID */
export function sequentialIds(): IdGen {
  let n = 0;
  return (prefix) => `${prefix}_${++n}`;
}
