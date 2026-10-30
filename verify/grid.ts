import { startRun } from '../src/game/systems/run';
import { selectInLine, selectionRefusal, swapCost, activeUpgrades } from '../src/game/systems/upgrades';
import { modifiersFor } from '../src/game/systems/modifiers';
import { getCharacter } from '../src/game/data/characters';
import { getUpgrade, buildGrid, grantPool, assertGridValid } from '../src/game/data/upgrades';
import { rollUpgradeChoices } from '../src/game/systems/run';
import { Rng } from '../src/game/systems/rng';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const heir = getCharacter('heir');
const grid = heir.grid;
const line = (id: string) => grid.find((l) => l.id === id)!;

console.log('── 확정: 라인마다 0코스트 후보가 반드시 있다 ──');
for (const c of ['heir', 'observer']) {
  const g = buildGrid(c);
  let threw = false;
  try { assertGridValid(g); } catch { threw = true; }
  check(`${c} 그리드 유효`, threw, false);
  check(`${c} 모든 라인에 0코스트`, g.every((l) => l.candidates.some((id) => getUpgrade(id).cost === 0)), true);
  check(`${c} 라인 계열 일치`, g.every((l) => l.candidates.every((id) => getUpgrade(id).polarity === l.polarity)), true);
}
// 0코스트가 없는 라인은 거부돼야 한다
let threw = false;
try { assertGridValid([{ id: 'x', name: 'x', polarity: 'positive', candidates: ['renew_1'] }]); } catch { threw = true; }
check('0코스트 없는 라인 거부', threw, true);

console.log('\n── 확정: 각 라인에서 아무것도 안 고를 수 없다 ──');
let run = startRun(heir, 1);
check('런 시작부터 모든 라인이 채워짐', Object.keys(run.upgrades.allocated).sort(), grid.map((l) => l.id).sort());
check('기본값은 전부 0코스트', Object.values(run.upgrades.allocated).every((id) => getUpgrade(id).cost === 0), true);
check('자원 0에서도 그리드가 꽉 참', activeUpgrades(run).length, grid.length);

console.log('\n── 확정: 같은 라인에서는 하나만 ──');
run.upgrades.resources.positive = 10;
check('쇄신 기본', run.upgrades.allocated['renew'], 'renew_0');
check('쇄신 교체', selectInLine(run, line('renew'), 'renew_1'), true);
check('이전 것이 빠짐', run.upgrades.allocated['renew'], 'renew_1');
check('라인당 1개 유지', Object.values(run.upgrades.allocated).filter((id) => line('renew').candidates.includes(id)).length, 1);
check('활성 개수는 라인 수 그대로', activeUpgrades(run).length, grid.length);

console.log('\n── 확정: 재배분은 차액만 ──');
run = startRun(heir, 1);
run.upgrades.resources.positive = 10;
check('0 -> 2 차액', swapCost(run, line('renew'), 'renew_1'), 2);
selectInLine(run, line('renew'), 'renew_1');
check('자원 10-2', run.upgrades.resources.positive, 8);
check('2 -> 5 차액', swapCost(run, line('renew'), 'heir_renew'), 3);
selectInLine(run, line('renew'), 'heir_renew');
check('자원 8-3', run.upgrades.resources.positive, 5);
check('5 -> 0 차액 (환급)', swapCost(run, line('renew'), 'renew_0'), -5);
selectInLine(run, line('renew'), 'renew_0');
check('전액 환급되어 10', run.upgrades.resources.positive, 10);
// 기본값 중 경감을 주는 것: loyal_0(+1), rev_0(+2) = 3
const fresh = startRun(heir, 1);
check('효과도 원복 (기본값과 동일)', modifiersFor(run).mitigation, modifiersFor(fresh).mitigation);
check('기본 경감값 확인', modifiersFor(fresh).mitigation, 3);

console.log('\n── 자원 부족 / 잘못된 후보 거부 ──');
run = startRun(heir, 1);
run.upgrades.resources.positive = 1;
check('부족하면 거부', selectionRefusal(run, line('renew'), 'renew_1'), 'insufficient');
check('실제로 안 바뀜', selectInLine(run, line('renew'), 'renew_1'), false);
check('이미 켜진 것', selectionRefusal(run, line('renew'), 'renew_0'), 'already');
check('다른 라인 후보', selectionRefusal(run, line('renew'), 'valor_1'), 'notCandidate');
check('부정 라인은 부정 자원으로', selectionRefusal(run, line('plea'), 'plea_1'), 'insufficient');
run.upgrades.resources.negative = 5;
check('부정 자원 생기면 가능', selectInLine(run, line('plea'), 'plea_1'), true);
check('긍정 자원은 그대로', run.upgrades.resources.positive, 1);

console.log('\n── 두 경로 분리: 그리드 후보는 보상에 안 나온다 ──');
run = startRun(heir, 1);
const inGrid = new Set(grid.flatMap((l) => l.candidates));
check('grantPool과 그리드가 겹치지 않음', grantPool('heir').some((id) => inGrid.has(id)), false);
const choices = rollUpgradeChoices(run, new Rng(5));
check('제시된 후보도 겹치지 않음', choices.some((id) => inGrid.has(id)), false);

console.log('\n── 직렬화 ──');
run = startRun(heir, 7);
check('JSON 왕복 동일', JSON.parse(JSON.stringify(run)), run);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
