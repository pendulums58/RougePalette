// ⚠️ 강화 목록과 수치는 플레이스홀더다. 그리드 **구조**만 확정이다.
//
// design.md **확정**:
// - 배분 그리드는 라인 구조. SC2 캠페인 태양 핵과 완전히 같다
//   - 같은 라인에서는 하나만 고를 수 있다
//   - 각 라인에서 아무것도 안 고를 수는 없다 (항상 정확히 하나가 활성)
//   - 따라서 **라인마다 0코스트 후보가 반드시 하나** 있어야 한다
// - 긍정 = 순수 메리트 (디메리트 없음) / 부정 = 리스크를 감안한 큰 리턴
// - 공용 강화와 캐릭터 전용 강화를 섞는다
//
// **미정**: 라인 수, 라인 이름, 라인당 후보 수, 코스트 티어, 효과의 종류.
//
// ── 추가하는 법 ──────────────────────────────────
//   배열에 객체 하나 + buildGrid()의 해당 라인 candidates에 id 추가.
//   긍정 강화에 디메리트를 넣으면 거부된다 (확정 규칙을 기계로 검사한다).
// 아래 라인 이름(쇄신/용맹/충심, 쾌락/복수/거짓)은 원본 TRPG의 영혼 이름을
// 옮긴 것이며 확정이 아니다.
//
// 원본을 따라 0코스트 부정 후보는 **작은 순수 이득**으로 두고, 대가는 위 티어에서
// 붙는다. (원본의 0코스트 부정 융화체들도 디메리트가 없었다)

import type { CombatModifiers, GridLine, UpgradeDef } from '../types';
import { defineRegistry } from './registry';

