// 규칙 가로채기.
//
// 훅이 "무슨 일이 일어났다"는 **알림**이라면, 이쪽은 "이 값이 얼마여야 하는가"라는
// **결정 지점**이다. 미들웨어처럼 next()로 엮는다.
//
//   효과A(ctx, input, next) -> 효과B(...) -> 기본 규칙
//
// - next()를 부르지 않으면 기본 규칙을 **통째로 대체**한다
// - 부른 뒤 결과를 손보면 기본 **위에 얹는다**
// - 체인 순서는 획득 순서다 (강화 -> 포션). 먼저 얻은 것이 바깥쪽에 온다
//
// ⚠️ 공식만 연다. 흐름(턴 순서, 방어 선언 시점, 적 턴 구조)은 design.md에서
//    미정이라 가로채지 않는다. 역공이 확정되면 사이클 구조가 바뀐다.

import type {
  CombatModifiers,
  CombatState,
  RuleContext,
  RuleInputs,
  RuleName,
  RuleOutputs,
  RuleOverrides,
  RunState,
} from '../types';
import { getUpgrade } from '../data/upgrades';
import { getPotion } from '../data/potions';
import { activeUpgrades } from './upgrades';

interface Bound {
  source: string;
  rules: RuleOverrides;
}

/** 지금 걸려 있는 가로채기 전부. **이 순서가 체인 순서다.** */
export function collectRules(run: RunState): Bound[] {
  const out: Bound[] = [];
  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    if (def.rules) out.push({ source: def.name, rules: def.rules });
  }
  for (const active of run.potions) {
    const def = getPotion(active.id);
    if (def.rules) out.push({ source: def.name, rules: def.rules });
  }
  return out;
}

function makeCtx(combat: CombatState, mods: CombatModifiers): RuleContext {
  return { combat, mods, getStack: (k) => combat.stacks[k] ?? 0 };
}

/**
 * 규칙을 푼다. 걸린 가로채기가 없으면 base()를 그대로 돌려준다.
 *
 * 체인은 뒤에서부터 감아서 **먼저 획득한 것이 바깥쪽**에 오게 한다.
 * 바깥쪽이 먼저 호출되고, next()로 안쪽에 넘긴다.
 */
export function resolveRule<K extends RuleName>(
  run: RunState,
  combat: CombatState,
  mods: CombatModifiers,
  name: K,
  input: RuleInputs[K],
  base: () => RuleOutputs[K],
): RuleOutputs[K] {
  const chain = collectRules(run).filter((b) => b.rules[name]);
  if (chain.length === 0) return base();

  const ctx = makeCtx(combat, mods);
  let next = base;
  for (let i = chain.length - 1; i >= 0; i--) {
    const fn = chain[i]!.rules[name]!;
    const inner = next;
    next = () => (fn as RuleFnOf<K>)(ctx, input, inner);
  }
  return next();
}

type RuleFnOf<K extends RuleName> = (
  ctx: RuleContext,
  input: RuleInputs[K],
  next: () => RuleOutputs[K],
) => RuleOutputs[K];

/** 이 규칙을 가로채고 있는 것들. 디버깅·검증용. */
export function interceptorsOf(run: RunState, name: RuleName): string[] {
  return collectRules(run)
    .filter((b) => b.rules[name])
    .map((b) => b.source);
}
