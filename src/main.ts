import './style.css';
import type { CardDef, GameState, MapNode } from './types';
import { getCharacter } from './data/characters';
import { getCard } from './data/cards';
import { Rng, randomSeed } from './systems/rng';
import { endTurn, playCard, startCombat } from './systems/combat';
import { isLastFloor, rollReward, startRun } from './systems/run';
import { render, type UiState } from './ui/render';

const app = document.getElementById('app');
if (!app) throw new Error('#app not found');

let game: GameState = { screen: { name: 'title' }, run: null, combat: null };
let ui: UiState = { selectedUid: null, restRemoving: false };
let rng = new Rng(randomSeed());

function paint(): void {
  app!.innerHTML = render(game, ui);
}

/** 전투 중 변한 체력을 런 상태에 반영한다. */
function syncHp(): void {
  if (game.run && game.combat) game.run.hp = game.combat.player.hp;
}

// ── 흐름 ────────────────────────────────────────

function enterNode(node: MapNode): void {
  const run = game.run!;
  run.currentNode = node;

  if (node.kind === 'rest') {
    ui.restRemoving = false;
    game.screen = { name: 'rest' };
    return;
  }

  game.combat = startCombat(run.deck, node.enemies, run.hp, run.maxHp, rng);
  ui.selectedUid = null;
  game.screen = { name: 'combat' };
}

function afterCombat(): void {
  const run = game.run!;
  const combat = game.combat!;
  syncHp();

  if (combat.outcome === 'lose') {
    game.screen = { name: 'gameOver', won: false };
    return;
  }

  if (run.currentNode?.kind === 'boss') {
    game.screen = { name: 'gameOver', won: true };
    return;
  }

  // 정예는 보상을 두 번 받는 대신 체력을 더 깎인다 — 밸런스는 여기서 만지면 된다.
  game.screen = { name: 'reward', choices: rollReward(run, rng) };
}

function advanceFloor(): void {
  const run = game.run!;
  if (isLastFloor(run)) {
    game.screen = { name: 'gameOver', won: true };
    return;
  }
  run.floorIndex += 1;
  game.combat = null;
  game.screen = { name: 'map' };
}

// ── 입력 ────────────────────────────────────────

const actions: Record<string, (el: HTMLElement) => void> = {
  toCharacterSelect() {
    game.screen = { name: 'characterSelect' };
  },

  chooseCharacter(el) {
    const id = el.dataset.id!;
    const seed = randomSeed();
    rng = new Rng(seed);
    game.run = startRun(getCharacter(id), seed);
    game.screen = { name: 'map' };
  },

  enterNode(el) {
    const run = game.run!;
    const node = (run.floors[run.floorIndex] ?? []).find((n) => n.id === el.dataset.id);
    if (node) enterNode(node);
  },

  selectCard(el) {
    const combat = game.combat!;
    const uid = el.dataset.uid!;
    const card = combat.hand.find((c) => c.uid === uid);
    if (!card || combat.energy < card.def.cost) return;

    if (card.def.needsTarget) {
      // 적이 하나뿐이면 지정 단계를 건너뛴다
      const living = combat.enemies.filter((e) => e.hp > 0);
      if (living.length === 1) {
        playCard(combat, uid, combat.enemies.indexOf(living[0]!), rng);
        ui.selectedUid = null;
        syncHp();
        if (combat.outcome) afterCombat();
        return;
      }
      ui.selectedUid = ui.selectedUid === uid ? null : uid;
      return;
    }

    playCard(combat, uid, null, rng);
    ui.selectedUid = null;
    syncHp();
    if (combat.outcome) afterCombat();
  },

  targetEnemy(el) {
    const combat = game.combat!;
    if (!ui.selectedUid) return;
    playCard(combat, ui.selectedUid, Number(el.dataset.index), rng);
    ui.selectedUid = null;
    syncHp();
    if (combat.outcome) afterCombat();
  },

  endTurn() {
    const combat = game.combat!;
    endTurn(combat, rng);
    ui.selectedUid = null;
    syncHp();
    if (combat.outcome) afterCombat();
  },

  takeReward(el) {
    const card: CardDef = getCard(el.dataset.id!);
    game.run!.deck.push(card);
    advanceFloor();
  },

  skipReward() {
    advanceFloor();
  },

  restHeal() {
    const run = game.run!;
    run.hp = Math.min(run.maxHp, run.hp + Math.floor(run.maxHp * 0.3));
    advanceFloor();
  },

  restRemove() {
    ui.restRemoving = true;
  },

  cancelRemove() {
    ui.restRemoving = false;
  },

  removeCard(el) {
    const run = game.run!;
    const index = Number(el.dataset.index);
    if (Number.isInteger(index) && index >= 0 && index < run.deck.length) {
      run.deck.splice(index, 1);
    }
    ui.restRemoving = false;
    advanceFloor();
  },

  restart() {
    game = { screen: { name: 'title' }, run: null, combat: null };
    ui = { selectedUid: null, restRemoving: false };
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
