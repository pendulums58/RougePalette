import { generateMap, totalFloors, nodeAt } from '../src/game/systems/map';
import { Rng } from '../src/game/systems/rng';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const F = totalFloors();
const sign = (n: number) => (n > 0 ? 1 : n < 0 ? -1 : 0);

let crossings = 0, examples: string[] = [], kinds = new Set<string>();
let edgeCount = 0;

for (let seed = 1; seed <= 500; seed++) {
  const m = generateMap(new Rng(seed));
  for (const n of Object.values(m.nodes)) kinds.add(n.kind);

  for (let f = 0; f < F - 1; f++) {
    // 이 층에서 나가는 모든 간선을 (출발col, 도착col)로 모은다
    const edges: Array<[number, number]> = [];
    for (const id of m.floors[f]!) {
      const n = nodeAt(m, id);
      for (const to of n.next) edges.push([n.col, nodeAt(m, to).col]);
    }
    edgeCount += edges.length;

    for (let i = 0; i < edges.length; i++) {
      for (let j = i + 1; j < edges.length; j++) {
        const [a, b] = edges[i]!, [c, d] = edges[j]!;
        // 출발 순서와 도착 순서가 뒤집히면 X자로 교차한다
        if (sign(a - c) * sign(b - d) < 0) {
          crossings++;
          if (examples.length < 3) examples.push(`seed${seed} f${f}: ${a}->${b} 와 ${c}->${d}`);
        }
      }
    }
  }
}

console.log(`시드 500개 · 간선 ${edgeCount}개 전수 검사`);
check('X자 교차 0건', crossings, 0);
if (examples.length) console.log('  예시:', examples.join(' / '));

console.log('\n── 노드 종류 ──');
check('여섯 종류가 모두 등장', [...kinds].sort(), ['boss','combat','elite','event','rest','shop']);

// 상점·이벤트는 적이 없어야 한다
let badEnemies = 0;
for (let seed = 1; seed <= 50; seed++) {
  const m = generateMap(new Rng(seed));
  for (const n of Object.values(m.nodes)) {
    if ((n.kind === 'shop' || n.kind === 'event' || n.kind === 'rest') && n.enemies.length > 0) badEnemies++;
    if ((n.kind === 'combat' || n.kind === 'elite' || n.kind === 'boss') && n.enemies.length === 0) badEnemies++;
  }
}
check('전투 아닌 노드에 적 없음 / 전투 노드에 적 있음', badEnemies, 0);

// 첫 층은 전투
let firstFloorOk = true;
for (let seed = 1; seed <= 50; seed++) {
  const m = generateMap(new Rng(seed));
  if (!m.floors[0]!.every((id) => nodeAt(m, id).kind === 'combat')) firstFloorOk = false;
}
check('첫 층은 전부 전투', firstFloorOk, true);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
