import { startCombat, useAction, endPlayerTurn, resolveDefense, depsFor } from '../src/game/systems/combat';
import { counterSources, checkCounter, collectCounterChecks } from '../src/game/systems/counter';
import { startRun } from '../src/game/systems/run';
import { getCharacter } from '../src/game/data/characters';
import { getEnemy } from '../src/game/data/enemies';
import { getSkill } from '../src/game/data/skills';
import type { CharacterDef, RunState } from '../src/game/types';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const heir = getCharacter('heir');
const heavy = getSkill('heavy');   // 피해 20 (+그리드 기본 5 = 25)
const slash = getSkill('slash');   // 피해 8 (+5 = 13)
const bare = (): RunState => {
  const r = startRun(heir, 1);
  r.upgrades.allocated = {} as any; r.upgrades.granted = [];
  return r;
};

console.log('── 판정 소재지: 네 군데 어디든 된다 ──');
const r = bare();
check('파수꾼은 조건을 가짐', counterSources(r, heir, getEnemy('sentinel')), ['파수꾼']);
check('껍데기는 없음', counterSources(r, heir, getEnemy('husk')), []);
// 캐릭터에 붙여도 같은 자리에서 돈다
const charWithCounter: CharacterDef = { ...heir, counter: () => true };
check('캐릭터에 붙이면 캐릭터가 나옴',
  counterSources(r, charWithCounter, getEnemy('husk')), [charWithCounter.name]);
check('둘 다 붙으면 둘 다 (OR로 합침)',
  counterSources(r, charWithCounter, getEnemy('sentinel')).length, 2);

console.log('\n── 판정에 필요한 정보가 다 들어오는가 ──');
let seen: any = null;
const probe: CharacterDef = { ...heir, counter: (ctx, t) => { seen = { enemy: ctx.enemy.name, hp: ctx.combat.player.hp, at: t.at }; return false; } };
const rp = bare(); const dp = { ...depsFor(rp), character: probe };
const cp = startCombat(['husk'], rp.hp, rp.maxHp, dp);
useAction(cp, slash, 0, dp);
check('적 / 전투상태 / 시점이 다 보인다', seen, { enemy: '껍데기', hp: rp.hp, at: 'afterPlayerAction' });

console.log('\n── 역공이 턴을 뺏는가 (플레이어 턴 중) ──');
const r2 = bare(); const d2 = depsFor(r2);
// 파수꾼 hp 58, 25% = 14.5. 강타(25) -> 역공, 참격(13) -> 역공 없음
const c2 = startCombat(['sentinel'], r2.hp, r2.maxHp, d2);
useAction(c2, slash, 0, d2);
check('약한 공격은 역공 없음', c2.phase, 'player');
useAction(c2, heavy, 0, d2);
check('큰 공격 -> 역공으로 방어 페이즈', c2.phase, 'defend');
check('역공 표시', c2.pending?.counter, true);
check('로그에 역공', c2.log.some((l) => l.includes('역공')), true);

const hp0 = c2.player.hp;
resolveDefense(c2, null, d2);              // 무방비로 받음
check('피해를 받았다', c2.player.hp < hp0, true);
check('사이클이 끝나지 않고 내 턴 복귀', c2.phase, 'player');
check('여전히 1사이클', c2.cycle, 1);
check('복귀 로그', c2.log.some((l) => l.includes('다시 내 턴')), true);

console.log('\n── 역공 중에 또 역공이 터지지 않는가 (중첩 미정이라 막음) ──');
const r3 = bare(); const d3 = depsFor(r3);
const c3 = startCombat(['sentinel'], r3.hp, r3.maxHp, d3);
useAction(c3, heavy, 0, d3);               // 역공 발생
check('역공 대기', c3.pending?.counter, true);
resolveDefense(c3, null, d3);
check('해결 후 방어 페이즈 아님', c3.phase, 'player');
check('대기 비워짐', c3.pending, null);

console.log('\n── 적 턴 중 역공은 큐에 끼어든다 (턴을 뺏지 않음) ──');
// 캐릭터 조건으로 afterPlayerDefend에서 한 번만 터지게 한다
let fired = false;
const defendCounter: CharacterDef = {
  ...heir,
  counter: (_c, t) => { if (t.at === 'afterPlayerDefend' && !fired) { fired = true; return true; } return false; },
};
const r4 = bare(); const d4 = { ...depsFor(r4), character: defendCounter };
const c4 = startCombat(['husk'], r4.hp, r4.maxHp, d4);   // husk 1사이클: 할퀴기 8 단발
endPlayerTurn(c4, d4);
check('적 턴 시작', c4.phase, 'defend');
resolveDefense(c4, null, d4);              // 역공이 큐 앞에 하나 더
check('역공으로 공격이 하나 더', c4.phase, 'defend');
check('역공이 끼어든 것이지 턴 탈취 아님', c4.pending?.counter ?? false, false);
resolveDefense(c4, null, d4);
check('그 뒤 사이클 종료', c4.cycle, 2);

console.log('\n── 판정은 상태를 바꾸지 않는다 ──');
const r5 = bare(); const d5 = depsFor(r5);
const c5 = startCombat(['sentinel'], r5.hp, r5.maxHp, d5);
const snap = JSON.stringify(c5);
checkCounter(r5, c5, d5.mods, heir, 0, { at: 'afterPlayerAction', skillId: 'slash', cost: 1, damageDealt: 99 });
check('판정만으로는 불변', JSON.stringify(c5), snap);

console.log('\n── 쓰러진 적은 역공하지 않는다 ──');
const r6 = bare(); const d6 = depsFor(r6);
const c6 = startCombat(['sentinel'], r6.hp, r6.maxHp, d6);
c6.enemies[0]!.hp = 0;
check('죽은 적 판정 null', checkCounter(r6, c6, d6.mods, heir, 0, { at: 'afterPlayerAction', skillId: 'heavy', cost: 2, damageDealt: 99 }), null);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
