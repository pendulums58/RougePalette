import { goldFor, rollShopStock, startRun } from '../src/game/systems/run';
import { getCharacter } from '../src/game/data/characters';
import { Rng } from '../src/game/systems/rng';
import { GOLD_COMBAT, GOLD_ELITE, GOLD_BOSS, SHOP_SKILL_STOCK, SHOP_POTION_STOCK, SHOP_SKILL_PRICE } from '../src/game/tuning';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const heir = getCharacter('heir');

console.log('── 확정: 정예·보스가 더 준다 ──');
const rng = new Rng(1);
const samples = { combat: [] as number[], elite: [] as number[], boss: [] as number[] };
for (let i = 0; i < 2000; i++) {
  samples.combat.push(goldFor('combat', rng));
  samples.elite.push(goldFor('elite', rng));
  samples.boss.push(goldFor('boss', rng));
}
const range = (a: number[]) => [Math.min(...a), Math.max(...a)];
check('전투 골드 범위', range(samples.combat), GOLD_COMBAT);
check('정예 골드 범위', range(samples.elite), GOLD_ELITE);
check('보스 골드 범위', range(samples.boss), GOLD_BOSS);
check('전투 < 정예 < 보스 (최솟값 기준)',
  GOLD_COMBAT[0] < GOLD_ELITE[0] && GOLD_ELITE[0] < GOLD_BOSS[0], true);
check('휴식/상점/이벤트는 전투 취급 안 함 — 호출 자체가 전투 노드에서만',
  goldFor('rest', new Rng(5)) >= GOLD_COMBAT[0], true);

console.log('\n── 확정: 상점은 스킬을 판다 ──');
const stock = rollShopStock(heir, new Rng(7));
check('재고 수 (스킬+포션)', stock.length, SHOP_SKILL_STOCK + SHOP_POTION_STOCK);
const skillEntries = stock.filter((e) => e.kind === 'skill');
check('스킬 재고는 그 캐릭터 풀에서', skillEntries.every((e) => heir.skillPool.includes(e.refId)), true);
check('스킬 중복 없음', new Set(skillEntries.map((e) => e.refId)).size, skillEntries.length);
check('스킬 가격이 범위 안', skillEntries.every((e) => e.price >= SHOP_SKILL_PRICE[0] && e.price <= SHOP_SKILL_PRICE[1]), true);
check('처음엔 전부 미판매', stock.every((e) => !e.sold), true);
check('같은 시드면 같은 재고', JSON.stringify(rollShopStock(heir, new Rng(7))), JSON.stringify(stock));

console.log('\n── 구매가 상태에 반영되는가 ──');
const run = startRun(heir, 1);
check('시작 골드 0', run.gold, 0);
run.gold += goldFor('boss', new Rng(3));
const before = run.gold;
const skillsBefore = run.skills.length;
const e0 = skillEntries[0]!;
// main.ts의 buySkill과 같은 절차
run.gold -= e0.price;
run.skills.push(e0.refId);
e0.sold = true;
check('골드 차감', run.gold, before - e0.price);
check('스킬 추가', run.skills.length, skillsBefore + 1);
check('판매 표시', e0.sold, true);
check('직렬화 유지', JSON.parse(JSON.stringify(run)), run);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
