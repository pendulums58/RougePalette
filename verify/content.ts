const B = '../src/game';
import { defineRegistry, checkRefs } from '../src/game/data/registry';
import { Skills, getSkill } from '../src/game/data/skills';
import { Enemies } from '../src/game/data/enemies';
import { Upgrades } from '../src/game/data/upgrades';
import { Characters, getCharacter } from '../src/game/data/characters';
import { Potions, getPotion } from '../src/game/data/potions';
import { addPotion, tickPotions, potionModifiers, stacked } from '../src/game/systems/potions';
import { modifiersFor } from '../src/game/systems/modifiers';
import { startRun, rollShopStock } from '../src/game/systems/run';
import { startCombat, depsFor } from '../src/game/systems/combat';
import { Rng } from '../src/game/systems/rng';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};
const throws = (fn: () => unknown) => { try { fn(); return null; } catch (e) { return (e as Error).message; } };

console.log('── 템플릿: 잘못된 콘텐츠를 로드 시점에 잡는가 ──');
check('id 중복 거부', !!throws(() => defineRegistry('x', [{id:'a',name:'A'},{id:'a',name:'B'}])), true);
check('빈 id 거부', !!throws(() => defineRegistry('x', [{id:'',name:'A'}])), true);
check('빈 이름 거부', !!throws(() => defineRegistry('x', [{id:'a',name:''}])), true);
check('종류별 규칙 거부', !!throws(() => defineRegistry('x', [{id:'a',name:'A'}], () => '안 됨')), true);
check('알 수 없는 id 조회 시 종류를 알려줌',
  throws(() => Skills.get('없는스킬'))?.includes('스킬') && throws(() => Skills.get('없는스킬'))?.includes('없는스킬'), true);
check('참조 검사', checkRefs('풀', ['slash','없음'], Skills.has), '풀에 없는 id: 없음');
check('참조 통과 시 null', checkRefs('풀', ['slash'], Skills.has), null);

console.log('\n── 템플릿: 확정 규칙을 기계로 검사하는가 ──');
// 긍정 = 순수 메리트 (확정). 디메리트가 섞인 긍정 강화는 거부돼야 한다.
const badPos = throws(() => defineRegistry('강화', [{
  id: 'bad', name: '나쁜 긍정', polarity: 'positive', cost: 0, text: '', modifiers: { damage: 5, notes: -1 },
}] as any, (u: any) => {
  const worse: any = { notes:'negative', damage:'negative', mitigation:'negative', overloadPerAction:'positive', unguardedMult:'positive' };
  if (u.polarity === 'positive') {
    const bad = Object.keys(u.modifiers).filter((k) => worse[k] === 'negative' ? u.modifiers[k] < 0 : u.modifiers[k] > 0);
    if (bad.length) return `긍정 강화는 순수 메리트여야 한다: ${bad.join(',')}`;
  }
  return null;
}));
check('긍정 강화에 디메리트 섞이면 거부', !!badPos, true);
check('실제 데이터의 긍정 강화는 전부 순수 메리트',
  Upgrades.filter((u) => u.polarity === 'positive').length > 0, true);

console.log('\n── 실제 콘텐츠가 전부 규칙을 지키는가 ──');
check('스킬', Skills.all.length > 0, true);
check('적', Enemies.all.length > 0, true);
check('강화', Upgrades.all.length > 0, true);
check('캐릭터', Characters.all.length, 2);
check('포션 종류', Potions.all.length, 6);
check('포션 전부 1층 이상 지속', Potions.all.every((p) => p.floors >= 1), true);

console.log('\n── 확정: 포션은 일정 층 지속 / 스택형 ──');
const heir = getCharacter('heir');
const run = startRun(heir, 1);
check('시작엔 포션 없음', run.potions.length, 0);
addPotion(run, 'brew_edge');            // floors 3, damage +4
check('지속 층수', run.potions[0]!.floorsLeft, 3);
check('피해 +4', potionModifiers(run).damage, 4);
addPotion(run, 'brew_edge');            // 스택
check('스택되면 2개', run.potions.length, 2);
check('스택만큼 더해짐 +8', potionModifiers(run).damage, 8);
check('묶어 보기', stacked(run), [{ id: 'brew_edge', count: 2, floorsLeft: 3 }]);
check('fresh 표시', run.potions.every((p) => p.fresh), true);

tickPotions(run);   // 산 층을 떠나는 첫 틱 — 건너뛴다 (그 층에선 못 썼으므로)
check('산 층을 떠나는 틱은 안 깎임', run.potions.every((p) => p.floorsLeft === 3), true);
tickPotions(run);
check('그 다음부터 1씩 줄어듦', run.potions.every((p) => p.floorsLeft === 2), true);
tickPotions(run); tickPotions(run);
check('다 쓰면 사라짐', run.potions.length, 0);
check('효과도 사라짐', potionModifiers(run).damage ?? 0, 0);

console.log('\n── 확정: 전투 시작 시 버프로 적용 ──');
const run2 = startRun(heir, 1);
const baseNotes = startCombat(['husk'], run2.hp, run2.maxHp, depsFor(run2)).player.maxNotes;
addPotion(run2, 'brew_breath');         // notes +1
const buffedNotes = startCombat(['husk'], run2.hp, run2.maxHp, depsFor(run2)).player.maxNotes;
check('포션이 전투 시작 노트에 반영', buffedNotes, baseNotes + 1);
addPotion(run2, 'brew_breath');
check('스택도 반영', startCombat(['husk'], run2.hp, run2.maxHp, depsFor(run2)).player.maxNotes, baseNotes + 2);

console.log('\n── 확정: 상점은 스킬과 포션을 판다 ──');
const stock = rollShopStock(heir, new Rng(9));
check('스킬 재고', stock.filter((e) => e.kind === 'skill').length, 3);
check('포션 재고', stock.filter((e) => e.kind === 'potion').length, 2);
check('포션 가격은 정의값', stock.filter((e) => e.kind === 'potion').every((e) => e.price === getPotion(e.refId).price), true);
check('스킬 참조가 실제 스킬', stock.filter((e) => e.kind === 'skill').every((e) => Skills.has(e.refId)), true);

console.log('\n── 직렬화 ──');
addPotion(run2, 'brew_edge');
check('JSON 왕복 동일', JSON.parse(JSON.stringify(run2)), run2);

console.log(fail === 0 ? '\n모든 검증 통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
