// 포션 — 일정 층 동안 지속되는 스택형 버프. DOM을 건드리지 않는다.
//
// design.md 확정: 일정 층 지속 / 여러 종류 / 전투 시작 시 버프 / 스택형.

import type { ActivePotion, CombatModifiers, PotionId, RunState } from '../types';
import { getPotion } from '../data/potions';

/** 포션을 하나 얻는다. 같은 것을 또 얻으면 **따로 쌓인다** (스택형). */
export function addPotion(run: RunState, id: PotionId): void {
  run.potions.push({ id, floorsLeft: getPotion(id).floors, fresh: true });
}

/**
 * 층을 하나 넘겼다. 남은 층수를 줄이고 다 쓴 것은 버린다.
 *
 * 미정: 같은 종류를 여러 개 샀을 때 지속 층수를 각각 세는지 합치는지.
 * 지금은 **각각 따로** 센다.
 */
export function tickPotions(run: RunState): void {
  run.potions = run.potions
    .map((p) =>
      // 산 층을 떠나는 첫 틱은 건너뛴다 (그 층에는 전투가 없어 쓸 수 없었으므로)
      p.fresh ? { ...p, fresh: false } : { ...p, floorsLeft: p.floorsLeft - 1 },
    )
    .filter((p) => p.floorsLeft > 0);
}

/** 지금 걸려 있는 포션이 더하는 값. 스택된 만큼 전부 더해진다. */
export function potionModifiers(run: RunState): Partial<CombatModifiers> {
  const sum: Partial<CombatModifiers> = {};
  for (const p of run.potions) {
    const def = getPotion(p.id);
    for (const [key, value] of Object.entries(def.modifiers)) {
      const k = key as keyof CombatModifiers;
      sum[k] = (sum[k] ?? 0) + (value ?? 0);
    }
  }
  return sum;
}

/** 같은 종류끼리 묶어서 보여주기 위한 집계. */
export function stacked(run: RunState): Array<{ id: PotionId; count: number; floorsLeft: number }> {
  const byId = new Map<PotionId, ActivePotion[]>();
  for (const p of run.potions) {
    const list = byId.get(p.id) ?? [];
    list.push(p);
    byId.set(p.id, list);
  }
  return [...byId].map(([id, list]) => ({
    id,
    count: list.length,
    // 가장 오래 남은 것을 보여준다
    floorsLeft: Math.max(...list.map((p) => p.floorsLeft)),
  }));
}
