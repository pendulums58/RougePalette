// GameState -> HTML 문자열. DOM 이벤트는 main의 위임 핸들러가 처리한다.
// CLAUDE.md 아키텍처 규칙: 렌더는 전체 다시 그리기, 이벤트는 위임만.

import type { CombatState, GameState, MapNode, RunState, SkillId } from '../types';
import { CHARACTERS, getCharacter } from '../data/characters';
import { getEnemy } from '../data/enemies';
import { getSkill } from '../data/skills';
import { getUpgrade, upgradesFor } from '../data/upgrades';
import { canUse, livingEnemies, mitigatedDamage, skillCost, unguardedDamage } from '../systems/combat';
import { activeUpgrades, allocationRefusal, modifiersFor } from '../systems/upgrades';

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

function mapScreen(run: RunState): string {
  const options = run.floors[run.floorIndex] ?? [];
  const nodes = options
    .map(
      (n) => `
      <button class="node node--${n.kind}" data-action="enterNode" data-id="${esc(n.id)}">
        <span class="node__kind">${NODE_LABEL[n.kind]}</span>
        <span class="node__detail">${n.enemies.length ? esc(enemyNames(n)) : '숨을 고른다'}</span>
      </button>`,
    )
    .join('');

  return `
    <section class="screen">
      ${runHeader(run)}
      <h2 class="heading">${run.floorIndex + 1}층 / ${run.floors.length}층</h2>
      <div class="node-row">${nodes}</div>
      ${activeUpgradeChips(run)}
      <button class="btn" data-action="toAllocate" data-from="map">자원 배분</button>
      ${skillList(run)}
    </section>`;
}

function enemyNames(n: MapNode): string {
  const counted = new Map<string, number>();
  for (const id of n.enemies) counted.set(id, (counted.get(id) ?? 0) + 1);
  return [...counted].map(([id, c]) => (c > 1 ? `${getEnemy(id).name} ×${c}` : getEnemy(id).name)).join(', ');
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

// ── 자원 배분 ───────────────────────────────────

function allocateScreen(run: RunState): string {
  const r = run.upgrades.resources;

  const rows = upgradesFor(run.characterId)
    .map((u) => {
      const on = run.upgrades.allocated.includes(u.id);
      const granted = run.upgrades.granted.includes(u.id);
      const refusal = allocationRefusal(run, u.id);
      const label = u.polarity === 'positive' ? '긍정' : '부정';

      if (granted) {
        return `
        <button class="pick" disabled>
          <span class="pick__name">${esc(u.name)} · ${label}</span>
          <span class="pick__tagline">${esc(u.text)} · 이미 획득함</span>
        </button>`;
      }
      return `
      <button class="pick ${on ? 'card--selected' : ''}" data-action="${on ? 'deallocate' : 'allocate'}" data-id="${esc(u.id)}"
        ${on || refusal === null ? '' : 'disabled'}>
        <span class="pick__name">${esc(u.name)} · ${label} ${u.cost}</span>
        <span class="pick__tagline">${esc(u.text)}${on ? ' · 켜짐 (누르면 환급)' : refusal === 'insufficient' ? ' · 자원 부족' : ''}</span>
      </button>`;
    })
    .join('');

  return `
    <section class="screen">
      ${runHeader(run)}
      <h2 class="heading">자원 배분</h2>
      <div class="statuses">
        <span class="chip">긍정 ${r.positive}</span>
        <span class="chip">부정 ${r.negative}</span>
        <span class="chip">재배분 자유 · 전액 환급</span>
      </div>
      <div class="pick-row">${rows}</div>
      <p class="subtitle">
        ⚠️ 배분 그리드의 구조(슬롯별 택1인지, 슬롯 수)는 design.md에서 미정이라
        지금은 구조 없는 목록이다.
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