const UPGRADES: UpgradeDef[] = [
  // ── 공용 · 긍정 (순수 메리트) ────────────────
  { id: 'renew_0', name: '고른 호흡', polarity: 'positive', cost: 0, text: '사이클당 턴 노트 +1.', modifiers: { notes: 1 } },
  { id: 'renew_1', name: '단단한 손아귀', polarity: 'positive', cost: 2, text: '방어 경감 +3.', modifiers: { mitigation: 3 } },
  { id: 'valor_0', name: '벼린 날', polarity: 'positive', cost: 0, text: '행동 스킬 피해 +2.', modifiers: { damage: 2 } },
  { id: 'valor_1', name: '날선 집중', polarity: 'positive', cost: 3, text: '행동 스킬 피해 +5.', modifiers: { damage: 5 } },
  { id: 'loyal_0', name: '숨 고르기', polarity: 'positive', cost: 0, text: '방어 경감 +1.', modifiers: { mitigation: 1 } },
  { id: 'loyal_1', name: '긴 호흡', polarity: 'positive', cost: 3, text: '사이클당 턴 노트 +2.', modifiers: { notes: 2 } },

  // ── 공용 · 부정 (0코스트는 작은 순수 이득, 위로 갈수록 대가가 붙는다) ──
  { id: 'plea_0', name: '얕은 쾌감', polarity: 'negative', cost: 0, text: '행동 스킬 피해 +3.', modifiers: { damage: 3 } },
  { id: 'plea_1', name: '끓는 욕구', polarity: 'negative', cost: 2, text: '피해 +10. 방어 경감 -3.', modifiers: { damage: 10, mitigation: -3 } },
  { id: 'rev_0', name: '보복 본능', polarity: 'negative', cost: 0, text: '방어 경감 +2.', modifiers: { mitigation: 2 } },
  { id: 'rev_1', name: '집념', polarity: 'negative', cost: 3, text: '피해 +9. 사이클당 턴 노트 -1.', modifiers: { damage: 9, notes: -1 } },
  { id: 'lie_0', name: '흐린 눈', polarity: 'negative', cost: 0, text: '무방비로 받는 피해가 조금 줄어든다.', modifiers: { unguardedMult: -0.2 } },
  { id: 'lie_1', name: '과열', polarity: 'negative', cost: 3, text: '사이클당 턴 노트 +3. 행동마다 과부하가 2씩 쌓인다.', modifiers: { notes: 3, overloadPerAction: 1 } },

  // ── 계승자 전용 (각 라인의 최고 티어) ────────
  { id: 'heir_renew', name: '계승자의 결의', polarity: 'positive', characterId: 'heir', cost: 5, text: '방어 경감 +7.', modifiers: { mitigation: 7 } },
  { id: 'heir_valor', name: '물려받은 일격', polarity: 'positive', characterId: 'heir', cost: 5, text: '행동 스킬 피해 +12.', modifiers: { damage: 12 } },
  { id: 'heir_loyal', name: '굳건한 혈통', polarity: 'positive', characterId: 'heir', cost: 5, text: '턴 노트 +2, 방어 경감 +3.', modifiers: { notes: 2, mitigation: 3 } },
  { id: 'heir_plea', name: '광란', polarity: 'negative', characterId: 'heir', cost: 5, text: '피해 +22. 무방비로 받는 피해가 크게 늘어난다.', modifiers: { damage: 22, unguardedMult: 0.8 } },
  { id: 'heir_rev', name: '되갚음', polarity: 'negative', characterId: 'heir', cost: 5, text: '피해 +15. 사이클당 턴 노트 -2.', modifiers: { damage: 15, notes: -2 } },
  { id: 'heir_lie', name: '무너지는 자세', polarity: 'negative', characterId: 'heir', cost: 5, text: '턴 노트 +4. 행동마다 과부하가 3씩 쌓인다.', modifiers: { notes: 4, overloadPerAction: 2 } },

  // ── 관측자 전용 ─────────────────────────────
  { id: 'obs_renew', name: '관측자의 집중', polarity: 'positive', characterId: 'observer', cost: 5, text: '사이클당 턴 노트 +3.', modifiers: { notes: 3 } },
  { id: 'obs_valor', name: '정밀 사격', polarity: 'positive', characterId: 'observer', cost: 5, text: '행동 스킬 피해 +8.', modifiers: { damage: 8 } },
  { id: 'obs_loyal', name: '긴 시야', polarity: 'positive', characterId: 'observer', cost: 5, text: '방어 경감 +5, 턴 노트 +1.', modifiers: { mitigation: 5, notes: 1 } },
  { id: 'obs_plea', name: '맹목', polarity: 'negative', characterId: 'observer', cost: 5, text: '피해 +16. 무방비로 받는 피해가 크게 늘어난다.', modifiers: { damage: 16, unguardedMult: 1 } },
  { id: 'obs_rev', name: '역산', polarity: 'negative', characterId: 'observer', cost: 5, text: '방어 경감 +9. 무방비로 받는 피해가 늘어난다.', modifiers: { mitigation: 9, unguardedMult: 0.5 } },
  { id: 'obs_lie', name: '과잉 관측', polarity: 'negative', characterId: 'observer', cost: 5, text: '턴 노트 +5. 행동마다 과부하가 3씩 쌓인다.', modifiers: { notes: 5, overloadPerAction: 2 } },

  // ── 그리드에 없는 것 — 무작위 제시 전용 ──────
  // 확정: 두 경로를 둘 다 쓴다. 미정: 두 경로가 같은 풀인지.
  // 지금은 분리해 뒀다 (그리드 후보는 배분으로만, 아래는 보상으로만).
  { id: 'drop_charm', name: '주운 부적', polarity: 'positive', cost: 0, text: '행동 스킬 피해 +4.', modifiers: { damage: 4 } },
  { id: 'drop_bracer', name: '낡은 완갑', polarity: 'positive', cost: 0, text: '방어 경감 +4.', modifiers: { mitigation: 4 } },
  { id: 'drop_breath', name: '두 번째 숨', polarity: 'positive', cost: 0, text: '사이클당 턴 노트 +1.', modifiers: { notes: 1 } },
  { id: 'drop_gamble', name: '깨진 저울', polarity: 'negative', cost: 0, text: '피해 +7. 무방비로 받는 피해가 늘어난다.', modifiers: { damage: 7, unguardedMult: 0.4 } },
  // 훅(반응)을 쓰는 예. 적을 쓰러뜨릴 때 반응하므로 값 질의로는 표현할 수 없다.
  {
    id: 'drop_backdraft',
    name: '역류',
    polarity: 'negative',
    cost: 0,
    text: '적을 쓰러뜨리면 턴 노트 1을 돌려받는다. 무방비로 받는 피해가 늘어난다.',
    modifiers: { unguardedMult: 0.3 },
    hooks: {
      onEnemyDefeated(api) {
        api.refundNotes(1);
        api.log('역류 — 노트 1 환급.');
      },
    },
  },
];

