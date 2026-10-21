// ⚠️ 적 구성과 수치는 플레이스홀더다. design.md의 "적 체력·공격력"은 미정.
//
// pattern의 각 원소 = 적 턴 하나에 들어오는 공격 묶음. 사이클마다 순서대로 돈다.
// 약한 다발 공격과 강한 단발 공격을 섞어 뒀다 — "약한 건 맞고 노트를 아낄까"가
// 실제 판단이 되는지 보려면 둘 다 필요하다.
//
// 이 패턴은 플레이어에게 표시하지 않는다 (적 의도 표시는 구조적으로 성립 불가).
// 적의 턴 노트와 방어는 미정이라 없다.

import type { EnemyDef } from '../types';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'husk',
    name: '껍데기',
    hp: 34,
    pattern: [[{ name: '할퀴기', damage: 8 }], [{ name: '물어뜯기', damage: 13 }]],
  },
  {
    id: 'swarm',
    name: '무리',
    hp: 22,
    pattern: [
      [
        { name: '쪼기', damage: 5 },
        { name: '쪼기', damage: 5 },
      ],
      [{ name: '덮치기', damage: 9 }],
    ],
  },
  {
    id: 'sentinel',
    name: '파수꾼',
    hp: 58,
    pattern: [
      [{ name: '내려베기', damage: 16 }],
      [
        { name: '연격', damage: 7 },
        { name: '연격', damage: 7 },
      ],
      [{ name: '짓밟기', damage: 20 }],
    ],
  },

  // ── 보스 ───────────────────────────────────
  {
    id: 'warden',
    name: '감시자',
    hp: 120,
    pattern: [
      [{ name: '선고', damage: 14 }],
      [
        { name: '난타', damage: 9 },
        { name: '난타', damage: 9 },
      ],
      [{ name: '처형', damage: 26 }],
    ],
  },
];

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown enemy id: ${id}`);
  return e;
}
