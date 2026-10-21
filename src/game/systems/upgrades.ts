// 강화 레이어. DOM을 건드리지 않는다.
//
// design.md **확정**만 구현한다:
// - 런 중에 강화를 획득해 누적하고, **런이 끝나면 사라진다**
// - 두 경로를 둘 다 쓴다: 무작위 제시 / 자원 배분
// - 배분은 **재배분(교체)이 자유롭다**
// - 배분/재배분은 **휴식 지점의 기회를 소모하지 않는다**
// - 자원은 캐릭터마다 다르고 **런 한정**이다
// - 긍정 = 순수 메리트 / 부정 = 리스크 있는 큰 리턴
// - 긍정/부정 자원은 **서로 다른 조건**으로, **행동에 따라** 쌓인다
//
// 미정이라 구현하지 않은 것은 파일 하단 참조.

import type {
  CharacterDef,
  CombatEvent,
  CombatModifiers,
  PolarityCount,
  RunState,
  UpgradeId,
} from '../types';
import { emptyPolarityCount } from '../types';
import { getUpgrade } from '../data/upgrades';
import { OVERLOAD_PER_ACTION, UNGUARDED_MULT } from '../tuning';

/**
 * 강화가 하나도 없을 때의 전투 수치.
 * 강화의 modifiers는 여기에 **더해지는 값**이다 (절대값이 아니라 증감).
 */
export function baseModifiers(): CombatModifiers {
  return {
    notes: 0,
    overloadPerAction: OVERLOAD_PER_ACTION,
    unguardedMult: UNGUARDED_MULT,
    damage: 0,
    mitigation: 0,
  };
}

/** 지금 효과가 걸려 있는 강화 = 무작위로 획득한 것 + 자원으로 켜 둔 것 */
export function activeUpgrades(run: RunState): UpgradeId[] {
  return [...run.upgrades.granted, ...run.upgrades.allocated];
}

/** 활성 강화를 전부 합친 최종 전투 수치. */
export function modifiersFor(run: RunState): CombatModifiers {
  const m = baseModifiers();
  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    m.notes += def.modifiers.notes ?? 0;
    m.overloadPerAction += def.modifiers.overloadPerAction ?? 0;
    m.unguardedMult += def.modifiers.unguardedMult ?? 0;
    m.damage += def.modifiers.damage ?? 0;
    m.mitigation += def.modifiers.mitigation ?? 0;
  }
  // 과부하 증가량이 음수가 되면 규칙이 무너진다. 0 미만으로는 내려가지 않게 한다.
  m.overloadPerAction = Math.max(0, m.overloadPerAction);
  m.unguardedMult = Math.max(1, m.unguardedMult); // 무방비가 방어보다 유리해지지 않게
  return m;
}

// ── 무작위 제시 경로 ────────────────────────────

/** 이미 가지고 있어서 다시 제시할 필요가 없는 강화인가. */
export function alreadyHas(run: RunState, id: UpgradeId): boolean {
  return run.upgrades.granted.includes(id) || run.upgrades.allocated.includes(id);
}

export function grantUpgrade(run: RunState, id: UpgradeId): void {
  if (alreadyHas(run, id)) return;
  run.upgrades.granted.push(id);
}

// ── 자원 배분 경로 ──────────────────────────────

export type AllocateRefusal = 'already' | 'granted' | 'insufficient';

/** 배분 가능한지. 안 되면 이유를 돌려준다. */
export function allocationRefusal(run: RunState, id: UpgradeId): AllocateRefusal | null {
  if (run.upgrades.allocated.includes(id)) return 'already';
  if (run.upgrades.granted.includes(id)) return 'granted';
  const def = getUpgrade(id);
  if (run.upgrades.resources[def.polarity] < def.cost) return 'insufficient';
  return null;
}

export function canAllocate(run: RunState, id: UpgradeId): boolean {
  return allocationRefusal(run, id) === null;
}

/** 자원을 써서 강화를 켠다. */
export function allocate(run: RunState, id: UpgradeId): boolean {
  if (!canAllocate(run, id)) return false;
  const def = getUpgrade(id);
  run.upgrades.resources[def.polarity] -= def.cost;
  run.upgrades.allocated.push(id);
  return true;
}

/**
 * 켜 둔 강화를 끈다. 코스트는 **전액 환급**된다.
 * 확정: 재배분(교체)이 자유롭다. 제약(횟수/시점/비용)은 미정이라 걸지 않았다.
 */
export function deallocate(run: RunState, id: UpgradeId): boolean {
  const i = run.upgrades.allocated.indexOf(id);
  if (i === -1) return false;
  const def = getUpgrade(id);
  run.upgrades.allocated.splice(i, 1);
  run.upgrades.resources[def.polarity] += def.cost;
  return true;
}

// ── 자원 적립 ───────────────────────────────────

/**
 * 전투 중 일어난 일을 캐릭터의 적립 조건에 비춰 자원을 준다.
 *
 * 확정: 조건은 행동 기반이고, 긍정/부정이 서로 다르며, 캐릭터마다 다르다.
 * 미정: 구체적인 조건 목록. 지금 trigger 세 종류는 제작자가 든 예시일 뿐이다.
 */
export function awardResources(
  character: CharacterDef,
  event: CombatEvent,
  into: PolarityCount,
): void {
  for (const rule of character.resourceRules) {
    if (matches(rule.trigger.on, event)) into[rule.polarity] += rule.amount;
  }
}

function matches(on: string, e: CombatEvent): boolean {
  switch (on) {
    case 'fullyBlocked':
      return e.kind === 'defended' && e.taken === 0;
    case 'tookUnguarded':
      return e.kind === 'unguarded';
    case 'cycleEndedEmpty':
      return e.kind === 'cycleEnd' && e.notesLeft === 0;
    default:
      return false;
  }
}

/** 전투에서 번 자원을 런으로 옮긴다. */
export function bankResources(run: RunState, earned: PolarityCount): void {
  run.upgrades.resources.positive += earned.positive;
  run.upgrades.resources.negative += earned.negative;
}

export function newUpgradeState() {
  return { granted: [], allocated: [], resources: emptyPolarityCount() };
}

// ── 미정이라 구현하지 않은 것 ───────────────────
//
// - **배분 그리드 구조.** 원본 TRPG는 영혼(슬롯)마다 융화체 셋 중 택1하는
//   그리드였다. 새 게임도 그 구조인지, 슬롯이 몇 개인지 미정이라 지금은
//   구조 없는 집합으로 뒀다. 그리드가 정해지면 UpgradeState.allocated를
//   슬롯 배열로 바꾸고 여기 allocate()에 슬롯 규칙을 넣으면 된다.
// - **자원 풀이 둘인가.** 지금은 계열별로 따로 세고 해당 계열에서만 차감한다.
//   하나로 합치는 쪽이면 resources를 단일 숫자로 바꾸면 된다.
// - **재배분 제약** (횟수/시점/비용). 확정이 "자유"까지라 제약을 두지 않았다.
// - **무작위 제시 강화와 배분 강화가 같은 풀인가.** 지금은 같은 풀을 쓴다.
// - **구체적인 자원 적립 조건.** trigger 세 종류는 예시를 옮긴 것이다.
