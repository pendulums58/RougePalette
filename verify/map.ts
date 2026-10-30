import { generateMap, totalFloors, reachable, nodeAt } from '../src/game/systems/map';
import { Rng } from '../src/game/systems/rng';
import { REST_EVERY, BOSS_EVERY, BOSS_COUNT, MAP_WIDTH } from '../src/game/tuning';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

console.log(`설정: 휴식 ${REST_EVERY}층마다 / 보스 ${BOSS_EVERY}층마다 / 보스 ${BOSS_COUNT}회 / 폭 ${MAP_WIDTH}`);
const F = totalFloors();
check('총 층 수 = 보스간격 × 보스횟수', F, BOSS_EVERY * BOSS_COUNT);

// 여러 시드로 불변식 확인 — 무작위 생성이므로 한 판만 보면 안 된다
let bossFloorsSeen: number[] = [];
let restFloorsSeen: number[] = [];
let allConnected = true, allReachable = true, bossSingle = true, restFull = true, widthOk = true;

for (let seed = 1; seed <= 200; seed++) {
  const m = generateMap(new Rng(seed));
  const bossF: number[] = [], restF: number[] = [];

  for (let f = 0; f < F; f++) {
    const ids = m.floors[f]!;
    if (ids.length === 0) { allConnected = false; break; }
    const kinds = new Set(ids.map((id) => nodeAt(m, id).kind));
    if (kinds.has('boss')) { bossF.push(f); if (ids.length !== 1) bossSingle = false; }
    else if (kinds.has('rest')) { restF.push(f); if (kinds.size !== 1) restFull = false; }
    if (ids.some((id) => nodeAt(m, id).col >= m.width || nodeAt(m, id).col < 0)) widthOk = false;

    // 마지막 층이 아니면 모든 노드에 나가는 간선이 있어야 한다
    if (f < F - 1 && ids.some((id) => nodeAt(m, id).next.length === 0)) allConnected = false;
    // 첫 층이 아니면 모든 노드에 들어오는 간선이 있어야 한다
    if (f > 0) {
      const incoming = new Set(m.floors[f - 1]!.flatMap((id) => nodeAt(m, id).next));
      if (ids.some((id) => !incoming.has(id))) allReachable = false;
    }
  }
  if (seed === 1) { bossFloorsSeen = bossF; restFloorsSeen = restF; }
  if (JSON.stringify(bossF) !== JSON.stringify(bossFloorsSeen)) bossSingle = false;
  if (JSON.stringify(restF) !== JSON.stringify(restFloorsSeen)) restFull = false;
}

console.log('\n── 확정: n층마다 보스 / n층마다 휴식 ──');
check('보스 층 (0-based)', bossFloorsSeen, Array.from({length: BOSS_COUNT}, (_, i) => (i + 1) * BOSS_EVERY - 1));
// 기대값: (f+1)%REST===0 이면서 보스층이 아닌 모든 층
const expectRest = Array.from({ length: F }, (_, f) => f)
  .filter((f) => (f + 1) % BOSS_EVERY !== 0 && (f + 1) % REST_EVERY === 0);
check('휴식 층 (0-based)', restFloorsSeen, expectRest);
check('휴식 간격이 런 전체에서 일정', expectRest.length, Math.floor(F / REST_EVERY) - bossFloorsSeen.filter((f) => (f + 1) % REST_EVERY === 0).length);
check('200개 시드 전부 같은 층에 보스', bossSingle, true);
check('200개 시드 전부 같은 층에 휴식, 그 층은 전부 휴식', restFull, true);
check('마지막 층이 보스', nodeAt(generateMap(new Rng(1)), generateMap(new Rng(1)).floors[F-1]![0]!).kind, 'boss');

console.log('\n── 확정: 알고리즘 기반 그래프 (끊긴 길 없음) ──');
check('모든 노드에 나가는 길', allConnected, true);
check('모든 노드에 들어오는 길', allReachable, true);
check('보스 층은 갈래가 하나로 모임', bossSingle, true);
check('col이 폭 안에', widthOk, true);

console.log('\n── 확정: 매 런 무작위 생성 ──');
const a = generateMap(new Rng(1)), b2 = generateMap(new Rng(2)), a2 = generateMap(new Rng(1));
check('다른 시드 = 다른 맵', JSON.stringify(a) === JSON.stringify(b2), false);
check('같은 시드 = 같은 맵 (재현)', JSON.stringify(a) === JSON.stringify(a2), true);

console.log('\n── 경로 제약: 이어진 노드로만 갈 수 있다 ──');
const m = generateMap(new Rng(3));
check('시작은 1층 전체', reachable(m, 0, null), m.floors[0]);
const start = m.floors[0]![0]!;
check('1층 노드에서 2층은 그 노드의 next만', reachable(m, 1, start), nodeAt(m, start).next);
check('next가 실제 2층 노드', nodeAt(m, start).next.every((id) => m.floors[1]!.includes(id)), true);
const branching = m.floors.findIndex((ids) => ids.length > 1);
check('분기가 실제로 존재', branching >= 0, true);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
