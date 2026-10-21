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
  GridLine,
  GridLineId,
  PolarityCount,
  RunState,
  UpgradeId,
} from '../types';
import { emptyPolarityCount } from '../types';
import { assertGridValid, getUpgrade } from '../data/upgrades';

// 값 효과(baseModifiers / modifiersFor)는 systems/modifiers.ts로 옮겼다.
// 거기는 출처가 붙은 순서 있는 파이프라인이고, 여기는 강화의 획득·배분만 다룬다.

/** 지금 효과가 걸려 있는 강화 = 무작위로 획득한 것 + 그리드에서 켜 둔 것 */
export function activeUpgrades(run: RunState): UpgradeId[] {
  return [...run.upgrades.granted, ...Object.values(run.upgrades.allocated)];
}

// ── 무작위 제시 경로 ────────────────────────────

export function grantUpgrade(run: RunState, id: UpgradeId): void {
  if (run.upgrades.granted.includes(id)) return;
  run.upgrades.granted.push(id);
}

// ── 자원 배분 경로 (그리드) ────────────────────
//
// design.md 확정: SC2 캠페인 태양 핵과 완전히 같은 구조.
// - 같은 라인에서는 하나만 고를 수 있다
// - 각 라인에서 아무것도 안 고를 수는 없다 -> 항상 정확히 하나가 활성
// 따라서 "해제"라는 동작은 없다. 있는 것은 **같은 라인 안에서의 교체**뿐이다.

/** 라인의 기본값 = 그 라인의 0코스트 후보. 자원이 0이어도 그리드가 꽉 찬다. */
function defaultOf(line: GridLine): UpgradeId {
  const zero = line.candidates.find((id) => getUpgrade(id).cost === 0);
  if (!zero) throw new Error(`grid line "${line.id}" has no 0-cost candidate`);
  return zero;
}

/** 런 시작 시의 그리드 상태 — 모든 라인이 0코스트 후보로 채워져 있다. */
export function newUpgradeState(grid: GridLine[]) {
  assertGridValid(grid);
  const allocated: Record<GridLineId, UpgradeId> = {};
  for (const line of grid) allocated[line.id] = defaultOf(line);
  return { granted: [] as UpgradeId[], allocated, resources: emptyPolarityCount() };
}

export type SelectRefusal =
  /** 이미 이 라인에서 켜져 있다 */
  | 'already'
  /** 그 라인의 후보가 아니다 */
  | 'notCandidate'
  /** 자원이 모자란다 (교체 차액 기준) */
  | 'insufficient';

/**
 * 교체에 드는 **차액**. 지금 켜진 것을 환급하고 새 것을 사는 값이다.
 * 더 싼 것으로 내리면 음수가 되고, 그만큼 자원이 돌아온다.
 */
export function swapCost(run: RunState, line: GridLine, to: UpgradeId): number {
  const current = run.upgrades.allocated[line.id];
  const from = current ? getUpgrade(current).cost : 0;
  return getUpgrade(to).cost - from;
}

export function selectionRefusal(run: RunState, line: GridLine, to: UpgradeId): SelectRefusal | null {
  if (!line.candidates.includes(to)) return 'notCandidate';
  if (run.upgrades.allocated[line.id] === to) return 'already';
  if (run.upgrades.resources[line.polarity] < swapCost(run, line, to)) return 'insufficient';
  return null;
}

export function canSelect(run: RunState, line: GridLine, to: UpgradeId): boolean {
  return selectionRefusal(run, line, to) === null;
}

/**
 * 라인의 선택을 바꾼다. 재배분은 자유이고 차액만 오간다.
 * 라인을 비우는 동작은 없다 — 확정 규칙상 불가능하다.
 */
export function selectInLine(run: RunState, line: GridLine, to: UpgradeId): boolean {
  if (!canSelect(run, line, to)) return false;
  run.upgrades.resources[line.polarity] -= swapCost(run, line, to);
  run.upgrades.allocated[line.id] = to;
  return true;
}

/** 무작위 제시로 이미 받은 강화인가. */
export function alreadyGranted(run: RunState, id: UpgradeId): boolean {
  return run.upgrades.granted.includes(id);
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

// ── 미정이라 구현하지 않은 것 ───────────────────
//
// - **라인 수와 이름, 라인당 후보 수, 코스트 티어.** 그리드가 라인 구조라는 것은
//   확정이지만 이 네 가지는 미정이다. data/upgrades.ts의 buildGrid()가 그 자리다.
// - **자원 풀이 둘인가.** 지금은 계열별로 따로 세고 해당 계열에서만 차감한다.
//   하나로 합치는 쪽이면 resources를 단일 숫자로 바꾸면 된다.
// - **재배분 제약** (횟수/시점/비용). 확정이 "자유"까지라 제약을 두지 않았다.
// - **무작위 제시 강화와 배분 강화가 같은 풀인가.** 지금은 같은 풀을 쓴다.
// - **구체적인 자원 적립 조건.** trigger 세 종류는 예시를 옮긴 것이다.
