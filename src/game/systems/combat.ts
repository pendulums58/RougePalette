// 턴 노트 전투. DOM을 건드리지 않는다 (CLAUDE.md 아키텍처 규칙).
//
// design.md **확정** 규칙만 구현한다:
// - 턴 노트: 매 사이클 리필, 행동과 방어의 공용 자원, 남아 있는 한 여러 번 행동
// - 과부하: 사이클 중 행동마다 누적, 행동 스킬 코스트에 가산,
//           방어 스킬은 쌓지도 받지도 않음, 사이클 종료 시 소멸
// - 방어: 리액티브. 적 공격이 지정하는 그 순간 방어 스킬 / 무방비 택1
// - 턴 순서: 진영 단위 (자신 턴 종료 -> 적 턴)
// - 전투 내부에 무작위 요소는 없다
//
// 효과는 두 종류로 나뉜다 (types.ts 참조):
//   값 질의 -> deps.mods (CombatModifiers)
//   반응   -> fire(...)로 훅 발화. 아래 ★ 표시가 훅 지점이다
//
// 미정이라 구현하지 않은 것은 파일 하단 참조.

import type {
  CharacterDef,
  CounterTrigger,
  CombatEvent,
  CombatModifiers,
  CombatState,
  EnemyAttack,
  EnemyId,
  Mitigation,
  RunState,
  SkillDef,
} from '../types';
import { emptyPolarityCount } from '../types';
import { getEnemy } from '../data/enemies';
import { getCharacter } from '../data/characters';
import { awardResources } from './upgrades';
import { modifiersFor } from './modifiers';
import { fire } from './hooks';
import { resolveRule } from './rules';
import { checkCounter } from './counter';

/**
 * 전투 로직이 필요로 하는 것들. 인자를 길게 늘어놓는 대신 하나로 묶는다.
 * mods는 전투 중에 바뀌지 않는다 (확정: 포션·강화는 전투 시작 시 적용).
 */
export interface CombatDeps {
  run: RunState;
  character: CharacterDef;
  mods: CombatModifiers;
}

export function depsFor(run: RunState): CombatDeps {
  return { run, character: getCharacter(run.characterId), mods: modifiersFor(run) };
}

// ── 코스트 ──────────────────────────────────────

/**
 * 스킬의 실제 코스트. **규칙 가로채기 지점이다.**
 *
 * 기본 규칙(확정): 행동 스킬은 현재 과부하만큼 증가한다 (1코스트 연속 사용 -> 1, 2, 3 ...).
 *                 방어 스킬은 과부하의 영향을 **전혀** 받지 않는다.
 * 효과가 rules.skillCost로 이 계산을 통째로 바꿀 수 있다.
 */
export function skillCost(s: CombatState, skill: SkillDef, deps: CombatDeps): number {
  return resolveRule(deps.run, s, deps.mods, 'skillCost', { skill }, () =>
    skill.kind === 'defense' ? skill.cost : skill.cost + s.player.overload,
  );
}

export function canUse(s: CombatState, skill: SkillDef, deps: CombatDeps): boolean {
  return s.player.notes >= skillCost(s, skill, deps);
}

// ── 피해 ────────────────────────────────────────

export function mitigatedDamage(raw: number, m: Mitigation, bonus: number): number {
  const base = m.kind === 'flat' ? raw - m.amount : raw * (1 - m.ratio);
  return Math.max(0, Math.round(base - bonus));
}

export function unguardedDamage(raw: number, mods: CombatModifiers): number {
  return Math.round(raw * mods.unguardedMult);
}

/**
 * 실제로 받는 피해. **규칙 가로채기 지점이다.**
 * 기본 규칙: 방어 스킬을 썼으면 경감, 안 썼으면 무방비 배율.
 */
export function damageTaken(
  s: CombatState,
  raw: number,
  skill: SkillDef | null,
  deps: CombatDeps,
): number {
  return resolveRule(deps.run, s, deps.mods, 'damageTaken', { raw, skill }, () =>
    skill?.mitigation
      ? mitigatedDamage(raw, skill.mitigation, deps.mods.mitigation)
      : unguardedDamage(raw, deps.mods),
  );
}

// ── 전투 시작 ───────────────────────────────────

