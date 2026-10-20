// 턴 노트 + 과부하 + 리액티브 방어 전투 로직.
// DOM을 건드리지 않는다 (CLAUDE.md 아키텍처 규칙).
//
// design.md **확정** 구획만 구현한다. 구현하지 않은 것과 그 이유는 파일 하단 참조.

import type { EnemyAttack, EnemyDef, Mitigation, ProtoState, SkillDef } from './types';
import { PLAYER_HP, PLAYER_NOTES, UNGUARDED_MULT } from './tuning';

// ── 코스트 ──────────────────────────────────────

/**
 * 스킬의 실제 코스트.
 *
 * design.md 확정:
 * - 행동 스킬의 코스트가 현재 과부하만큼 증가한다 (1코스트 연속 사용 → 1, 2, 3 ...)
 * - 방어 스킬은 과부하의 영향을 전혀 받지 않는다 (과부하가 100이어도 1코스트는 1)
 */
export function skillCost(s: ProtoState, skill: SkillDef): number {
  if (skill.kind === 'defense') return skill.cost;
  return skill.cost + s.player.overload;
}

export function canUse(s: ProtoState, skill: SkillDef): boolean {
  return s.player.notes >= skillCost(s, skill);
}

// ── 피해 ────────────────────────────────────────

/** 방어 스킬을 썼을 때 실제로 받는 피해. */
export function mitigatedDamage(raw: number, m: Mitigation): number {
  if (m.kind === 'flat') return Math.max(0, raw - m.amount);
  return Math.max(0, Math.round(raw * (1 - m.ratio)));
}

/** 방어 안 함(무방비)일 때 받는 피해. */
export function unguardedDamage(raw: number): number {
  return Math.round(raw * UNGUARDED_MULT);
}

// ── 전투 시작 ───────────────────────────────────

export function startCombat(enemy: EnemyDef): ProtoState {
  return {
    cycle: 1,
    phase: 'player',
    player: {
      hp: PLAYER_HP,
      maxHp: PLAYER_HP,
      notes: PLAYER_NOTES,
      maxNotes: PLAYER_NOTES,
      overload: 0,
    },
    enemy: {
      defId: enemy.id,
      name: enemy.name,
      hp: enemy.hp,
      maxHp: enemy.hp,
      patternIndex: 0,
    },
    pending: null,
    outcome: null,
    log: ['1사이클 시작.'],
  };
}

// ── 플레이어 턴 ─────────────────────────────────

/** 행동 스킬 사용. 반환값 false면 아무 일도 일어나지 않았다. */
export function useAction(s: ProtoState, skill: SkillDef): boolean {
  if (s.phase !== 'player') return false;
  if (skill.kind !== 'action') return false;
  if (!canUse(s, skill)) return false;

  const cost = skillCost(s, skill);
  s.player.notes -= cost;

  if (skill.damage) {
    s.enemy.hp = Math.max(0, s.enemy.hp - skill.damage);
    s.log.push(`${skill.name} (노트 ${cost}) → 피해 ${skill.damage}.`);
  } else {
    s.log.push(`${skill.name} (노트 ${cost}).`);
  }

  // design.md 확정: 사이클 중 행동할 때마다 과부하가 1씩 쌓인다
  s.player.overload += 1;

  if (s.enemy.hp <= 0) {
    s.outcome = 'win';
    s.phase = 'over';
    s.log.push(`${s.enemy.name} 쓰러짐. 승리.`);
  }
  return true;
}

/** 턴 종료 → 적 턴으로. design.md 확정: 진영 단위 (자신 턴 종료 → 적 턴) */
export function endPlayerTurn(s: ProtoState): void {
  if (s.phase !== 'player') return;

  const def = getPattern(s);
  const queue = def.length > 0 ? [...def] : [];
  s.log.push('턴 종료. 적 턴.');
  presentNext(s, queue);
}

// ── 적 턴 / 리액티브 방어 ───────────────────────

function presentNext(s: ProtoState, queue: EnemyAttack[]): void {
  if (queue.length === 0) {
    endCycle(s);
    return;
  }
  const [next, ...rest] = queue;
  s.pending = { attack: next!, rest };
  s.phase = 'defend';
}

