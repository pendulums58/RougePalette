// 역공 판정.
//
// design.md 확정: 역공을 쓴다. 목적은 무지성 공격에 리스크를 주는 것.
//
// **미정이라 비워 둔 것**: 조건이 어디에 붙는가(몹마다 / 캐릭터마다 / 둘 다),
// 구체적인 조건, 역공이 정확히 무엇을 하는가.
//
// 그래서 여기는 **판정 함수를 모으고 돌리는 자리**일 뿐이다. 조건을 캐릭터에
// 두든 몹에 두든 강화에 두든 같은 자리에서 돌아가므로, 나중에 소재지를 바꿔도
// 데이터만 옮기면 된다.

import type {
  CharacterDef,
  CombatModifiers,
  CombatState,
  CounterCheck,
  CounterContext,
  CounterTrigger,
  EnemyDef,
  RunState,
} from '../types';
import { getEnemy } from '../data/enemies';
import { getUpgrade } from '../data/upgrades';
import { getPotion } from '../data/potions';
import { activeUpgrades } from './upgrades';

interface Bound {
  source: string;
  check: CounterCheck;
}

/**
 * 지금 걸려 있는 역공 판정 전부.
 *
 * 네 군데서 올 수 있다 — 캐릭터 / 적 / 강화 / 포션.
 * 어디에 둘지가 미정이라 **전부 받아들이고 OR로 합친다.**
 * (AND나 우선순위가 필요해지면 여기를 바꾸면 된다)
 */
export function collectCounterChecks(
  run: RunState,
  character: CharacterDef,
  enemy: EnemyDef,
): Bound[] {
  const out: Bound[] = [];
  if (character.counter) out.push({ source: character.name, check: character.counter });
  if (enemy.counter) out.push({ source: enemy.name, check: enemy.counter });
  for (const id of activeUpgrades(run)) {
    const def = getUpgrade(id);
    if (def.counter) out.push({ source: def.name, check: def.counter });
  }
  for (const active of run.potions) {
    const def = getPotion(active.id);
    if (def.counter) out.push({ source: def.name, check: def.counter });
  }
  return out;
}

/**
 * 역공이 일어나는가. 하나라도 통과하면 일어난다.
 * 통과시킨 판정의 출처를 같이 돌려준다 — 로그에 남겨 추적할 수 있게.
 */
export function checkCounter(
  run: RunState,
  combat: CombatState,
  mods: CombatModifiers,
  character: CharacterDef,
  enemyIndex: number,
  trigger: CounterTrigger,
): string | null {
  const e = combat.enemies[enemyIndex];
  if (!e || e.hp <= 0) return null;
  const enemy = getEnemy(e.defId);

  const ctx: CounterContext = {
    combat,
    mods,
    character,
    enemy,
    enemyIndex,
    getStack: (k) => combat.stacks[k] ?? 0,
  };

  for (const { source, check } of collectCounterChecks(run, character, enemy)) {
    if (check(ctx, trigger)) return source;
  }
  return null;
}

/** 지금 역공 판정을 가지고 있는 것들. 디버깅·검증용. */
export function counterSources(run: RunState, character: CharacterDef, enemy: EnemyDef): string[] {
  return collectCounterChecks(run, character, enemy).map((b) => b.source);
}
