import { startRun } from '../src/game/systems/run';
import { addPotion, tickPotions, potionModifiers } from '../src/game/systems/potions';
import { getCharacter } from '../src/game/data/characters';
import { getPotion } from '../src/game/data/potions';

let fail = 0;
const check = (l: string, got: unknown, want: unknown) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  if (!ok) fail++;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${l}  got=${JSON.stringify(got)} want=${JSON.stringify(want)}`);
};

// "N층 지속" = 산 다음 층부터 N개 층에서 실제로 효과가 있어야 한다
for (const id of ['brew_surge', 'brew_edge', 'brew_guard']) {
  const def = getPotion(id);
  const run = startRun(getCharacter('heir'), 1);
  addPotion(run, id);
  tickPotions(run);              // 산 층을 떠난다 (여기서는 못 썼다)

  let usable = 0;
  for (let i = 0; i < 10; i++) {
    if (Object.keys(potionModifiers(run)).length > 0) usable++;
    else break;
    tickPotions(run);            // 그 층을 다 쓰고 떠난다
  }
  check(`${def.name}: ${def.floors}층 지속 -> 실제 사용 가능 층수`, usable, def.floors);
}
console.log(fail === 0 ? '\n통과' : `\n${fail}건 실패`);
process.exit(fail === 0 ? 0 : 1);
