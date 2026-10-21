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

import type { CharacterDef, MapNode, NodeKind, RunState, SkillId, UpgradeId } from '../types';
import { Rng } from './rng';
import { newUpgradeState, alreadyGranted } from './upgrades';
import { grantPool } from '../data/upgrades';
import { FLOORS_BEFORE_BOSS, REST_INTERVAL, SKILL_CHOICES, UPGRADE_CHOICES } from '../tuning';

const NORMAL_POOLS: string[][] = [['husk'], ['swarm', 'swarm'], ['husk', 'swarm']];
const ELITE_POOLS: string[][] = [['sentinel'], ['sentinel', 'swarm']];

export function startRun(character: CharacterDef, seed: number): RunState {
  const rng = new Rng(seed);
  return {
    characterId: character.id,
    seed,
    hp: character.maxHp,
    maxHp: character.maxHp,
    skills: [...character.startingSkills],
    floors: generateFloors(rng),
    floorIndex: 0,
    currentNodeId: null,
    upgrades: newUpgradeState(character.grid),
  };
}

export function generateFloors(rng: Rng): MapNode[][] {
  const floors: MapNode[][] = [];

  for (let i = 0; i < FLOORS_BEFORE_BOSS; i++) {
    // 휴식 지점은 n층마다 (확정 구조, n은 플레이스홀더)
    if (i > 0 && (i + 1) % REST_INTERVAL === 0) {
      floors.push([{ id: `f${i}-rest`, kind: 'rest', enemies: [] }]);
      continue;
    }

    const count = i === 0 ? 1 : 2;
    const options: MapNode[] = [];
    for (let j = 0; j < count; j++) {
      const kind: NodeKind = i >= 3 && rng.next() < 0.3 ? 'elite' : 'combat';
      options.push({
        id: `f${i}-${j}`,
        kind,
        enemies: rng.pick(kind === 'elite' ? ELITE_POOLS : NORMAL_POOLS),
      });
    }
    floors.push(options);
  }

  floors.push([{ id: 'boss', kind: 'boss', enemies: ['warden'] }]);
  return floors;
}

export function currentFloor(run: RunState): MapNode[] {
  return run.floors[run.floorIndex] ?? [];
}

export function findNode(run: RunState, id: string): MapNode | undefined {
  return currentFloor(run).find((n) => n.id === id);
}

export function isLastFloor(run: RunState): boolean {
  return run.floorIndex >= run.floors.length - 1;
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
