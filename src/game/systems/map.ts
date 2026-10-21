// 맵 생성.
//
// design.md **확정**:
// - 맵은 특정 알고리즘 하에 **매 런 무작위로 생성된다**
// - 슬레이 더 스파이어처럼 **올라가는 분기 구조가 화면에 보여야 한다**
// - **n층마다 휴식 확정**, **n층마다 보스 확정**
//
// 알고리즘(아래 walk 방식)과 파라미터(폭, 경로 수, n 값들)는 전부 플레이스홀더다.
// design.md "맵 — 미해결 부분" 참조.

import type { GameMap, MapNode, NodeId, NodeKind } from '../types';
import type { Rng } from './rng';
import { BOSS_COUNT, BOSS_EVERY, MAP_PATHS, MAP_WIDTH, REST_EVERY } from '../tuning';

const NORMAL_POOLS: string[][] = [['husk'], ['swarm', 'swarm'], ['husk', 'swarm']];
const ELITE_POOLS: string[][] = [['sentinel'], ['sentinel', 'swarm']];
const BOSS_POOL: string[] = ['warden'];

/** 총 층 수. 마지막 층이 마지막 보스가 되도록 맞춘다. */
export function totalFloors(): number {
  return BOSS_EVERY * BOSS_COUNT;
}

function isBossFloor(floor: number): boolean {
  return (floor + 1) % BOSS_EVERY === 0;
}

/** 보스 층이 휴식 층과 겹치면 보스가 이긴다. */
function isRestFloor(floor: number): boolean {
  return !isBossFloor(floor) && (floor + 1) % REST_EVERY === 0;
}

const nodeId = (floor: number, col: number) => `n${floor}_${col}`;

/**
 * 바닥에서 꼭대기까지 경로를 여러 번 그어 그래프를 만든다 (STS가 쓰는 방식).
 * 각 걸음은 한 칸 위로 가면서 좌우로 최대 1칸 움직인다.
 */
export function generateMap(rng: Rng): GameMap {
  const floors = totalFloors();
  const width = MAP_WIDTH;

  // floor -> col -> 다음 층에서 이어지는 col 집합
  const present: Array<Set<number>> = Array.from({ length: floors }, () => new Set());
  const links: Array<Map<number, Set<number>>> = Array.from({ length: floors }, () => new Map());

  for (let p = 0; p < MAP_PATHS; p++) {
    let col = rng.int(0, width - 1);
    present[0]!.add(col);

    for (let f = 1; f < floors; f++) {
      // 보스 층은 갈래가 하나로 모인다
      const nextCol = isBossFloor(f)
        ? Math.floor(width / 2)
        : Math.min(width - 1, Math.max(0, col + rng.int(-1, 1)));

      if (!links[f - 1]!.has(col)) links[f - 1]!.set(col, new Set());
      links[f - 1]!.get(col)!.add(nextCol);
      present[f]!.add(nextCol);
      col = nextCol;
    }
  }

  // 그래프를 노드로 굳힌다
  const nodes: Record<NodeId, MapNode> = {};
  const byFloor: NodeId[][] = [];

  for (let f = 0; f < floors; f++) {
    const cols = [...present[f]!].sort((a, b) => a - b);
    byFloor.push(cols.map((c) => nodeId(f, c)));

    for (const c of cols) {
      const kind = pickKind(f, rng);
      nodes[nodeId(f, c)] = {
        id: nodeId(f, c),
        kind,
        floor: f,
        col: c,
        enemies: enemiesFor(kind, rng),
        next: [...(links[f]!.get(c) ?? [])].sort((a, b) => a - b).map((n) => nodeId(f + 1, n)),
      };
    }
  }

  return { width, floors: byFloor, nodes };
}

function pickKind(floor: number, rng: Rng): NodeKind {
  if (isBossFloor(floor)) return 'boss';
  if (isRestFloor(floor)) return 'rest';
  // 첫 층은 평범한 전투로 시작한다 (플레이스홀더 규칙)
  if (floor === 0) return 'combat';
  return rng.next() < 0.25 ? 'elite' : 'combat';
}

function enemiesFor(kind: NodeKind, rng: Rng): string[] {
  switch (kind) {
    case 'rest':
      return [];
    case 'boss':
      return BOSS_POOL;
    case 'elite':
      return rng.pick(ELITE_POOLS);
    default:
      return rng.pick(NORMAL_POOLS);
  }
}

// ── 조회 ────────────────────────────────────────

export function nodeAt(map: GameMap, id: NodeId): MapNode {
  const n = map.nodes[id];
  if (!n) throw new Error(`unknown map node: ${id}`);
  return n;
}

/**
 * 지금 고를 수 있는 노드들.
 * 아직 아무 데도 안 갔으면 시작 층 전부, 아니면 직전 노드에서 이어지는 것만.
 */
export function reachable(map: GameMap, floorIndex: number, currentNodeId: NodeId | null): NodeId[] {
  if (currentNodeId === null) return map.floors[0] ?? [];
  const from = nodeAt(map, currentNodeId);
  // 직전 노드의 다음 층이 지금 층일 때만 유효하다
  return from.floor + 1 === floorIndex ? from.next : (map.floors[floorIndex] ?? []);
}
