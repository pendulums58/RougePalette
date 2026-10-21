// 상태 보관 + 클릭 액션 디스패치 + 렌더 호출.
//
// GameState가 판별 유니온이라 화면마다 필요한 데이터가 타입으로 보장된다.
// 그래서 이 파일에 비null 단정(`!`)이 한 번도 없다.

import '../style.css';
import type { CombatState, GameState, RunState } from './types';
import { getCharacter } from './data/characters';
import { getSkill } from './data/skills';
import { Rng, randomSeed } from './systems/rng';
import {
  depsFor,
  endPlayerTurn,
  livingEnemies,
  resolveDefense,
  startCombat,
  useAction,
} from './systems/combat';
import { bankResources, grantUpgrade, selectInLine } from './systems/upgrades';
import { addPotion, tickPotions } from './systems/potions';
import {
  findNode,
  goldFor,
  isLastFloor,
  rollShopStock,
  rollSkillChoices,
  rollUpgradeChoices,
  startRun,
} from './systems/run';
import { nodeAt } from './systems/map';
import { render, type UiState } from './ui/render';
import { REST_HEAL_RATIO } from './tuning';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');
const root = app;

let game: GameState = { screen: 'title' };
let ui: UiState = { pendingSkillId: null };
let rng = new Rng(randomSeed());

function paint(): void {
  root.innerHTML = render(game, ui);
}

// ── 전투 종료 처리 ──────────────────────────────

/** 전투가 끝났으면 다음 화면을, 아니면 null을 돌려준다. */
function afterCombat(run: RunState, combat: CombatState): GameState | null {
  if (combat.outcome === null) return null;

  run.hp = combat.player.hp;
  bankResources(run, combat.earned);

  if (combat.outcome === 'lose') return { screen: 'gameOver', run, won: false };

  // 확정: 전투 보상으로 골드를 얻는다. 정예·보스는 더 준다 (STS 레퍼런스).
  const node = run.currentNodeId ? nodeAt(run.map, run.currentNodeId) : null;
  if (node) run.gold += goldFor(node.kind, rng);
  if (node?.kind === 'boss' && isLastFloor(run)) return { screen: 'gameOver', run, won: true };

  return {
    screen: 'reward',
    run,
    skillChoices: rollSkillChoices(getCharacter(run.characterId), rng),
    upgradeChoices: rollUpgradeChoices(run, rng),
  };
}

/** 전투 화면에서 한 수를 둔 뒤 공통으로 하는 일. */
function settle(run: RunState, combat: CombatState): void {
  ui.pendingSkillId = null;
  run.hp = combat.player.hp;
  game = afterCombat(run, combat) ?? { screen: 'combat', run, combat };
}

function advanceFloor(run: RunState): GameState {
  // 확정: 포션은 일정 **층** 동안 지속된다. 층을 넘길 때 줄인다.
  tickPotions(run);
  if (isLastFloor(run)) return { screen: 'gameOver', run, won: true };
  run.floorIndex += 1;
  return { screen: 'map', run };
}

// ── 입력 ────────────────────────────────────────

