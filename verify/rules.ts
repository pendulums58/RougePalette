import { startCombat, useAction, endPlayerTurn, resolveDefense, depsFor, skillCost, canUse } from '../src/game/systems/combat';
import { resolveRule, interceptorsOf, collectRules } from '../src/game/systems/rules';
import { grantUpgrade } from '../src/game/systems/upgrades';
import { startRun } from '../src/game/systems/run';
import { getCharacter } from '../src/game/data/characters';
import { getSkill } from '../src/game/data/skills';
import type { RunState } from '../src/game/types';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const heir = getCharacter('heir');
const slash = getSkill('slash');
const gFlat = getSkill('guard_flat');
const bare = (ids: string[]): RunState => {
  const r = startRun(heir, 1);
  r.upgrades.allocated = {} as any; r.upgrades.granted = [];
  for (const id of ids) grantUpgrade(r, id);
  return r;
};

console.log('── 가로채기가 없으면 기본 규칙 그대로 ──');
const r0 = bare([]); const d0 = depsFor(r0);
const c0 = startCombat(['husk'], r0.hp, r0.maxHp, d0);
check('참격 기본 코스트', skillCost(c0, slash, d0), 1);
useAction(c0, slash, 0, d0);
check('과부하 쌓인 뒤 코스트', skillCost(c0, slash, d0), 2);
check('방어는 과부하 무관', skillCost(c0, gFlat, d0), 1);
check('걸린 가로채기 없음', interceptorsOf(r0, 'skillCost'), []);

console.log('\n── 규칙 개변: 첫 행동은 공짜 (기본 규칙 대체) ──');
const r1 = bare(['drop_firstfree']); const d1 = depsFor(r1);
const c1 = startCombat(['husk'], r1.hp, r1.maxHp, d1);
check('가로채는 것', interceptorsOf(r1, 'skillCost'), ['첫 수']);
check('과부하 0일 때 공짜', skillCost(c1, slash, d1), 0);
const n1 = c1.player.notes;
useAction(c1, slash, 0, d1);
check('노트가 안 줄었다', c1.player.notes, n1);
check('그래도 과부하는 쌓인다', c1.player.overload, 1);
check('두 번째부터는 기본 규칙', skillCost(c1, slash, d1), 2);
check('방어 스킬은 영향 없음 (action만 가로챔)', skillCost(c1, gFlat, d1), 1);

console.log('\n── 규칙 개변: 확정 규칙("매 사이클 리필")을 바꾼다 ──');
const r2 = bare(['drop_hoard']); const d2 = depsFor(r2);
const c2 = startCombat(['husk'], r2.hp, r2.maxHp, d2);
const max2 = c2.player.maxNotes;
useAction(c2, slash, 0, d2);           // 1 소모
useAction(c2, slash, 0, d2);           // 2 소모
const left = c2.player.notes;
check('쓰고 남은 노트', left, max2 - 3);
endPlayerTurn(c2, d2);
resolveDefense(c2, null, d2);          // 적 턴 끝 -> 사이클 종료
check('리필이 아니라 이월 +1', c2.player.notes, Math.min(max2, left + 1));
check('기본이었다면 꽉 찼을 것', max2 !== Math.min(max2, left + 1), true);

console.log('\n── 체인: 여러 가로채기가 순서대로 엮이는가 ──');
const order: string[] = [];
const probe = (name: string, delta: number) => ({
  source: name,
  rules: { skillCost: (_c: any, _i: any, next: () => number) => { order.push(name); return next() + delta; } },
});
// resolveRule을 직접 호출해 체인만 본다
const rp = bare([]); const dp = depsFor(rp);
const cp = startCombat(['husk'], rp.hp, rp.maxHp, dp);
let chainResult = 0;
{
  const chain = [probe('A', 10), probe('B', 100)];
  let next = () => 1;
  for (let i = chain.length - 1; i >= 0; i--) {
    const fn = chain[i]!.rules.skillCost; const inner = next;
    next = () => fn({ combat: cp, mods: dp.mods, getStack: () => 0 } as any, { skill: slash }, inner);
  }
  chainResult = next();
}
check('바깥쪽(먼저 획득)이 먼저 호출', order, ['A', 'B']);
check('기본 1 -> B +100 -> A +10', chainResult, 111);

console.log('\n── 가로채기는 상태를 바꾸지 않는다 (값만 돌려준다) ──');
const r3 = bare(['drop_firstfree']); const d3 = depsFor(r3);
const c3 = startCombat(['husk'], r3.hp, r3.maxHp, d3);
const snap = JSON.stringify(c3);
skillCost(c3, slash, d3); canUse(c3, slash, d3); skillCost(c3, gFlat, d3);
check('질의만 해서는 상태 불변', JSON.stringify(c3), snap);

console.log('\n── 둘을 같이 걸면 ──');
const r4 = bare(['drop_firstfree', 'drop_hoard']); const d4 = depsFor(r4);
check('skillCost 가로채기', interceptorsOf(r4, 'skillCost'), ['첫 수']);
check('notesOnCycleStart 가로채기', interceptorsOf(r4, 'notesOnCycleStart'), ['쟁이는 버릇']);
check('둘 다 수집됨', collectRules(r4).map((b) => b.source), ['첫 수', '쟁이는 버릇']);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
