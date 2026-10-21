// GameState -> HTML 문자열. DOM 이벤트는 main의 위임 핸들러가 처리한다.
// CLAUDE.md 아키텍처 규칙: 렌더는 전체 다시 그리기, 이벤트는 위임만.

import type { CombatState, GameState, MapNode, RunState, SkillId } from '../types';
import { nodeAt, reachable, totalFloors } from '../systems/map';
import { CHARACTERS, getCharacter } from '../data/characters';
import { getEnemy } from '../data/enemies';
import { getSkill } from '../data/skills';
import { getUpgrade } from '../data/upgrades';
import { canUse, livingEnemies, mitigatedDamage, skillCost, unguardedDamage } from '../systems/combat';
import { activeUpgrades, modifiersFor, selectionRefusal, swapCost } from '../systems/upgrades';

/** 렌더링에만 쓰이는, 저장할 필요 없는 상태. */
export interface UiState {
  /** 대상을 고르는 중인 행동 스킬 */
  pendingSkillId: SkillId | null;
}

const NODE_LABEL: Record<MapNode['kind'], string> = {
  combat: '전투',
  elite: '정예',
  rest: '휴식 지점',
  boss: '보스',
  shop: '상점',
  event: '이벤트',
};

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

export function render(game: GameState, ui: UiState): string {
  switch (game.screen) {
    case 'title':
      return titleScreen();
    case 'characterSelect':
      return characterSelect();
    case 'map':
      return mapScreen(game.run);
    case 'combat':
      return combatScreen(game.run, game.combat, ui);
    case 'reward':
      return rewardScreen(game.run, game.skillChoices, game.upgradeChoices);
    case 'rest':
      return restScreen(game.run);
    case 'shop':
      return stubScreen(
        game.run,
        '상점',
        `화폐가 골드라는 것은 확정이지만, 재고가 무엇인지와 골드를 어떻게 버는지는 아직 정해지지 않았다. (보유 ${game.run.gold} 골드)`,
      );
    case 'event':
      return stubScreen(
        game.run,
        '이벤트',
        '텍스트 조우로 만드는 쪽으로 기울어 있으나 확정이 아니다. 내용과 선택지는 정해지지 않았다.',
      );
    case 'allocate':
      return allocateScreen(game.run);
    case 'gameOver':
      return gameOverScreen(game.run, game.won);
  }
}

// ── 공통 ────────────────────────────────────────

function runHeader(run: RunState): string {
  const c = getCharacter(run.characterId);
  const r = run.upgrades.resources;
  return `
    <header class="run-header">
      <span>${esc(c.name)}</span>
      <span>체력 ${run.hp} / ${run.maxHp}</span>
      <span>노트 ${c.notes + modifiersFor(run).notes}</span>
      <span>골드 ${run.gold}</span>
      <span>긍정 ${r.positive} · 부정 ${r.negative}</span>
    </header>`;
}

function hpBar(hp: number, maxHp: number, label: string): string {
  const pct = maxHp > 0 ? Math.max(0, Math.round((hp / maxHp) * 100)) : 0;
  return `
    <div class="hp">
      <div class="hp__fill" style="width:${pct}%"></div>
      <span class="hp__text">${esc(label)} ${hp} / ${maxHp}</span>
    </div>`;
}

function activeUpgradeChips(run: RunState): string {
  const ids = activeUpgrades(run);
  if (ids.length === 0) return '<div class="statuses"><span class="chip">강화 없음</span></div>';
  return `<div class="statuses">${ids
    .map((id) => {
      const u = getUpgrade(id);
      return `<span class="chip">${u.polarity === 'positive' ? '＋' : '－'} ${esc(u.name)}</span>`;
    })
    .join('')}</div>`;
}

function skillList(run: RunState): string {
  const counted = new Map<SkillId, number>();
  for (const id of run.skills) counted.set(id, (counted.get(id) ?? 0) + 1);
  const items = [...counted]
    .map(([id, n]) => {
      const s = getSkill(id);
      return `<li><button class="deck-item" disabled>
        <span>${s.cost}</span> ${esc(s.name)}${n > 1 ? ` ×${n}` : ''} · ${esc(s.text)}
      </button></li>`;
    })
    .join('');
  return `<details class="deck">
    <summary>보유 스킬 (${run.skills.length})</summary>
    <ul class="deck__list">${items}</ul>
  </details>`;
}

// ── 화면들 ──────────────────────────────────────

function titleScreen(): string {
  return `
    <section class="screen screen--center">
      <h1 class="title">계승의 장</h1>
      <p class="subtitle">턴 노트 · 과부하 · 리액티브 방어 — 구현 틀</p>
      <button class="btn btn--primary" data-action="toCharacterSelect">시작</button>
    </section>`;
}

