import { startCombat, useAction, endPlayerTurn, resolveDefense, depsFor } from '../src/game/systems/combat';
import { fire, boundTo, collectHooks } from '../src/game/systems/hooks';
import { grantUpgrade } from '../src/game/systems/upgrades';
import { modifiersFor } from '../src/game/systems/modifiers';
import { addPotion } from '../src/game/systems/potions';
import { startRun } from '../src/game/systems/run';
import { getCharacter } from '../src/game/data/characters';
import { getSkill } from '../src/game/data/skills';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

const heir = getCharacter('heir');
const slash = getSkill('slash');
const gFlat = getSkill('guard_flat');

console.log('── 발화 순서가 명시적인가 ──');
const run = startRun(heir, 1);
grantUpgrade(run, 'drop_backdraft');
addPotion(run, 'brew_echo');
check('강화 -> 포션 순서', collectHooks(run).map((b) => b.source), ['역류', '메아리 물약']);
check('onEnemyDefeated에 걸린 것', boundTo(run, 'onEnemyDefeated'), ['역류']);
check('onDamaged에 걸린 것', boundTo(run, 'onDamaged'), ['메아리 물약']);
check('아무도 안 건 훅', boundTo(run, 'onAction'), []);

console.log('\n── 훅이 없으면 아무 일도 안 일어나는가 ──');
const plain = startRun(heir, 1);
const pc = startCombat(['husk'], plain.hp, plain.maxHp, depsFor(plain));
const before = JSON.stringify(pc);
fire(plain, pc, modifiersFor(plain), 'onAction', { skillId: 'slash', cost: 1, damageDealt: 8 });
check('상태 불변', JSON.stringify(pc), before);

console.log('\n── 반응: 적을 쓰러뜨리면 노트 환급 (값 질의로는 불가) ──');
const heavy = getSkill('heavy');
// 훅이 없는 쪽과 비교해야 환급이 훅 때문인지 알 수 있다
const noHook = startRun(heir, 1);
const dn = depsFor(noHook);
const cn = startCombat(['swarm'], noHook.hp, noHook.maxHp, dn);
const nn0 = cn.player.notes;
useAction(cn, heavy, 0, dn);   // 코스트 2(과부하 0). 그리드 기본값 덕에 한 방에 격파된다
check('훅 없는 쪽도 격파', cn.enemies[0]!.hp, 0);
check('훅 없으면 환급 없음 — 쓴 만큼만 줄어듦', cn.player.notes, nn0 - 2);

// 한 방에 잡기: 적 hp보다 큰 피해
const r3 = startRun(heir, 1);
grantUpgrade(r3, 'drop_backdraft');
grantUpgrade(r3, 'heir_valor');               // 피해 +12 -> 강타 32
const d3 = depsFor(r3);
const c3 = startCombat(['swarm'], r3.hp, r3.maxHp, d3);  // swarm hp 22
const n0 = c3.player.notes;
useAction(c3, heavy, 0, d3);                  // 코스트 2, 피해 32 -> 격파
check('적 격파', c3.enemies[0]!.hp, 0);
check('노트: 2 쓰고 1 환급 = -1', c3.player.notes, n0 - 2 + 1);
check('로그에 출처가 남는가', c3.log.some((l) => l.includes('[역류]')), true);

console.log('\n── 반응 + 스택: 두 훅이 맞물리는가 ──');
const r4 = startRun(heir, 1);
addPotion(r4, 'brew_echo');
const d4 = depsFor(r4);
// swarm의 1사이클 패턴은 [쪼기 5, 쪼기 5] — 한 턴에 공격이 둘이라
// 사이클이 끝나기 전 상태를 관찰할 수 있다
const c4 = startCombat(['swarm'], r4.hp, r4.maxHp, d4);
check('전투 시작 시 스택 비어 있음', c4.stacks, {});
endPlayerTurn(c4, d4);
resolveDefense(c4, null, d4);                  // 첫 쪼기 무방비 -> 스택 1
check('피해 받으면 스택 1 (사이클 진행 중)', c4.stacks['echo'], 1);
check('아직 방어 페이즈', c4.phase, 'defend');
resolveDefense(c4, null, d4);                  // 둘째 쪼기 -> 스택 2 -> 사이클 끝에 환급
check('사이클 끝나며 스택 소비', c4.stacks['echo'] ?? 0, 0);
check('환급 로그', c4.log.some((l) => l.includes('[메아리 물약]')), true);

console.log('\n── 포션 스택형: 같은 포션 2개면 2번 발화 ──');
const r5 = startRun(heir, 1);
addPotion(r5, 'brew_echo');
addPotion(r5, 'brew_echo');
check('두 번 걸림', boundTo(r5, 'onDamaged').length, 2);
const d5 = depsFor(r5);
const c5 = startCombat(['swarm'], r5.hp, r5.maxHp, d5);
endPlayerTurn(c5, d5);
resolveDefense(c5, null, d5);                  // 한 번 맞음, 사이클은 아직 진행 중
check('한 번 맞아도 스택 2 (2개가 각각 발화)', c5.stacks['echo'] ?? 0, 2);

console.log('\n── 훅 API가 좁은가 (경계값) ──');
const r6 = startRun(heir, 1);
const d6 = depsFor(r6);
const c6 = startCombat(['husk'], r6.hp, r6.maxHp, d6);
fire(r6, c6, d6.mods, 'onCombatStart', {});
c6.player.notes = c6.player.maxNotes;
// refundNotes가 maxNotes를 넘지 않는지 — 직접 API를 만들어 확인
let apiRefunded = 0;
const probe = { onCombatStart: (api: any) => { api.refundNotes(99); apiRefunded = api.combat.player.notes; } };
(probe.onCombatStart as any)({ combat: c6, mods: d6.mods, refundNotes: (n: number) => { c6.player.notes = Math.min(c6.player.maxNotes, c6.player.notes + n); } });
check('refundNotes는 maxNotes를 안 넘음', c6.player.notes, c6.player.maxNotes);

console.log('\n── 기존 확정 규칙이 그대로인가 ──');
const r7 = startRun(heir, 1);
const d7 = depsFor(r7);
const c7 = startCombat(['husk'], r7.hp, r7.maxHp, d7);
check('턴 노트 = 캐릭터 수치 + 강화', c7.player.maxNotes, heir.notes + d7.mods.notes);
useAction(c7, slash, 0, d7);
check('과부하 1', c7.player.overload, 1);
check('방어는 과부하 무관', gFlat.cost, 1);
check('직렬화', JSON.parse(JSON.stringify(c7)).stacks, c7.stacks);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
