import { modifiersFor, baseModifiers, collectContributions, collectMeta, applyMeta, fold, explain } from '../src/game/systems/modifiers';
import { grantUpgrade } from '../src/game/systems/upgrades';
import { addPotion } from '../src/game/systems/potions';
import { startRun } from '../src/game/systems/run';
import { getCharacter } from '../src/game/data/characters';
import type { RunState } from '../src/game/types';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const heir = getCharacter('heir');
/** 그리드 기본값을 비워 순수하게 보기 위해, 기여를 직접 만들어 접는다 */
const foldOnly = (contribs: any[]) => fold(baseModifiers(), contribs);
const c = (name: string, key: any, op: any, value: number, from: any = 'upgrade') =>
  ({ from, id: name, name, key, op, value });

console.log('── 순서가 결과를 바꾼다 (의도된 것) ──');
check('+1 다음 x2  -> (0+1)*2',
  foldOnly([c('A', 'notes', 'add', 1), c('B', 'notes', 'mul', 2)]).notes, 2);
check('x2 다음 +1  -> 0*2+1',
  foldOnly([c('B', 'notes', 'mul', 2), c('A', 'notes', 'add', 1)]).notes, 1);
check('납작한 합이었다면 둘 다 같았을 것', 1 + 2 === 2 + 1, true);

console.log('\n── 획득 순서가 곧 적용 순서인가 ──');
const mkRun = (ids: string[]): RunState => {
  const r = startRun(heir, 1);
  r.upgrades.allocated = {} as any;   // 그리드 기본값 제거 — 순서만 보려고
  r.upgrades.granted = [];
  for (const id of ids) grantUpgrade(r, id);
  return r;
};
// 벼린 날(+2 damage) 과 겹쳐진 날(x2 damage)
const a = mkRun(['valor_0', 'drop_doubling']);
const b = mkRun(['drop_doubling', 'valor_0']);
check('벼린날 -> 겹쳐진날 : (0+2)*2', modifiersFor(a).damage, 4);
check('겹쳐진날 -> 벼린날 : 0*2+2', modifiersFor(b).damage, 2);
check('수집 순서가 획득 순서', collectContributions(a).filter(x=>x.key==='damage').map(x=>x.name), ['벼린 날', '겹쳐진 날']);

console.log('\n── 메타: "포션 효과 2배" (합이었다면 불가능) ──');
const m = mkRun([]);
addPotion(m, 'brew_edge');                 // 포션: damage +4
check('메타 없을 때 포션 기여', modifiersFor(m).damage, 4);
grantUpgrade(m, 'drop_alchemy');           // 메타: 포션 출처 x2
check('연금술사의 손 -> 포션 기여 2배', modifiersFor(m).damage, 8);
check('메타가 걸린 것', collectMeta(m).map((x) => x.name), ['연금술사의 손']);

console.log('\n── 메타는 출처를 가려서 적용되는가 ──');
const m2 = mkRun(['valor_0']);             // 강화: damage +2
addPotion(m2, 'brew_edge');                // 포션: damage +4
check('메타 전', modifiersFor(m2).damage, 6);
grantUpgrade(m2, 'drop_alchemy');
check('포션(4)만 2배 -> 2 + 8', modifiersFor(m2).damage, 10);

console.log('\n── 메타가 곱하기 기여에 걸릴 때 ──');
// "x1.5 효과를 2배로" = 3배가 아니라 2배(1 + 0.5*2)여야 한다
check('x1.5를 2배 -> x2',
  applyMeta([c('P', 'damage', 'mul', 1.5, 'potion')], [{ op: { kind: 'scaleSource', from: 'potion', factor: 2 } } as any])[0]!.value, 2);

console.log('\n── 가드레일 ──');
check('과부하 증가량은 0 밑으로 안 감',
  foldOnly([c('X', 'overloadPerAction', 'add', -99)]).overloadPerAction, 0);
check('무방비 배율은 1 밑으로 안 감',
  foldOnly([c('X', 'unguardedMult', 'add', -99)]).unguardedMult, 1);

console.log('\n── 기존 동작 보존: add만 있으면 합과 같다 ──');
check('add 셋은 순서 무관',
  foldOnly([c('A','damage','add',1), c('B','damage','add',2), c('C','damage','add',3)]).damage,
  foldOnly([c('C','damage','add',3), c('A','damage','add',1), c('B','damage','add',2)]).damage);

console.log('\n── explain: 왜 그 값인지 순서대로 ──');
for (const line of explain(a, 'damage')) console.log('   ', line);
check('설명이 순서대로 나온다', explain(a, 'damage').length >= 3, true);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