function characterSelect(): string {
  const picks = CHARACTERS.map(
    (c) => `
      <button class="pick" data-action="chooseCharacter" data-id="${esc(c.id)}">
        <span class="pick__name">${esc(c.name)}</span>
        <span class="pick__hp">체력 ${c.maxHp} · 턴 노트 ${c.notes}</span>
        <span class="pick__tagline">${esc(c.tagline)}</span>
      </button>`,
  ).join('');

  return `
    <section class="screen screen--center">
      <h2 class="heading">누구로 내려갈까</h2>
      <div class="pick-row">${picks}</div>
    </section>`;
}

const ROW_H = 68;

function mapScreen(run: RunState): string {
  const open = new Set(reachable(run.map, run.floorIndex, run.currentNodeId));
  const visited = new Set(run.visited);
  const floors = run.map.floors.length;
  const w = run.map.width;

  // 좌표: floor 0이 맨 아래. SVG는 viewBox를 (폭 × 층수)로 두고 비율로 늘린다.
  const vx = (col: number) => col + 0.5;
  const vy = (floor: number) => floors - floor - 0.5;

  const edges = Object.values(run.map.nodes)
    .flatMap((n) =>
      n.next.map((id) => {
        const to = nodeAt(run.map, id);
        const lit = visited.has(n.id) && (open.has(id) || visited.has(id));
        return `<line class="map__edge ${lit ? 'map__edge--open' : ''}"
          x1="${vx(n.col)}" y1="${vy(n.floor)}" x2="${vx(to.col)}" y2="${vy(to.floor)}"
          vector-effect="non-scaling-stroke" />`;
      }),
    )
    .join('');

  const nodes = Object.values(run.map.nodes)
    .map((n) => {
      const isOpen = open.has(n.id);
      const state = isOpen ? 'mapnode--open' : visited.has(n.id) ? 'mapnode--visited' : '';
      const detail = n.enemies.length ? esc(enemyNames(n)) : '';
      return `
      <button class="mapnode mapnode--${n.kind} ${state}"
        style="left:${((n.col + 0.5) / w) * 100}%;bottom:${((n.floor + 0.5) / floors) * 100}%"
        data-action="enterNode" data-id="${esc(n.id)}" ${isOpen ? '' : 'disabled'}>
        <span class="mapnode__kind">${NODE_LABEL[n.kind]}</span>
        <span class="mapnode__detail">${detail}</span>
      </button>`;
    })
    .join('');

  return `
    <section class="screen">
      ${runHeader(run)}
      <h2 class="heading">${run.floorIndex + 1}층 / ${totalFloors()}층</h2>
      <div class="map" style="height:${floors * ROW_H}px">
        <svg class="map__edges" viewBox="0 0 ${w} ${floors}" preserveAspectRatio="none">${edges}</svg>
        ${nodes}
      </div>
      ${activeUpgradeChips(run)}
      <button class="btn" data-action="toAllocate" data-from="map">자원 배분</button>
      ${skillList(run)}
    </section>`;
}

function enemyNames(n: MapNode): string {
  const counted = new Map<string, number>();
  for (const id of n.enemies) counted.set(id, (counted.get(id) ?? 0) + 1);
  return [...counted].map(([id, c]) => (c > 1 ? `${getEnemy(id).name}×${c}` : getEnemy(id).name)).join(',');
}

// ── 전투 ────────────────────────────────────────

function combatScreen(run: RunState, s: CombatState, ui: UiState): string {
  return `
    <section class="screen screen--combat">
      ${runHeader(run)}
      <div class="piles">
        <span>${s.cycle}사이클</span>
        <span>노트 ${s.player.notes} / ${s.player.maxNotes}</span>
        <span>과부하 ${s.player.overload}</span>
        <span>번 자원 ＋${s.earned.positive} －${s.earned.negative}</span>
      </div>

      <div class="enemies">${s.enemies.map((e, i) => enemyView(s, e, i, ui)).join('')}</div>
      ${hpBar(s.player.hp, s.player.maxHp, '나')}

      ${s.phase === 'defend' ? defendView(run, s) : playerView(run, s, ui)}

      <p class="log">${esc(s.log.slice(-4).join(' '))}</p>
    </section>`;
}

