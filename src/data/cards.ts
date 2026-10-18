import type { CardDef } from '../types';

// 카드 정의. id는 전역 유니크여야 한다.
// 새 카드 추가 = 여기에 객체 하나 + 캐릭터의 cardPool에 id 추가.

export const CARDS: CardDef[] = [
  // ── 공용 스타터 ─────────────────────────────
  {
    id: 'strike',
    name: '베기',
    type: 'attack',
    cost: 1,
    rarity: 'starter',
    text: '피해 6.',
    needsTarget: true,
    effects: [{ kind: 'damage', amount: 6 }],
  },
  {
    id: 'guard',
    name: '방어',
    type: 'skill',
    cost: 1,
    rarity: 'starter',
    text: '방어도 5.',
    needsTarget: false,
    effects: [{ kind: 'block', amount: 5 }],
  },

  // ── 검사 ───────────────────────────────────
  {
    id: 'heavy_swing',
    name: '내려찍기',
    type: 'attack',
    cost: 2,
    rarity: 'common',
    text: '피해 14.',
    needsTarget: true,
    effects: [{ kind: 'damage', amount: 14 }],
  },
  {
    id: 'double_slash',
    name: '쌍검',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    text: '피해 4를 2회.',
    needsTarget: true,
    effects: [{ kind: 'damage', amount: 4, times: 2 }],
  },
  {
    id: 'war_cry',
    name: '전투 함성',
    type: 'power',
    cost: 1,
    rarity: 'uncommon',
    text: '힘 +2. (영구)',
    needsTarget: false,
    effects: [{ kind: 'status', status: 'strength', amount: 2, to: 'self' }],
  },
  {
    id: 'shield_bash',
    name: '방패 치기',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    text: '방어도 6, 피해 5.',
    needsTarget: true,
    effects: [
      { kind: 'block', amount: 6 },
      { kind: 'damage', amount: 5 },
    ],
  },
  {
    id: 'cleave',
    name: '휩쓸기',
    type: 'attack',
    cost: 1,
    rarity: 'common',
    text: '모든 적에게 피해 7.',
    needsTarget: false,
    effects: [{ kind: 'damageAll', amount: 7 }],
  },
  {
    id: 'second_wind',
    name: '재기',
    type: 'skill',
    cost: 1,
    rarity: 'uncommon',
    text: '체력 6 회복. 소멸.',
    needsTarget: false,
    exhaust: true,
    effects: [{ kind: 'heal', amount: 6 }],
  },
  {
    id: 'execute',
    name: '처형',
    type: 'attack',
    cost: 3,
    rarity: 'rare',
    text: '피해 30.',
    needsTarget: true,
    effects: [{ kind: 'damage', amount: 30 }],
  },

  // ── 학자 ───────────────────────────────────
  {
    id: 'spark',
    name: '불똥',
    type: 'attack',
    cost: 0,
    rarity: 'common',
    text: '피해 4.',
    needsTarget: true,
    effects: [{ kind: 'damage', amount: 4 }],
  },
  {
    id: 'insight',
    name: '통찰',
    type: 'skill',
    cost: 0,
    rarity: 'common',
    text: '카드 2장 뽑기.',
    needsTarget: false,
    effects: [{ kind: 'draw', amount: 2 }],
  },
  {
    id: 'hex',
    name: '약화의 표식',
    type: 'skill',
    cost: 1,
    rarity: 'common',
    text: '대상에게 약화 2, 취약 2.',
    needsTarget: true,
    effects: [
      { kind: 'status', status: 'weak', amount: 2, to: 'target' },
      { kind: 'status', status: 'vulnerable', amount: 2, to: 'target' },
    ],
  },
  {
    id: 'ward',
    name: '보호막',
    type: 'skill',
    cost: 2,
    rarity: 'common',
    text: '방어도 14.',
    needsTarget: false,
    effects: [{ kind: 'block', amount: 14 }],
  },
  {
    id: 'overclock',
    name: '과부하',
    type: 'skill',
    cost: 0,
    rarity: 'uncommon',
    text: '에너지 +2. 카드 1장 뽑기. 소멸.',
    needsTarget: false,
    exhaust: true,
    effects: [
      { kind: 'energy', amount: 2 },
      { kind: 'draw', amount: 1 },
    ],
  },
  {
    id: 'chain_bolt',
    name: '연쇄 번개',
    type: 'attack',
    cost: 2,
    rarity: 'uncommon',
    text: '모든 적에게 피해 11.',
    needsTarget: false,
    effects: [{ kind: 'damageAll', amount: 11 }],
  },
  {
    id: 'regeneration',
    name: '재생',
    type: 'power',
    cost: 1,
    rarity: 'rare',
    text: '재생 3. (매 턴 시작 시 회복)',
    needsTarget: false,
    effects: [{ kind: 'status', status: 'regen', amount: 3, to: 'self' }],
  },
  {
    id: 'curse_all',
    name: '전역 저주',
    type: 'skill',
    cost: 2,
    rarity: 'rare',
    text: '모든 적에게 취약 3.',
    needsTarget: false,
    effects: [{ kind: 'status', status: 'vulnerable', amount: 3, to: 'allEnemies' }],
  },
];

const BY_ID = new Map(CARDS.map((c) => [c.id, c]));

export function getCard(id: string): CardDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`unknown card id: ${id}`);
  return c;
}