/**
 * 리액티브 방어 결정.
 *
 * design.md 확정: 적의 공격 스킬이 플레이어를 지정하는 그 순간, 다음 중 하나를 택한다.
 * - 방어 스킬 사용 → 피해 일정량 경감 (턴 노트를 소모한다)
 * - 방어 안 함 선언 → 무방비. 더 큰 피해를 받는다
 *
 * @param skill 방어 스킬, 또는 null(= 방어 안 함 선언)
 */
export function resolveDefense(s: ProtoState, skill: SkillDef | null): boolean {
  if (s.phase !== 'defend' || !s.pending) return false;

  const { attack, rest } = s.pending;
  let taken: number;

  if (skill === null) {
    taken = unguardedDamage(attack.damage);
    s.log.push(`${attack.name} 무방비 → 피해 ${taken}.`);
  } else {
    if (skill.kind !== 'defense' || !skill.mitigation) return false;
    if (!canUse(s, skill)) return false;

    const cost = skillCost(s, skill);
    s.player.notes -= cost;
    taken = mitigatedDamage(attack.damage, skill.mitigation);
    s.log.push(`${attack.name} → ${skill.name} (노트 ${cost}) → 피해 ${taken}.`);
  }

  s.player.hp = Math.max(0, s.player.hp - taken);
  s.pending = null;

  if (s.player.hp <= 0) {
    s.outcome = 'lose';
    s.phase = 'over';
    s.log.push('쓰러졌다.');
    return true;
  }

  presentNext(s, rest);
  return true;
}

// ── 사이클 종료 ─────────────────────────────────

function endCycle(s: ProtoState): void {
  const def = getPatternLength(s);
  if (def > 0) s.enemy.patternIndex = (s.enemy.patternIndex + 1) % def;

  s.cycle += 1;

  // design.md 확정: 턴 노트는 매 사이클 리필된다 / 과부하는 사이클 종료 시 사라진다
  s.player.notes = s.player.maxNotes;
  s.player.overload = 0;

  s.pending = null;
  s.phase = 'player';
  s.log.push(`${s.cycle}사이클 시작. 노트 리필, 과부하 초기화.`);
}

// ── 적 패턴 조회 ────────────────────────────────
//
// 패턴 정의를 상태에 복사해 두지 않고 id로 조회한다 (스캐폴딩의 CardInstance가
// def 객체를 품어서 생긴 문제를 반복하지 않기 위함).

let enemyLookup: (id: string) => EnemyDef = () => {
  throw new Error('setEnemyLookup()을 먼저 호출할 것');
};

export function setEnemyLookup(fn: (id: string) => EnemyDef): void {
  enemyLookup = fn;
}

function getPattern(s: ProtoState): EnemyAttack[] {
  const def = enemyLookup(s.enemy.defId);
  return def.pattern[s.enemy.patternIndex] ?? [];
}

function getPatternLength(s: ProtoState): number {
  return enemyLookup(s.enemy.defId).pattern.length;
}

// ── 의도적으로 구현하지 않은 것 ─────────────────
//
// 아래는 design.md에서 **미정**이라 손대지 않았다. 임의로 메꾸면 안 되는 항목들이다.
//
// - 적의 턴 노트 / 적 방어: "적이 방어에 노트를 소모한다"는 관찰은 design.md의
//   "검토 중인 제안(AI)" 구획에 있다. 확정이 아니므로 적은 공격만 한다.
// - 안티스톨 (사이클이 길어질수록 적이 강해지는 방식): 미정
// - 강화 레이어 전체: 자원 획득 조건과 배분 그리드 구조가 미정
// - 다이스 / 역공 / 속성: 미정 — 제작자 발의
// - 방어 스킬을 미리 세팅하는 방식: "방어 선택의 깊이" 2번 질문과 연동되어 미정.
//   지금은 매 공격마다 전체에서 고르는 쪽으로만 만들어 뒀다. 1번 질문의 답이
//   나오면 이쪽도 결정된다.
