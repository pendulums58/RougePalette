// ⚠️ 강화 목록과 수치는 플레이스홀더다.
//
// design.md에서 **확정**인 것 (아래 데이터가 지키는 것):
// - 긍정 = 순수 메리트. 디메리트 없이 좋아진다
// - 부정 = 리스크를 감안해야 하는 큰 리턴. 대가가 따르지만 효과가 크다
// - 공용 강화와 캐릭터 전용 강화를 섞는다
//
// **미정**이라 여기서 정하지 않은 것:
// - 어떤 종류의 효과를 쓸 것인가. 지금은 확정 규칙이 정의한 수치(노트/과부하/
//   무방비 배율/피해/경감)만 건드린다. 규칙 자체를 바꾸는 강화가 필요한지는 미정
// - 코스트 티어. 원본 TRPG의 0/5/25/50/100/150은 여러 세션 누적을 전제한 값이라
//   런 하나에 맞게 다시 잡아야 한다 (trpg-fusion-reference.md 참조)
// - 슬롯별 택1 그리드인지, 슬롯이 몇 개인지

import type { UpgradeDef } from '../types';

export const UPGRADES: UpgradeDef[] = [
  // ── 공용 · 긍정 (순수 메리트) ────────────────
  {
    id: 'steady_breath',
    name: '고른 호흡',
    polarity: 'positive',
    cost: 0,
    text: '사이클당 턴 노트 +1.',
    modifiers: { notes: 1 },
  },
  {
    id: 'sure_grip',
    name: '단단한 손아귀',
    polarity: 'positive',
    cost: 2,
    text: '방어 경감 +3.',
    modifiers: { mitigation: 3 },
  },
  {
    id: 'honed_edge',
    name: '벼린 날',
    polarity: 'positive',
    cost: 2,
    text: '행동 스킬 피해 +3.',
    modifiers: { damage: 3 },
  },

  // ── 공용 · 부정 (대가가 있는 큰 리턴) ────────
  {
    id: 'reckless',
    name: '무모함',
    polarity: 'negative',
    cost: 0,
    text: '피해 +8. 무방비로 받는 피해가 더 커진다.',
    modifiers: { damage: 8, unguardedMult: 0.5 },
  },
  {
    id: 'overdrive',
    name: '과열',
    polarity: 'negative',
    cost: 3,
    text: '사이클당 턴 노트 +3. 행동할 때마다 과부하가 2씩 쌓인다.',
    modifiers: { notes: 3, overloadPerAction: 1 },
  },

  // ── 계승자 전용 ─────────────────────────────
  {
    id: 'heir_resolve',
    name: '계승자의 결의',
    polarity: 'positive',
    characterId: 'heir',
    cost: 3,
    text: '방어 경감 +6.',
    modifiers: { mitigation: 6 },
  },
  {
    id: 'heir_burden',
    name: '물려받은 짐',
    polarity: 'negative',
    characterId: 'heir',
    cost: 2,
    text: '피해 +12. 사이클당 턴 노트 -1.',
    modifiers: { damage: 12, notes: -1 },
  },

  // ── 관측자 전용 ─────────────────────────────
  {
    id: 'observer_focus',
    name: '관측자의 집중',
    polarity: 'positive',
    characterId: 'observer',
    cost: 3,
    text: '사이클당 턴 노트 +2.',
    modifiers: { notes: 2 },
  },
  {
    id: 'observer_blind',
    name: '먼 곳을 보는 눈',
    polarity: 'negative',
    characterId: 'observer',
    cost: 2,
    text: '피해 +6, 경감 +4. 무방비로 받는 피해가 크게 늘어난다.',
    modifiers: { damage: 6, mitigation: 4, unguardedMult: 1 },
  },
];

const BY_ID = new Map(UPGRADES.map((u) => [u.id, u]));

export function getUpgrade(id: string): UpgradeDef {
  const u = BY_ID.get(id);
  if (!u) throw new Error(`unknown upgrade id: ${id}`);
  return u;
}

/** 해당 캐릭터에게 제시 가능한 강화 (공용 + 그 캐릭터 전용) */
export function upgradesFor(characterId: string) {
  return UPGRADES.filter((u) => u.characterId === undefined || u.characterId === characterId);
}