const actions: Record<string, (el: HTMLElement) => void> = {
  toCharacterSelect() {
    game = { screen: 'characterSelect' };
  },

  chooseCharacter(el) {
    const id = el.dataset.id;
    if (!id) return;
    const seed = randomSeed();
    rng = new Rng(seed);
    game = { screen: 'map', run: startRun(getCharacter(id), seed) };
  },

  enterNode(el) {
    if (game.screen !== 'map') return;
    const run = game.run;
    const node = findNode(run, el.dataset.id ?? '');
    if (!node) return;

    run.currentNodeId = node.id;
    run.visited.push(node.id);
    // 전투가 아닌 노드들. 상점·이벤트는 내용이 미정이라 자리만 있다.
    if (node.kind === 'rest') return void (game = { screen: 'rest', run });
    if (node.kind === 'shop')
      return void (game = { screen: 'shop', run, stock: rollShopStock(getCharacter(run.characterId), rng) });
    if (node.kind === 'event') return void (game = { screen: 'event', run });
    ui.pendingSkillId = null;
    game = {
      screen: 'combat',
      run,
      combat: startCombat(node.enemies, run.hp, run.maxHp, depsFor(run)),
    };
  },

  selectSkill(el) {
    if (game.screen !== 'combat') return;
    const { run, combat } = game;
    const id = el.dataset.id;
    if (!id) return;
    const skill = getSkill(id);
    const living = livingEnemies(combat);

    // 대상을 고를 필요가 없으면 바로 쓴다
    if (skill.hitsAll || living.length <= 1) {
      useAction(combat, skill, living[0] ?? 0, depsFor(run));
      settle(run, combat);
      return;
    }
    ui.pendingSkillId = ui.pendingSkillId === id ? null : id;
  },

  pickTarget(el) {
    if (game.screen !== 'combat' || ui.pendingSkillId === null) return;
    const { run, combat } = game;
    useAction(combat, getSkill(ui.pendingSkillId), Number(el.dataset.index), depsFor(run));
    settle(run, combat);
  },

  endTurn() {
    if (game.screen !== 'combat') return;
    const { run, combat } = game;
    endPlayerTurn(combat, depsFor(run));
    settle(run, combat);
  },

  defend(el) {
    if (game.screen !== 'combat') return;
    const { run, combat } = game;
    const id = el.dataset.id ?? '';
    resolveDefense(combat, id === '' ? null : getSkill(id), depsFor(run));
    settle(run, combat);
  },

  takeSkill(el) {
    if (game.screen !== 'reward') return;
    const id = el.dataset.id;
    if (!id) return;
    game.run.skills.push(id);
    game = advanceFloor(game.run);
  },

  takeUpgrade(el) {
    if (game.screen !== 'reward') return;
    const id = el.dataset.id;
    if (!id) return;
    grantUpgrade(game.run, id);
    game = advanceFloor(game.run);
  },

  skipReward() {
    if (game.screen !== 'reward') return;
    game = advanceFloor(game.run);
  },

  /**
   * 확정: 상점은 스킬과 포션을 판다.
   * 같은 것을 또 사는 것을 막지 않는다 — 스킬은 중복 강화(제작자 발의)의
   * 획득 경로이고, 포션은 확정 규칙상 스택형이기 때문이다.
   */
  buy(el) {
    if (game.screen !== 'shop') return;
    const entry = game.stock[Number(el.dataset.index)];
    if (!entry || entry.sold || game.run.gold < entry.price) return;
    game.run.gold -= entry.price;
    if (entry.kind === 'skill') game.run.skills.push(entry.refId);
    else addPotion(game.run, entry.refId);
    entry.sold = true;
  },

  /** 상점·이벤트에서 나간다. */
  leaveStub() {
    if (game.screen !== 'shop' && game.screen !== 'event') return;
    game = advanceFloor(game.run);
  },

  restHeal() {
    if (game.screen !== 'rest') return;
    const run = game.run;
    run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * REST_HEAL_RATIO));
    game = advanceFloor(run);
  },

  // 확정: 배분/재배분은 휴식 지점의 기회를 소모하지 않는다.
  // 그래서 맵에서도 휴식에서도 들어올 수 있고, 나가면 원래 화면으로 돌아간다.
  toAllocate(el) {
    if (game.screen !== 'map' && game.screen !== 'rest') return;
    const from = el.dataset.from === 'rest' ? 'rest' : 'map';
    game = { screen: 'allocate', run: game.run, returnTo: from };
  },

  leaveAllocate() {
    if (game.screen !== 'allocate') return;
    game = game.returnTo === 'rest' ? { screen: 'rest', run: game.run } : { screen: 'map', run: game.run };
  },

  // 확정: 라인마다 하나만, 비울 수는 없다. 그래서 "해제"가 아니라 교체만 있다.
  selectInLine(el) {
    if (game.screen !== 'allocate') return;
    const { line: lineId, id } = el.dataset;
    if (!lineId || !id) return;
    const line = getCharacter(game.run.characterId).grid.find((l) => l.id === lineId);
    if (line) selectInLine(game.run, line, id);
  },

  restart() {
    game = { screen: 'title' };
    ui = { pendingSkillId: null };
  },
};

root.addEventListener('click', (ev) => {
  const el = (ev.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!el || el.hasAttribute('disabled')) return;
  const handler = actions[el.dataset.action ?? ''];
  if (!handler) return;
  handler(el);
  paint();
});

paint();
