// 효과 반응 디스패처.
//
// 설계 의도 세 가지:
//
// 1. **훅 지점을 타입으로 못박는다.** HookName에 없는 시점에는 반응을 걸 수 없다.
//    무차별 브로드캐스트(모든 객체의 OnX()를 부르는 식)를 쓰지 않는 이유는,
//    어디에 무엇이 걸려 있는지 코드에서 안 보이게 되기 때문이다.
//
// 2. **발화 순서를 명시한다.** 아래 collectHooks()의 순서가 곧 발화 순서다.
//    순서가 암묵적이면 "노트 +1"과 "노트 2배"가 같은 훅에 걸렸을 때 결과가
//    등록 순서에 따라 달라지고, 그건 추적이 불가능하다.
//
// 3. **반응이 할 수 있는 일을 좁힌다.** 상태를 통째로 넘기지 않고 HookApi만 준다.
//    "무엇이든 할 수 있다"가 되면 어떤 효과가 무엇을 바꿨는지 알 수 없게 된다.
//
// 값 질의(CombatModifiers)는 여기 없다. 그쪽은 systems/upgrades.ts의 modifiersFor()다.

import type {
  CombatModifiers,
  CombatState,
  EffectHooks,
  HookApi,
  HookName,
  HookPayloads,
  RunState,
} from '../types';
import { getUpgrade } from '../data/upgrades';
import { getPotion } from '../data/potions';
import { activeUpgrades } from './upgrades';

/** 반응 하나와 그게 어디서 왔는지. 출처를 들고 다녀야 로그에서 추적이 된다. */
interface Bound {
  source: string;
  hooks: EffectHooks;
}

/**
 * 지금 걸려 있는 반응 전부. **이 순서가 발화 순서다.**
 *
 *   1. 강화 — 무작위 제시로 받은 것, 그 다음 그리드에서 켠 것
 *   2. 포션 — 획득한 순서. 스택된 만큼 각각 발화한다 (확정: 스택형)
 *
 * 전승(= STS 유물)이 확정되면 여기 한 줄 추가하면 된다. 순서는 그때 정한다.
 */
export function collectHooks(run: RunState): Bound[] {
  const bound: Bound[] = [];

  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    if (def.hooks) bound.push({ source: def.name, hooks: def.hooks });
  }
  for (const active of run.potions) {
    const def = getPotion(active.id);
    if (def.hooks) bound.push({ source: def.name, hooks: def.hooks });
  }
  return bound;
}

/** 반응이 쓸 수 있는 좁은 API를 만든다. */
function makeApi(combat: CombatState, mods: CombatModifiers, source: string): HookApi {
  return {
    combat,
    mods,
    refundNotes(n) {
      if (n <= 0) return;
      combat.player.notes = Math.min(combat.player.maxNotes, combat.player.notes + n);
    },
    reduceOverload(n) {
      if (n <= 0) return;
      combat.player.overload = Math.max(0, combat.player.overload - n);
    },
    addStack(key, amount) {
      combat.stacks[key] = (combat.stacks[key] ?? 0) + amount;
      if (combat.stacks[key]! <= 0) delete combat.stacks[key];
    },
    getStack: (key) => combat.stacks[key] ?? 0,
    log(message) {
      combat.log.push(`[${source}] ${message}`);
    },
  };
}

/**
 * 훅을 발화한다. 걸린 반응이 없으면 아무 일도 하지 않는다.
 *
 * 전투 로직은 이 함수만 부르면 된다 — 누가 걸려 있는지는 알 필요가 없다.
 */
export function fire<K extends HookName>(
  run: RunState,
  combat: CombatState,
  mods: CombatModifiers,
  name: K,
  payload: HookPayloads[K],
): void {
  for (const { source, hooks } of collectHooks(run)) {
    const fn = hooks[name];
    if (fn) (fn as (api: HookApi, p: HookPayloads[K]) => void)(makeApi(combat, mods, source), payload);
  }
}

/** 지금 이 훅에 걸려 있는 반응의 출처들. 디버깅·검증용. */
export function boundTo(run: RunState, name: HookName): string[] {
  return collectHooks(run)
    .filter((b) => b.hooks[name])
    .map((b) => b.source);
}
