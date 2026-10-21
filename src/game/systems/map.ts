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
      const want = isBossFloor(f)
        ? Math.floor(width / 2) // 보스 층은 갈래가 하나로 모인다
        : col + rng.int(-1, 1);
      const nextCol = clampNonCrossing(links[f - 1]!, col, want, width);

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

/**
 * 확정: **경로가 서로 교차하지 않는다** (X자로 엇갈리는 모양 금지).
 *
 * 한 층의 간선이 "출발이 왼쪽이면 도착도 왼쪽"이라는 단조성을 지키면 두 간선은
 * 절대 교차하지 않는다. 그래서 새 간선의 도착 칸을
 *   lo = 나보다 왼쪽에서 출발한 간선들의 도착 중 가장 오른쪽
 *   hi = 나보다 오른쪽에서 출발한 간선들의 도착 중 가장 왼쪽
 * 사이로 가둔다. 기존 간선들이 이미 단조로우므로 lo <= hi가 항상 성립한다.
 */
function clampNonCrossing(
  linksAtFloor: Map<number, Set<number>>,
  from: number,
  want: number,
  width: number,
): number {
  let lo = 0;
  let hi = width - 1;
  for (const [src, targets] of linksAtFloor) {
    if (src < from) lo = Math.max(lo, ...targets);
    else if (src > from) hi = Math.min(hi, ...targets);
  }
  return Math.min(hi, Math.max(lo, want));
}

function pickKind(floor: number, rng: Rng): NodeKind {
  if (isBossFloor(floor)) return 'boss';
  if (isRestFloor(floor)) return 'rest';
  // 첫 층은 평범한 전투로 시작한다 (플레이스홀더 규칙)
  if (floor === 0) return 'combat';

  // ⚠️ 가중치와 등장 규칙은 전부 플레이스홀더다. design.md: "각 노드 종류의
  //    등장 규칙과 빈도" 미정. 정예는 초반에 안 나오게만 막아 뒀다.
  const roll = rng.next();
  if (floor >= 3 && roll < 0.18) return 'elite';
  if (roll < 0.32) return 'event';
  if (roll < 0.42) return 'shop';
  return 'combat';
}

function enemiesFor(kind: NodeKind, rng: Rng): string[] {
  switch (kind) {
    case 'rest':
    case 'shop':
    case 'event':
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