function enemyView(s: CombatState, e: CombatState['enemies'][number], i: number, ui: UiState): string {
  const name = getEnemy(e.defId).name;
  if (e.hp <= 0) {
    return `<div class="enemy enemy--dead"><span class="enemy__name">${esc(name)}</span><span>쓰러짐</span></div>`;
  }
  const targeting = ui.pendingSkillId !== null && s.phase === 'player';
  return `
    <button class="enemy" data-action="pickTarget" data-index="${i}" ${targeting ? '' : 'disabled'}>
      <span class="enemy__name">${esc(name)}</span>
      ${hpBar(e.hp, e.maxHp, '')}
    </button>`;
}

function playerView(run: RunState, s: CombatState, ui: UiState): string {
  const mods = modifiersFor(run);
  const actions = uniqueSkills(run, 'action')
    .map((id) => {
      const sk = getSkill(id);
      const cost = skillCost(s, sk);
      const ok = canUse(s, sk);
      const selected = ui.pendingSkillId === id;
      const dmg = Math.max(0, (sk.damage ?? 0) + mods.damage);
      return `
      <button class="pick ${selected ? 'card--selected' : ''}" data-action="selectSkill" data-id="${esc(id)}" ${ok ? '' : 'disabled'}>
        <span class="pick__name">${esc(sk.name)} · 노트 ${cost}</span>
        <span class="pick__tagline">피해 ${dmg}${sk.hitsAll ? ' (전체)' : ''}${ok ? '' : ' · 노트 부족'}</span>
      </button>`;
    })
    .join('');

  const hint =
    ui.pendingSkillId !== null && livingEnemies(s).length > 1
      ? '<span class="chip">대상을 고르세요</span>'
      : `<span class="chip">행동 코스트 = 기본 + 과부하 ${s.player.overload}</span>`;

  return `
    <h2 class="heading">내 턴</h2>
    <div class="statuses">${hint}<span class="chip">방어 스킬은 과부하 영향 없음</span></div>
    <div class="pick-row">${actions}</div>
    <button class="btn btn--primary" data-action="endTurn">턴 종료 (노트 ${s.player.notes} 남김)</button>`;
}

function defendView(run: RunState, s: CombatState): string {
  const mods = modifiersFor(run);
  const { attack, enemyIndex, rest } = s.pending!;
  const enemyName = getEnemy(s.enemies[enemyIndex]!.defId).name;
  const raw = attack.damage;

  const options = uniqueSkills(run, 'defense')
    .map((id) => {
      const sk = getSkill(id);
      const cost = skillCost(s, sk);
      const ok = canUse(s, sk);
      const after = mitigatedDamage(raw, sk.mitigation!, mods.mitigation);
      return `
      <button class="pick" data-action="defend" data-id="${esc(id)}" ${ok ? '' : 'disabled'}>
        <span class="pick__name">${esc(sk.name)} · 노트 ${cost}</span>
        <span class="pick__tagline">받는 피해 ${after}${ok ? '' : ' · 노트 부족'}</span>
      </button>`;
    })
    .join('');

  return `
    <h2 class="heading">${esc(enemyName)}의 ${esc(attack.name)} — 피해 ${raw}</h2>
    <div class="statuses">
      <span class="chip">남은 노트 ${s.player.notes}</span>
      ${rest.length > 0 ? `<span class="chip">이 턴에 남은 공격 ${rest.length}회</span>` : ''}
    </div>
    <div class="pick-row">
      ${options}
      <button class="pick" data-action="defend" data-id="">
        <span class="pick__name">방어 안 함 · 노트 0</span>
        <span class="pick__tagline">받는 피해 ${unguardedDamage(raw, mods)} (무방비)</span>
      </button>
    </div>`;
}

function uniqueSkills(run: RunState, kind: 'action' | 'defense'): SkillId[] {
  return [...new Set(run.skills)].filter((id) => getSkill(id).kind === kind);
}

// ── 보상 ────────────────────────────────────────

function rewardScreen(run: RunState, skills: SkillId[], upgrades: string[]): string {
  const skillCards = skills
    .map((id) => {
      const s = getSkill(id);
      return `
      <button class="card card--${s.kind === 'action' ? 'attack' : 'skill'}" data-action="takeSkill" data-id="${esc(id)}">
        <span class="card__cost">${s.cost}</span>
        <span class="card__name">${esc(s.name)}</span>
        <span class="card__text">${esc(s.text)}</span>
      </button>`;
    })
    .join('');

  const upgradeCards = upgrades
    .map((id) => {
      const u = getUpgrade(id);
      return `
      <button class="card card--${u.polarity === 'positive' ? 'power' : 'attack'}" data-action="takeUpgrade" data-id="${esc(id)}">
        <span class="card__cost">${u.polarity === 'positive' ? '＋' : '－'}</span>
        <span class="card__name">${esc(u.name)}</span>
        <span class="card__text">${esc(u.text)}</span>
      </button>`;
    })
    .join('');

  return `
    <section class="screen">
      ${runHeader(run)}
      <h2 class="heading">스킬 하나</h2>
      <div class="reward-row">${skillCards}</div>
      ${
        upgrades.length > 0
          ? `<h2 class="heading">또는 강화 하나</h2><div class="reward-row">${upgradeCards}</div>`
          : ''
      }
      <button class="btn" data-action="skipReward">건너뛰기</button>
    </section>`;
}