/**
 * 각 수치가 "나빠지는" 방향. design.md 확정인 **긍정 = 순수 메리트**를 기계적으로
 * 검사하기 위한 표다. 긍정 강화에 이 방향의 값이 들어 있으면 거부한다.
 */
const WORSE_WHEN: Record<keyof CombatModifiers, 'negative' | 'positive'> = {
  notes: 'negative',            // 노트가 줄면 나쁘다
  damage: 'negative',           // 피해가 줄면 나쁘다
  mitigation: 'negative',       // 경감이 줄면 나쁘다
  overloadPerAction: 'positive',// 과부하가 더 쌓이면 나쁘다
  unguardedMult: 'positive',    // 무방비 피해가 커지면 나쁘다
};

export const Upgrades = defineRegistry('강화', UPGRADES, (u) => {
  if (u.cost < 0) return 'cost는 0 이상이어야 한다';
  const keys = Object.keys(u.modifiers) as Array<keyof CombatModifiers>;
  if (keys.length === 0 && !u.hooks) return 'modifiers도 hooks도 없다 — 아무 효과도 없는 강화';

  // 확정: 긍정 = 순수 메리트. 디메리트가 섞이면 안 된다.
  if (u.polarity === 'positive') {
    const bad = keys.filter((k) => {
      const v = u.modifiers[k] ?? 0;
      return WORSE_WHEN[k] === 'negative' ? v < 0 : v > 0;
    });
    if (bad.length) {
      return `긍정 강화는 순수 메리트여야 한다 (확정 규칙). 디메리트: ${bad.join(', ')}`;
    }
  }
  return null;
});

export const getUpgrade = Upgrades.get;

/**
 * 캐릭터의 배분 그리드를 만든다.
 * 라인 이름과 개수는 플레이스홀더다 (미정). 각 라인은 0 / 중 / 전용 세 후보.
 */
export function buildGrid(characterId: string): GridLine[] {
  const own = (base: string) => (characterId === 'heir' ? `heir_${base}` : `obs_${base}`);
  return [
    { id: 'renew', name: '쇄신', polarity: 'positive', candidates: ['renew_0', 'renew_1', own('renew')] },
    { id: 'valor', name: '용맹', polarity: 'positive', candidates: ['valor_0', 'valor_1', own('valor')] },
    { id: 'loyal', name: '충심', polarity: 'positive', candidates: ['loyal_0', 'loyal_1', own('loyal')] },
    { id: 'plea', name: '쾌락', polarity: 'negative', candidates: ['plea_0', 'plea_1', own('plea')] },
    { id: 'rev', name: '복수', polarity: 'negative', candidates: ['rev_0', 'rev_1', own('rev')] },
    { id: 'lie', name: '거짓', polarity: 'negative', candidates: ['lie_0', 'lie_1', own('lie')] },
  ];
}

/** 무작위 제시(보상) 경로에만 나오는 강화 — 그리드에 없는 것들. */
export function grantPool(characterId: string): string[] {
  const inGrid = new Set(buildGrid(characterId).flatMap((l) => l.candidates));
  return Upgrades.filter(
    (u) => !inGrid.has(u.id) && (u.characterId === undefined || u.characterId === characterId),
  ).map((u) => u.id);
}

/**
 * 그리드가 확정 규칙을 지키는지 검사한다.
 * "각 라인에서 아무것도 안 고를 수 없다"가 성립하려면 **라인마다 0코스트 후보가
 * 반드시 하나** 있어야 한다. 데이터를 늘릴 때 이 조건을 깨면 여기서 바로 터진다.
 */
export function assertGridValid(grid: GridLine[]): void {
  for (const line of grid) {
    if (line.candidates.length === 0) throw new Error(`grid line "${line.id}" has no candidates`);
    const defs = line.candidates.map(getUpgrade);
    if (!defs.some((d) => d.cost === 0)) {
      throw new Error(`grid line "${line.id}" has no 0-cost candidate — 라인을 비울 수 없으므로 반드시 필요하다`);
    }
    const wrong = defs.find((d) => d.polarity !== line.polarity);
    if (wrong) throw new Error(`grid line "${line.id}" (${line.polarity}) contains ${wrong.id} (${wrong.polarity})`);
  }
}
