import type { EnemyDef } from '../types';

// 적 정의. pattern은 턴마다 순서대로 돌고, 끝나면 처음으로 돌아간다.

export const ENEMIES: EnemyDef[] = [
  {
    id: 'slime',
    name: '점액질',
    hp: 22,
    pattern: [
      { kind: 'attack', amount: 7, label: '공격 7' },
      { kind: 'attack', amount: 5, times: 2, label: '공격 5×2' },
      { kind: 'block', amount: 6, label: '방어 6' },
    ],
  },
  {
    id: 'rat',
    name: '굴쥐',
    hp: 14,
    pattern: [
      { kind: 'attack', amount: 5, label: '공격 5' },
      { kind: 'debuff', amount: 1, status: 'weak', label: '약화 1' },
    ],
  },
  {
    id: 'brute',
    name: '광전사',
    hp: 46,
    pattern: [
      { kind: 'buff', amount: 2, status: 'strength', label: '힘 +2' },
      { kind: 'attack', amount: 11, label: '공격 11' },
      { kind: 'attack', amount: 11, label: '공격 11' },
    ],
  },
  {
    id: 'sentinel',
    name: '파수꾼',
    hp: 38,
    pattern: [
      { kind: 'block', amount: 10, label: '방어 10' },
      { kind: 'attack', amount: 9, label: '공격 9' },
      { kind: 'debuff', amount: 2, status: 'vulnerable', label: '취약 2' },
    ],
  },

  // ── 보스 ───────────────────────────────────
  {
    id: 'warden',
    name: '감시자',
    hp: 110,
    pattern: [
      { kind: 'attack', amount: 10, label: '공격 10' },
      { kind: 'debuff', amount: 2, status: 'weak', label: '약화 2' },
      { kind: 'attack', amount: 8, times: 2, label: '공격 8×2' },
      { kind: 'buff', amount: 3, status: 'strength', label: '힘 +3' },
      { kind: 'attack', amount: 18, label: '공격 18' },
    ],
  },
];

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown enemy id: ${id}`);
  return e;
}