// ── 휴식 ────────────────────────────────────────

function restScreen(run: RunState): string {
  return `
    <section class="screen screen--center">
      ${runHeader(run)}
      <h2 class="heading">휴식 지점</h2>
      <div class="pick-row">
        <button class="pick" data-action="restHeal">
          <span class="pick__name">쉰다</span>
          <span class="pick__tagline">최대 체력의 30% 회복</span>
        </button>
      </div>
      <p class="subtitle">
        다른 선택지는 design.md에서 미정이다. 자원 배분은 이 기회를 소모하지 않는다.
      </p>
      <button class="btn" data-action="toAllocate" data-from="rest">자원 배분</button>
    </section>`;
}

/**
 * 내용이 미정인 노드의 자리표시 화면.
 * design.md 확정: 상점과 이벤트는 노드 종류로 둔다. 내용은 미정이라 비워 둔다.
 * 임의로 상점 경제나 이벤트 텍스트를 지어내지 말 것.
 */
function stubScreen(run: RunState, title: string, note: string): string {
  return `
    <section class="screen screen--center">
      ${runHeader(run)}
      <h2 class="heading">${esc(title)}</h2>
      <p class="subtitle">${esc(note)}</p>
      <p class="subtitle">노드 종류로 둔다는 것만 확정이다.</p>
      <button class="btn btn--primary" data-action="leaveStub">지나간다</button>
    </section>`;
}

// ── 자원 배분 ───────────────────────────────────

function allocateScreen(run: RunState): string {
  const r = run.upgrades.resources;
  const grid = getCharacter(run.characterId).grid;

  const lines = grid
    .map((line) => {
      const label = line.polarity === 'positive' ? '긍정' : '부정';
      const cards = line.candidates
        .map((id) => {
          const u = getUpgrade(id);
          const on = run.upgrades.allocated[line.id] === id;
          const refusal = selectionRefusal(run, line, id);
          const diff = swapCost(run, line, id);
          const note = on
            ? '켜짐'
            : refusal === 'insufficient'
              ? `자원 ${diff} 필요`
              : diff > 0
                ? `자원 ${diff}`
                : diff < 0
                  ? `${-diff} 환급`
                  : '교체 무료';
          return `
          <button class="pick ${on ? 'card--selected' : ''}"
            data-action="selectInLine" data-line="${esc(line.id)}" data-id="${esc(id)}"
            ${on || refusal === null ? '' : 'disabled'}>
            <span class="pick__name">${esc(u.name)} · ${u.cost}</span>
            <span class="pick__tagline">${esc(u.text)}</span>
            <span class="pick__note">${note}</span>
          </button>`;
        })
        .join('');

      return `
      <div class="grid-line">
        <h3 class="grid-line__name">${esc(line.name)} · ${label}</h3>
        <div class="grid-line__row">${cards}</div>
      </div>`;
    })
    .join('');

  return `
    <section class="screen">
      ${runHeader(run)}
      <h2 class="heading">자원 배분</h2>
      <div class="statuses">
        <span class="chip">긍정 ${r.positive}</span>
        <span class="chip">부정 ${r.negative}</span>
        <span class="chip">라인마다 하나 · 비울 수 없음</span>
        <span class="chip">재배분 자유 · 차액만 오감</span>
      </div>
      ${lines}
      <p class="subtitle">
        라인 수 · 이름 · 코스트 티어는 아직 미정이다. 구조(라인별 택1, 비울 수 없음)만 확정.
      </p>
      <button class="btn btn--primary" data-action="leaveAllocate">돌아가기</button>
    </section>`;
}

// ── 종료 ────────────────────────────────────────

function gameOverScreen(run: RunState, won: boolean): string {
  return `
    <section class="screen screen--center">
      <h1 class="title">${won ? '감시자를 넘어섰다' : '여기까지'}</h1>
      <p class="subtitle">${run.floorIndex + 1}층까지 · 강화 ${activeUpgrades(run).length}개</p>
      <button class="btn btn--primary" data-action="restart">다시 시작</button>
    </section>`;
}
