// 값 효과 파이프라인.
//
// 납작한 합이 아니다. **출처가 붙은 기여를 모아 순서대로 접는다.**
//
//   1. 기여 수집 — 강화(획득 순) 다음 포션(획득 순). 각 기여에 출처가 붙는다
//   2. 메타 적용 — "포션 출처 기여 x2" 같은, 다른 효과를 건드리는 효과
//   3. 접기     — 수집 순서대로 add / mul을 차례로 적용
//
// 왜 합이 아닌가:
// - 합은 순서를 못 쓴다. "노트 2배"를 표현할 수 없다
// - 합은 출처를 지운다. "포션 효과 2배" 같은 메타 효과가 불가능해진다
//
// 순서가 결과를 바꾸는 것은 **의도된 것**이다. 획득 순서가 곧 적용 순서이고,
// explain()으로 그 순서를 그대로 볼 수 있다.

import type {
  CombatModifiers,
  Contribution,
  MetaOp,
  ModKey,
  RunState,
} from '../types';
import { getUpgrade } from '../data/upgrades';
import { getPotion } from '../data/potions';
import { activeUpgrades } from './upgrades';
import { OVERLOAD_PER_ACTION, UNGUARDED_MULT } from '../tuning';

const KEYS: ModKey[] = ['notes', 'overloadPerAction', 'unguardedMult', 'damage', 'mitigation'];

/** 아무 효과도 없을 때의 값. */
export function baseModifiers(): CombatModifiers {
  return {
    notes: 0,
    overloadPerAction: OVERLOAD_PER_ACTION,
    unguardedMult: UNGUARDED_MULT,
    damage: 0,
    mitigation: 0,
  };
}

// ── 1. 수집 ─────────────────────────────────────

/**
 * 지금 걸려 있는 값 기여 전부. **이 순서가 적용 순서다.**
 * 포션은 스택된 만큼 각각 들어간다 (확정: 스택형).
 */
export function collectContributions(run: RunState): Contribution[] {
  const out: Contribution[] = [];

  const push = (from: Contribution['from'], id: string, name: string, def: {
    modifiers?: Partial<CombatModifiers>;
    multipliers?: Partial<Record<ModKey, number>>;
  }) => {
    for (const key of KEYS) {
      const add = def.modifiers?.[key];
      if (add !== undefined && add !== 0) out.push({ from, id, name, key, op: 'add', value: add });
    }
    for (const key of KEYS) {
      const mul = def.multipliers?.[key];
      if (mul !== undefined && mul !== 1) out.push({ from, id, name, key, op: 'mul', value: mul });
    }
  };

  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    push('upgrade', id, def.name, def);
  }
  for (const active of run.potions) {
    const def = getPotion(active.id);
    push('potion', active.id, def.name, def);
  }
  return out;
}

/** 지금 걸려 있는 메타 효과 전부. 수집과 같은 순서다. */
export function collectMeta(run: RunState): Array<{ name: string; op: MetaOp }> {
  const out: Array<{ name: string; op: MetaOp }> = [];
  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    for (const op of def.meta ?? []) out.push({ name: def.name, op });
  }
  for (const active of run.potions) {
    const def = getPotion(active.id);
    for (const op of def.meta ?? []) out.push({ name: def.name, op });
  }
  return out;
}

// ── 2. 메타 적용 ────────────────────────────────

/**
 * 메타 효과로 기여를 변형한다.
 *
 * 'add' 기여는 값을 그대로 factor배 한다.
 * 'mul' 기여는 **1에서 떨어진 만큼**을 factor배 한다 — 1.5배 효과를 2배로 만들면
 * 3배가 아니라 2배(= 1 + 0.5*2)가 되는 것이 "효과가 2배"의 뜻이기 때문이다.
 */
export function applyMeta(contribs: Contribution[], metas: Array<{ op: MetaOp }>): Contribution[] {
  let out = contribs;
  for (const { op } of metas) {
    out = out.map((c) => {
      const hit =
        op.kind === 'scaleSource' ? c.from === op.from : c.key === op.key;
      if (!hit) return c;
      return c.op === 'add'
        ? { ...c, value: c.value * op.factor }
        : { ...c, value: 1 + (c.value - 1) * op.factor };
    });
  }
  return out;
}

// ── 3. 접기 ─────────────────────────────────────

export function fold(base: CombatModifiers, contribs: Contribution[]): CombatModifiers {
  const out = { ...base };
  for (const c of contribs) {
    out[c.key] = c.op === 'add' ? out[c.key] + c.value : out[c.key] * c.value;
  }
  // 규칙이 무너지지 않게 가둔다
  out.overloadPerAction = Math.max(0, out.overloadPerAction);
  out.unguardedMult = Math.max(1, out.unguardedMult); // 무방비가 방어보다 유리해지면 안 된다
  return out;
}

// ── 바깥에서 쓰는 것 ────────────────────────────

/** 지금 전투에 적용되는 최종 수치. */
export function modifiersFor(run: RunState): CombatModifiers {
  return fold(baseModifiers(), applyMeta(collectContributions(run), collectMeta(run)));
}

/**
 * 그 값이 왜 나왔는지 한 줄씩. 순서가 결과를 바꾸므로 **순서대로** 보여준다.
 * 디버깅·검증용이고, 필요하면 UI에서 그대로 쓸 수 있다.
 */
export function explain(run: RunState, key: ModKey): string[] {
  const lines: string[] = [];
  let value = baseModifiers()[key];
  lines.push(`기본 ${value}`);

  const metas = collectMeta(run);
  for (const c of applyMeta(collectContributions(run), metas)) {
    if (c.key !== key) continue;
    value = c.op === 'add' ? value + c.value : value * c.value;
    lines.push(`${c.name} ${c.op === 'add' ? (c.value >= 0 ? `+${c.value}` : `${c.value}`) : `x${c.value}`} → ${Math.round(value * 100) / 100}`);
  }
  for (const { name, op } of metas) {
    lines.push(`(메타) ${name}: ${op.kind === 'scaleSource' ? `${op.from} 출처` : op.key} x${op.factor}`);
  }
  return lines;
}