export function startCombat(enemyIds: EnemyId[], hp: number, maxHp: number, deps: CombatDeps): CombatState {
  const maxNotes = Math.max(1, deps.character.notes + deps.mods.notes);
  const s: CombatState = {
    cycle: 1,
    phase: 'player',
    player: { hp, maxHp, notes: maxNotes, maxNotes, overload: 0 },
    enemies: enemyIds.map((id) => {
      const def = getEnemy(id);
      return { defId: def.id, hp: def.hp, maxHp: def.hp, patternIndex: 0 };
    }),
    pending: null,
    outcome: null,
    earned: emptyPolarityCount(),
    stacks: {},
    log: ['1사이클 시작.'],
  };

  fire(deps.run, s, deps.mods, 'onCombatStart', {}); // ★
  fire(deps.run, s, deps.mods, 'onCycleStart', { cycle: 1 }); // ★
  return s;
}

// ── 플레이어 턴 ─────────────────────────────────

/**
 * 행동 스킬 사용. targetIndex는 단일 대상 스킬에만 쓰인다.
 * 반환값 false면 아무 일도 일어나지 않았다.
 */
export function useAction(
  s: CombatState,
  skill: SkillDef,
  targetIndex: number,
  deps: CombatDeps,
): boolean {
  if (s.phase !== 'player' || skill.kind !== 'action' || !canUse(s, skill, deps)) return false;

  const living = livingEnemies(s);
  if (living.length === 0) return false;

  const cost = skillCost(s, skill, deps);
  s.player.notes -= cost;

  const dmg = Math.max(0, (skill.damage ?? 0) + deps.mods.damage);
  const targets = skill.hitsAll ? living : [living.includes(targetIndex) ? targetIndex : living[0]!];
  const defeated: number[] = [];
  for (const i of targets) {
    const e = s.enemies[i]!;
    e.hp = Math.max(0, e.hp - dmg);
    if (e.hp <= 0) defeated.push(i);
  }
  s.log.push(`${skill.name} (노트 ${cost}) → 피해 ${dmg}${skill.hitsAll ? ' (전체)' : ''}.`);

  // 확정: 사이클 중 행동할 때마다 과부하가 쌓인다. **규칙 가로채기 지점.**
  s.player.overload += resolveRule(
    deps.run, s, deps.mods, 'overloadGain', { skill }, () => deps.mods.overloadPerAction,
  );

  emit(s, { kind: 'action', skillId: skill.id }, deps.character);
  fire(deps.run, s, deps.mods, 'onAction', { skillId: skill.id, cost, damageDealt: dmg * targets.length }); // ★
  for (const enemyIndex of defeated) {
    fire(deps.run, s, deps.mods, 'onEnemyDefeated', { enemyIndex }); // ★
  }

  checkOutcome(s);

  // 확정: 역공. 플레이어 행동 직후가 주요 판정 시점이다 (무지성 공격에 리스크).
  if (s.outcome === null && s.phase === 'player') {
    const hit = findCounter(
      s, deps,
      { at: 'afterPlayerAction', skillId: skill.id, cost, damageDealt: dmg * targets.length },
      livingEnemies(s),
    );
    if (hit) {
      s.log.push(`${getEnemy(s.enemies[hit.index]!.defId).name}의 역공! (${hit.source})`);
      s.pending = { enemyIndex: hit.index, attack: hit.attack, rest: [], counter: true };
      s.phase = 'defend';
    }
  }
  return true;
}

/** 턴 종료 -> 적 턴. 확정: 진영 단위 */
export function endPlayerTurn(s: CombatState, deps: CombatDeps): void {
  if (s.phase !== 'player') return;

  const queue: Array<{ enemyIndex: number; attack: EnemyAttack }> = [];
  s.enemies.forEach((e, i) => {
    if (e.hp <= 0) return;
    const def = getEnemy(e.defId);
    for (const attack of def.pattern[e.patternIndex] ?? []) queue.push({ enemyIndex: i, attack });
  });

  s.log.push('턴 종료. 적 턴.');
  presentNext(s, queue, deps);
}

// ── 적 턴 / 리액티브 방어 ───────────────────────

