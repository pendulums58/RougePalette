// 런 진행 — 맵 생성, 노드 선택, 보상 추첨.
//
// design.md 확정:
// - 무작위성은 **런 레이어**에 있다: 전투 후 스킬 획득, 강화 제시
// - 휴식 지점은 **n층마다** 있다 (n은 미정)
// - 휴식 지점에서 **HP 회복**은 선택지로 확정. 다른 선택지는 미정
// - 자원 배분은 휴식 지점의 기회를 **소모하지 않는다**
//
// ⚠️ 맵 구조 자체(층 수, 분기 개수, 정예 노드의 존재)는 design.md에 없다.
//    아래는 전부 플레이스홀더이며, 맵을 제대로 설계하면 갈아끼우는 자리다.

import type { CharacterDef, NodeKind, RunState, ShopEntry, SkillId, UpgradeId } from '../types';
import { Rng } from './rng';
import { newUpgradeState, alreadyGranted } from './upgrades';
import { grantPool } from '../data/upgrades';
import { generateMap, nodeAt, reachable, totalFloors } from './map';
import { POTION_IDS, getPotion } from '../data/potions';
import {
  GOLD_BOSS,
  GOLD_COMBAT,
  GOLD_ELITE,
  SHOP_POTION_STOCK,
  SHOP_SKILL_PRICE,
  SHOP_SKILL_STOCK,
  SKILL_CHOICES,
  UPGRADE_CHOICES,
} from '../tuning';

export function startRun(character: CharacterDef, seed: number): RunState {
  const rng = new Rng(seed);
  return {
    characterId: character.id,
    seed,
    hp: character.maxHp,
    maxHp: character.maxHp,
    skills: [...character.startingSkills],
    gold: 0,
    potions: [],
    map: generateMap(rng),
    floorIndex: 0,
    currentNodeId: null,
    visited: [],
    upgrades: newUpgradeState(character.grid),
  };
}

/** 지금 층에서 고를 수 있는 노드들 (직전 노드에서 이어지는 것만). */
export function choices(run: RunState) {
  return reachable(run.map, run.floorIndex, run.currentNodeId).map((id) => nodeAt(run.map, id));
}

export function findNode(run: RunState, id: string) {
  return choices(run).find((n) => n.id === id);
}

/**
 * 전투에서 떨어지는 골드.
 * 확정: 전투 보상으로 골드를 얻고, 정예·보스는 더 준다 (STS 레퍼런스).
 * 수치는 tuning.ts의 플레이스홀더다.
 */
export function goldFor(kind: NodeKind, rng: Rng): number {
  const [lo, hi] = kind === 'boss' ? GOLD_BOSS : kind === 'elite' ? GOLD_ELITE : GOLD_COMBAT;
  return rng.int(lo, hi);
}

/**
 * 상점 재고. 확정: **스킬과 포션을 판다.**
 * 재고 구성과 가격대는 플레이스홀더다.
 */
export function rollShopStock(character: CharacterDef, rng: Rng): ShopEntry[] {
  const [lo, hi] = SHOP_SKILL_PRICE;
  const skills: ShopEntry[] = rng
    .sample(character.skillPool, SHOP_SKILL_STOCK)
    .map((refId) => ({ kind: 'skill' as const, refId, price: rng.int(lo, hi), sold: false }));
  const potions: ShopEntry[] = rng
    .sample(POTION_IDS, SHOP_POTION_STOCK)
    .map((refId) => ({ kind: 'potion' as const, refId, price: getPotion(refId).price, sold: false }));
  return [...skills, ...potions];
}

export function isLastFloor(run: RunState): boolean {
  return run.floorIndex >= totalFloors() - 1;
}

// ── 보상 추첨 ───────────────────────────────────

/** 전투 후 제시할 스킬 후보. 이미 가진 스킬도 중복 획득할 수 있다. */
export function rollSkillChoices(character: CharacterDef, rng: Rng): SkillId[] {
  return rng.sample(character.skillPool, SKILL_CHOICES);
}

/**
 * 전투 후 제시할 강화 후보 (확정: 무작위 제시 경로).
 *
 * 그리드 후보는 배분으로만 얻으므로 여기서 제외된다.
 * 미정: 두 경로가 같은 풀을 써야 하는지. 지금은 분리해 뒀다.
 */
export function rollUpgradeChoices(run: RunState, rng: Rng): UpgradeId[] {
  const pool = grantPool(run.characterId).filter((id) => !alreadyGranted(run, id));
  return rng.sample(pool, UPGRADE_CHOICES);
}
