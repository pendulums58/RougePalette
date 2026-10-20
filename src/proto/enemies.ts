// ⚠️ 플레이스홀더. design.md의 "적 체력·공격력"은 미정이다.
//
// pattern의 각 원소 = 적 턴 하나에 들어오는 공격 묶음. 사이클마다 순서대로 돈다.
// 약한 다발 공격과 강한 단발 공격을 섞어 뒀다 — "약한 건 맞고 노트를 아낄까"가
// 실제 판단이 되는지 보려면 둘 다 필요하다.
//
// 이 패턴은 플레이어에게 표시하지 않는다 (design.md: 적 의도 표시는 구조적으로 성립 불가).

import type { EnemyDef } from './types';
import { ENEMY_HP } from './tuning';

export const ENEMIES: EnemyDef[] = [
  {
    id: 'dummy',
    name: '시험대',
    hp: ENEMY_HP,
    pattern: [
      [{ name: '찌르기', damage: 10 }],
      [
        { name: '연타', damage: 6 },
        { name: '연타', damage: 6 },
      ],
      [{ name: '내려베기', damage: 18 }],
    ],
  },
];

const BY_ID = new Map(ENEMIES.map((e) => [e.id, e]));

export function getEnemy(id: string): EnemyDef {
  const e = BY_ID.get(id);
  if (!e) throw new Error(`unknown enemy id: ${id}`);
  return e;
}
