// ProtoState -> HTML 문자열. DOM 이벤트는 main의 위임 핸들러가 처리한다.
// CLAUDE.md 아키텍처 규칙: 렌더는 전체 다시 그리기, 이벤트는 위임만.

import type { ProtoState } from './types';
import { mitigatedDamage, skillCost, unguardedDamage } from './combat';
import { ACTION_SKILLS, DEFENSE_SKILLS } from './skills';

function esc(s: string): string {
  return s.replace(/[&<>"]/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[ch]!);
}

export function render(s: ProtoState): string {
  return `
    <section class="screen">
      <header class="run-header">
        <span>계승의 장 · 턴 노트 검증</span>
        <span>${s.cycle}사이클</span>
        <span>노트 ${s.player.notes} / ${s.player.maxNotes}</span>
        <span>과부하 ${s.player.overload}</span>
      </header>

      ${bars(s)}
      ${body(s)}

      <p class="log">${esc(s.log.slice(-4).join(' '))}</p>
      ${footer()}
    </section>`;
}

function bars(s: ProtoState): string {
  const php = Math.round((s.player.hp / s.player.maxHp) * 100);
  const ehp = Math.round((s.enemy.hp / s.enemy.maxHp) * 100);
  return `
    <div class="piles">
      <span>${esc(s.enemy.name)}</span>
    </div>
    <div class="hp">
      <div class="hp__fill" style="width:${ehp}%"></div>
      <span class="hp__text">${s.enemy.hp} / ${s.enemy.maxHp}</span>
    </div>
    <div class="piles">
      <span>나</span>
    </div>
    <div class="hp">
      <div class="hp__fill" style="width:${php}%"></div>
      <span class="hp__text">${s.player.hp} / ${s.player.maxHp}</span>
    </div>`;
}

function body(s: ProtoState): string {
  if (s.phase === 'over') {
    return `
      <h2 class="heading">${s.outcome === 'win' ? '승리' : '패배'}</h2>
      <button class="btn btn--primary" data-action="restart">다시</button>`;
  }
  if (s.phase === 'defend' && s.pending) return defendView(s);
  return playerView(s);
}

// ── 플레이어 턴 ─────────────────────────────────

function playerView(s: ProtoState): string {
  const buttons = ACTION_SKILLS.map((sk) => {
    const cost = skillCost(s, sk);
    const ok = s.player.notes >= cost;
    return `
      <button class="pick" data-action="useAction" data-id="${esc(sk.id)}" ${ok ? '' : 'disabled'}>
        <span class="pick__name">${esc(sk.name)} · 노트 ${cost}</span>
        <span class="pick__tagline">${esc(sk.text)}</span>
      </button>`;
  }).join('');

  return `
    <h2 class="heading">내 턴</h2>
    <div class="statuses">
      <span class="chip">행동 스킬 코스트 = 기본 + 과부하 ${s.player.overload}</span>
      <span class="chip">방어 스킬은 과부하 영향 없음</span>
    </div>
    <div class="pick-row">${buttons}</div>
    <button class="btn btn--primary" data-action="endTurn">턴 종료 (노트 ${s.player.notes} 남김)</button>`;
}

// ── 리액티브 방어 ───────────────────────────────

function defendView(s: ProtoState): string {
  const { attack, rest } = s.pending!;
  const raw = attack.damage;

  const options = DEFENSE_SKILLS.map((sk) => {
    const cost = skillCost(s, sk);
    const ok = s.player.notes >= cost;
    const after = mitigatedDamage(raw, sk.mitigation!);
    return `
      <button class="pick" data-action="defend" data-id="${esc(sk.id)}" ${ok ? '' : 'disabled'}>
        <span class="pick__name">${esc(sk.name)} · 노트 ${cost}</span>
        <span class="pick__tagline">받는 피해 ${after}${ok ? '' : ' · 노트 부족'}</span>
      </button>`;
  }).join('');

  return `
    <h2 class="heading">${esc(attack.name)} — 피해 ${raw}</h2>
    <div class="statuses">
      <span class="chip">남은 노트 ${s.player.notes}</span>
      ${rest.length > 0 ? `<span class="chip">이 턴에 남은 공격 ${rest.length}회</span>` : ''}
    </div>
    <div class="pick-row">
      ${options}
      <button class="pick" data-action="defend" data-id="">
        <span class="pick__name">방어 안 함 · 노트 0</span>
        <span class="pick__tagline">받는 피해 ${unguardedDamage(raw)} (무방비)</span>
      </button>
    </div>`;
}

// ── 안내 ────────────────────────────────────────

function footer(): string {
  return `
    <details class="deck">
      <summary>이 프로토타입은 무엇인가</summary>
      <div class="deck__list">
        <p class="subtitle">
          design.md "방어 선택의 깊이" 1번 질문 — <strong>"방어 안 함"이 유효한 선택이 되어야 하는가</strong> —
          를 직접 굴려보기 위한 검증용 샌드박스다.
        </p>
        <p class="subtitle">
          구현된 것은 확정 규칙 네 개뿐이다: 턴 노트(사이클마다 리필, 행동·방어 공용),
          과부하(행동마다 +1, 방어는 면제, 사이클 종료 시 소멸), 리액티브 방어, 진영 단위 턴 순서.
        </p>
        <p class="subtitle">
          <strong>모든 수치는 플레이스홀더다.</strong> 설계 결정이 아니며 <code>src/proto/tuning.ts</code>에 모여 있다.
          적의 턴 노트·방어, 안티스톨, 강화 레이어, 다이스·역공·속성은 미정이라 구현하지 않았다.
        </p>
      </div>
    </details>`;
}
