import type { CardDef, CardInstance, CombatState, Combatant, GameState, MapNode, Statuses } from '../types';
import { CHARACTERS } from '../data/characters';

/** 렌더링에만 쓰이는, 저장할 필요 없는 상태. */
export interface UiState {
  selectedUid: string | null;
  restRemoving: boolean;
}

const NODE_LABEL: Record<MapNode['kind'], string> = {
  combat: '전투',
  elite: '정예',
  rest: '모닥불',
  boss: '보스',
};

const STATUS_LABEL: Record<keyof Statuses, string> = {
  strength: '힘',
  weak: '약화',
  vulnerable: '취약',
  regen: '재생',
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

export function render(game: GameState, ui: UiState): string {
  switch (game.screen.name) {
    case 'title':
      return titleScreen();
    case 'characterSelect':
      return characterSelect();
    case 'map':
      return mapScreen(game);
    case 'combat':
      return combatScreen(game, ui);
    case 'reward':
      return rewardScreen(game.screen.choices);
    case 'rest':
      return restScreen(game, ui);
    case 'gameOver':
      return gameOverScreen(game.screen.won);
  }
}

// ── 화면들 ──────────────────────────────────────

function titleScreen(): string {
  return `
    <section class="screen screen--center">
      <h1 class="title">이름 없는 덱빌더</h1>
      <p class="subtitle">턴제 덱빌딩 로그라이트 · 프로토타입</p>
      <button class="btn btn--primary" data-action="toCharacterSelect">시작</button>
    </section>`;
}

function characterSelect(): string {
  const cards = CHARACTERS.map(
    (c) => `
      <button class="pick" data-action="chooseCharacter" data-id="${esc(c.id)}">
        <span class="pick__name">${esc(c.name)}</span>
        <span class="pick__hp">체력 ${c.maxHp}</span>
        <span class="pick__tagline">${esc(c.tagline)}</span>
      </button>`,
  ).join('');

  return `
    <section class="screen screen--center">
      <h2 class="heading">누구로 내려갈까</h2>
      <div class="pick-row">${cards}</div>
    </section>`;
}

function mapScreen(game: GameState): string {
  const run = game.run!;
  const options = run.floors[run.floorIndex] ?? [];

  const nodes = options
    .map(
      (n) => `
      <button class="node node--${n.kind}" data-action="enterNode" data-id="${esc(n.id)}">
        <span class="node__kind">${NODE_LABEL[n.kind]}</span>
        <span class="node__detail">${n.enemies.length ? esc(enemyNames(n)) : '휴식한다'}</span>
      </button>`,
    )
    .join('');

  return `
    <section class="screen">
      ${runHeader(game)}
      <h2 class="heading">${run.floorIndex + 1}층 / ${run.floors.length}층</h2>
      <div class="node-row">${nodes}</div>
      ${deckList(run.deck, false)}
    </section>`;
}

function enemyNames(n: MapNode): string {
  const counted = new Map<string, number>();
  for (const id of n.enemies) counted.set(id, (counted.get(id) ?? 0) + 1);
  return [...counted].map(([id, c]) => (c > 1 ? `${id} ×${c}` : id)).join(', ');
}

function combatScreen(game: GameState, ui: UiState): string {
  const s = game.combat!;
  const needsTarget = ui.selectedUid
    ? (s.hand.find((c) => c.uid === ui.selectedUid)?.def.needsTarget ?? false)
    : false;

  return `
    <section class="screen screen--combat">
      ${runHeader(game)}

      <div class="enemies ${needsTarget ? 'enemies--targeting' : ''}">
        ${s.enemies.map((e, i) => enemyView(e, i, needsTarget)).join('')}
      </div>

      <div class="player-bar">
        ${hpBar(s.player)}
        <div class="energy">${s.energy} / ${s.maxEnergy}</div>
        <button class="btn" data-action="endTurn">턴 종료</button>
      </div>

      <div class="hand">
        ${s.hand.map((c) => cardView(c, s, ui)).join('')}
      </div>

      <div class="piles">
        <span>뽑을 더미 ${s.drawPile.length}</span>
        <span>버린 더미 ${s.discardPile.length}</span>
        <span>소멸 ${s.exhaustPile.length}</span>
        <span class="piles__turn">${s.turn}턴</span>
      </div>

      <p class="log">${esc(s.log.slice(-3).join(' '))}</p>
    </section>`;
}

function enemyView(e: CombatState['enemies'][number], index: number, targeting: boolean): string {
  if (e.hp <= 0) return `<div class="enemy enemy--dead"><span class="enemy__name">${esc(e.name)}</span><span>쓰러짐</span></div>`;
  return `
    <button class="enemy" data-action="targetEnemy" data-index="${index}" ${targeting ? '' : 'disabled'}>
      <span class="enemy__name">${esc(e.name)}</span>
      <span class="enemy__intent">${esc(e.intent.label)}</span>
      ${hpBar(e)}
      ${statusRow(e.statuses)}
    </button>`;
}

function hpBar(c: Combatant): string {
  const pct = Math.max(0, Math.round((c.hp / c.maxHp) * 100));
  return `
    <div class="hp">
      <div class="hp__fill" style="width:${pct}%"></div>
      <span class="hp__text">${c.hp} / ${c.maxHp}${c.block > 0 ? ` · 방어 ${c.block}` : ''}</span>
    </div>`;
}

function statusRow(st: Statuses): string {
  const entries = Object.entries(st).filter(([, v]) => (v ?? 0) > 0);
  if (entries.length === 0) return '';
  return `<div class="statuses">${entries
    .map(([k, v]) => `<span class="chip">${STATUS_LABEL[k as keyof Statuses]} ${v}</span>`)
    .join('')}</div>`;
}

function cardView(c: CardInstance, s: CombatState, ui: UiState): string {
  const affordable = s.energy >= c.def.cost;
  const selected = ui.selectedUid === c.uid;
  return `
    <button
      class="card card--${c.def.type} ${affordable ? '' : 'card--unaffordable'} ${selected ? 'card--selected' : ''}"
      data-action="selectCard" data-uid="${esc(c.uid)}">
      <span class="card__cost">${c.def.cost}</span>
      <span class="card__name">${esc(c.def.name)}</span>
      <span class="card__text">${esc(c.def.text)}</span>
    </button>`;
}

function rewardScreen(choices: CardDef[]): string {
  return `
    <section class="screen screen--center">
      <h2 class="heading">보상</h2>
      <div class="reward-row">
        ${choices
          .map(
            (c) => `
          <button class="card card--${c.type}" data-action="takeReward" data-id="${esc(c.id)}">
            <span class="card__cost">${c.cost}</span>
            <span class="card__name">${esc(c.name)}</span>
            <span class="card__text">${esc(c.text)}</span>
          </button>`,
          )
          .join('')}
      </div>
      <button class="btn" data-action="skipReward">건너뛰기</button>
    </section>`;
}

function restScreen(game: GameState, ui: UiState): string {
  const run = game.run!;
  if (ui.restRemoving) {
    return `
      <section class="screen">
        <h2 class="heading">덱에서 뺄 카드를 고르세요</h2>
        ${deckList(run.deck, true)}
        <button class="btn" data-action="cancelRemove">그만두기</button>
      </section>`;
  }
  return `
    <section class="screen screen--center">
      <h2 class="heading">모닥불</h2>
      <p class="subtitle">체력 ${run.hp} / ${run.maxHp}</p>
      <div class="pick-row">
        <button class="pick" data-action="restHeal">
          <span class="pick__name">쉰다</span>
          <span class="pick__tagline">최대 체력의 30% 회복</span>
        </button>
        <button class="pick" data-action="restRemove">
          <span class="pick__name">덜어낸다</span>
          <span class="pick__tagline">덱에서 카드 1장 제거</span>
        </button>
      </div>
    </section>`;
}

function deckList(deck: CardDef[], clickable: boolean): string {
  const items = deck
    .map(
      (c, i) =>
        `<li><button class="deck-item" ${clickable ? `data-action="removeCard" data-index="${i}"` : 'disabled'}>
          <span>${c.cost}</span> ${esc(c.name)}
        </button></li>`,
    )
    .join('');
  return `<details class="deck" ${clickable ? 'open' : ''}>
    <summary>덱 (${deck.length}장)</summary>
    <ul class="deck__list">${items}</ul>
  </details>`;
}

function gameOverScreen(won: boolean): string {
  return `
    <section class="screen screen--center">
      <h1 class="title">${won ? '감시자를 넘어섰다' : '여기까지'}</h1>
      <button class="btn btn--primary" data-action="restart">다시 시작</button>
    </section>`;
}

function runHeader(game: GameState): string {
  const run = game.run!;
  return `
    <header class="run-header">
      <span>${esc(run.character.name)}</span>
      <span>체력 ${run.hp} / ${run.maxHp}</span>
      <span>덱 ${run.deck.length}</span>
    </header>`;
}