function presentNext(
  s: CombatState,
  queue: Array<{ enemyIndex: number; attack: EnemyAttack }>,
  deps: CombatDeps,
): void {
  // 이미 쓰러진 적의 공격은 건너뛴다
  const next = queue.findIndex((q) => s.enemies[q.enemyIndex]!.hp > 0);
  if (next === -1) {
    endCycle(s, deps);
    return;
  }
  const head = queue[next]!;
  s.pending = { enemyIndex: head.enemyIndex, attack: head.attack, rest: queue.slice(next + 1) };
  s.phase = 'defend';
}

/**
 * 리액티브 방어 결정.
 * @param skill 방어 스킬, 또는 null(= 방어 안 함 선언 -> 무방비)
 */
export function resolveDefense(s: CombatState, skill: SkillDef | null, deps: CombatDeps): boolean {
  if (s.phase !== 'defend' || !s.pending) return false;

  const { attack, enemyIndex, rest } = s.pending;
  const wasCounter = s.pending.counter === true;
  const enemyName = getEnemy(s.enemies[enemyIndex]!.defId).name;
  let taken: number;
  let event: CombatEvent;

  if (skill === null) {
    taken = damageTaken(s, attack.damage, null, deps);
    event = { kind: 'unguarded', raw: attack.damage, taken };
    s.log.push(`${enemyName}의 ${attack.name} · 무방비 → 피해 ${taken}.`);
  } else {
    if (skill.kind !== 'defense' || !skill.mitigation || !canUse(s, skill, deps)) return false;
    const cost = skillCost(s, skill, deps);
    s.player.notes -= cost;
    taken = damageTaken(s, attack.damage, skill, deps);
    event = { kind: 'defended', skillId: skill.id, raw: attack.damage, taken };
    s.log.push(`${enemyName}의 ${attack.name} · ${skill.name} (노트 ${cost}) → 피해 ${taken}.`);
  }

  s.player.hp = Math.max(0, s.player.hp - taken);
  s.pending = null;
  emit(s, event, deps.character);

  fire(deps.run, s, deps.mods, 'onDefend', { skillId: skill?.id ?? null, raw: attack.damage, taken }); // ★
  if (taken > 0) fire(deps.run, s, deps.mods, 'onDamaged', { amount: taken }); // ★

  if (s.player.hp <= 0) {
    s.outcome = 'lose';
    s.phase = 'over';
    s.log.push('쓰러졌다.');
    return true;
  }

  // 역공으로 끼어든 공격이었다면 사이클을 끝내지 않고 **플레이어 턴으로 돌아간다.**
  // 역공 중에 또 역공이 터지는지는 미정이라 지금은 막아 두었다.
  if (wasCounter) {
    s.phase = 'player';
    s.log.push('역공을 넘겼다. 다시 내 턴.');
    return true;
  }

  // 적 턴 중이었다면: 여기서도 역공이 터질 수 있다.
  // 이때는 턴을 뺏는 게 아니라 남은 큐 앞에 공격 하나가 더 끼어든다.
  const hit = findCounter(
    s, deps,
    { at: 'afterPlayerDefend', skillId: skill?.id ?? null, raw: attack.damage, taken },
    [enemyIndex],
  );
  if (hit) {
    s.log.push(`${enemyName}의 역공! (${hit.source})`);
    presentNext(s, [{ enemyIndex: hit.index, attack: hit.attack }, ...rest], deps);
    return true;
  }

  presentNext(s, rest, deps);
  return true;
}

// ── 역공 ────────────────────────────────────────
//
// design.md 확정: 역공을 쓴다. 특정 조건에서 몬스터가 일시적으로 턴을 뺏는다.
//
// ⚠️ **역공이 정확히 무엇을 하는가는 미정이다.** 아래는 가장 작은 구현 —
//    해당 적이 자기 패턴의 첫 공격을 즉시 한 번 하고, 플레이어는 평소처럼
//    리액티브 방어로 대응한다. "턴을 통째로 가져간다" 같은 다른 해석으로
//    바꾸려면 counterAttackOf()와 아래 두 호출부만 고치면 된다.

