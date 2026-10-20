// 턴 노트 전투 검증용 샌드박스의 엔트리.
// 기존 스캐폴딩(index.html / src/main.ts)과 완전히 분리되어 있다.

import '../style.css';
import { setEnemyLookup, startCombat, resolveDefense, endPlayerTurn, useAction } from './combat';
import { getEnemy } from './enemies';
import { getSkill } from './skills';
import { render } from './render';
import type { ProtoState } from './types';

setEnemyLookup(getEnemy);

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

const ENEMY_ID = 'dummy';
let state: ProtoState = startCombat(getEnemy(ENEMY_ID));

function paint(): void {
  app!.innerHTML = render(state);
}

const actions: Record<string, (el: HTMLElement) => void> = {
  useAction(el) {
    useAction(state, getSkill(el.dataset.id!));
  },

  endTurn() {
    endPlayerTurn(state);
  },

  defend(el) {
    // data-id가 빈 문자열이면 "방어 안 함" 선언
    const id = el.dataset.id ?? '';
    resolveDefense(state, id === '' ? null : getSkill(id));
  },

  restart() {
    state = startCombat(getEnemy(ENEMY_ID));
  },
};

app.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!el || el.hasAttribute('disabled')) return;
  const handler = actions[el.dataset.action!];
  if (!handler) return;
  handler(el);
  paint();
});

paint();