/** 역공으로 들어올 공격. 플레이스홀더: 그 적 패턴의 첫 공격. */
function counterAttackOf(s: CombatState, enemyIndex: number): EnemyAttack | null {
  const e = s.enemies[enemyIndex];
  if (!e || e.hp <= 0) return null;
  const def = getEnemy(e.defId);
  return (def.pattern[e.patternIndex] ?? [])[0] ?? null;
}

/** 후보 중 역공이 터지는 첫 적을 찾는다. 한 번에 하나만 터진다 (중첩 미정). */
function findCounter(
  s: CombatState,
  deps: CombatDeps,
  trigger: CounterTrigger,
  candidates: number[],
): { index: number; source: string; attack: EnemyAttack } | null {
  for (const i of candidates) {
    const source = checkCounter(deps.run, s, deps.mods, deps.character, i, trigger);
    if (!source) continue;
    const attack = counterAttackOf(s, i);
    if (attack) return { index: i, source, attack };
  }
  return null;
}

// ── 사이클 종료 ─────────────────────────────────

function endCycle(s: CombatState, deps: CombatDeps): void {
  emit(s, { kind: 'cycleEnd', notesLeft: s.player.notes, overload: s.player.overload }, deps.character);
  fire(deps.run, s, deps.mods, 'onCycleEnd', {
    cycle: s.cycle,
    notesLeft: s.player.notes,
    overload: s.player.overload,
  }); // ★

  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    const len = getEnemy(e.defId).pattern.length;
    if (len > 0) e.patternIndex = (e.patternIndex + 1) % len;
  }

  s.cycle += 1;
  // 확정: 턴 노트는 매 사이클 리필 / 과부하는 사이클 종료 시 소멸
  // 둘 다 **규칙 가로채기 지점**이다.
  const carried = s.player.notes;
  s.player.notes = resolveRule(
    deps.run, s, deps.mods, 'notesOnCycleStart',
    { maxNotes: s.player.maxNotes, carried },
    () => s.player.maxNotes,
  );
  s.player.overload = resolveRule(
    deps.run, s, deps.mods, 'overloadOnCycleEnd', { current: s.player.overload }, () => 0,
  );
  s.pending = null;
  s.phase = 'player';
  s.log.push(`${s.cycle}사이클 시작. 노트 리필, 과부하 초기화.`);

  fire(deps.run, s, deps.mods, 'onCycleStart', { cycle: s.cycle }); // ★
}

// ── 공통 ────────────────────────────────────────

function emit(s: CombatState, event: CombatEvent, character: CharacterDef): void {
  awardResources(character, event, s.earned);
}

function checkOutcome(s: CombatState): void {
  if (s.enemies.every((e) => e.hp <= 0)) {
    s.outcome = 'win';
    s.phase = 'over';
    s.log.push('승리.');
  }
}

export function livingEnemies(s: CombatState): number[] {
  return s.enemies.map((_, i) => i).filter((i) => s.enemies[i]!.hp > 0);
}

// ── 미정이라 구현하지 않은 것 ───────────────────
//
// - **적의 턴 노트와 방어.** "플레이어가 공격하면 적이 방어에 노트를 소모한다"는
//   관찰은 design.md의 "검토 중인 제안(AI)" 구획에 있고 확정이 아니다.
//   적은 공격만 한다.
// - **안티스톨** (사이클이 길어질수록 적이 강해지는 방식). 제작자가 기울어
//   있으나 방식과 수치가 미정. onCycleStart 훅이 그 자리다.
// - **방어 스킬을 미리 세팅하는 방식.** "방어 선택의 깊이" 2번 질문과 연동되어
//   미정. 지금은 매 공격마다 전체에서 고르는 쪽으로만 만들었다.
// - **역공의 내용.** 역공을 쓴다는 것은 확정이지만, 조건이 어디에 붙는가
//   (몹마다 / 캐릭터마다 / 둘 다)와 구체적인 조건, 역공이 정확히 무엇을
//   하는가는 미정이다. 판정 자리와 끼어드는 흐름만 열어 두었다.
// - **다이스 / 속성.** "미정 — 제작자 발의". 펌블 조건은 다이스에 의존한다.
// - **상태이상(stacks의 내용물).** 그릇만 있고 비어 있다. 어떤 상태이상이
//   있는지는 design.md에 한 줄도 없다.
