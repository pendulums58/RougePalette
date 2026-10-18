import type {
  CardDef,
  CardInstance,
  CombatState,
  Combatant,
  Effect,
  EnemyInstance,
  Intent,
  StatusKey,
  Statuses,
} from '../types';
import { getEnemy } from '../data/enemies';
import type { Rng } from './rng';

export const HAND_SIZE = 5;
export const BASE_ENERGY = 3;

/** 약화: 주는 피해 -25%. 취약: 받는 피해 +50%. */
const WEAK_MULT = 0.75;
const VULNERABLE_MULT = 1.5;

let uidCounter = 0;
function nextUid(): string {
  uidCounter += 1;
  return `c${uidCounter}`;
}

export function instantiate(def: CardDef): CardInstance {
  return { uid: nextUid(), def };
}

function status(c: Combatant, key: StatusKey): number {
  return c.statuses[key] ?? 0;
}

function addStatus(c: Combatant, key: StatusKey, amount: number): void {
  c.statuses[key] = Math.max(0, status(c, key) + amount);
}

function tickDownStatuses(s: Statuses): void {
  // 약화/취약만 턴마다 감소. 힘/재생은 유지된다.
  for (const key of ['weak', 'vulnerable'] as const) {
    const v = s[key];
    if (v && v > 0) s[key] = v - 1;
  }
}

// ── 전투 시작 ───────────────────────────────────

export function startCombat(deck: CardDef[], enemyIds: string[], hp: number, maxHp: number, rng: Rng): CombatState {
  const enemies: EnemyInstance[] = enemyIds.map((id) => {
    const def = getEnemy(id);
    return {
      defId: def.id,
      name: def.name,
      hp: def.hp,
      maxHp: def.hp,
      block: 0,
      statuses: {},
      patternIndex: 0,
      intent: def.pattern[0]!,
    };
  });

  const drawPile = rng.shuffle(deck.map(instantiate));

  const state: CombatState = {
    player: { name: '당신', hp, maxHp, block: 0, statuses: {} },
    enemies,
    energy: BASE_ENERGY,
    maxEnergy: BASE_ENERGY,
    hand: [],
    drawPile,
    discardPile: [],
    exhaustPile: [],
    turn: 1,
    outcome: null,
    log: ['전투 시작.'],
  };

  draw(state, HAND_SIZE, rng);
  return state;
}

// ── 덱 조작 ─────────────────────────────────────

export function draw(s: CombatState, n: number, rng: Rng): void {
  for (let i = 0; i < n; i++) {
    if (s.drawPile.length === 0) {
      if (s.discardPile.length === 0) break; // 뽑을 카드가 없음
      s.drawPile = rng.shuffle(s.discardPile);
      s.discardPile = [];
      s.log.push('버린 더미를 섞어 뽑을 더미로.');
    }
    const card = s.drawPile.pop();
    if (card) s.hand.push(card);
  }
}

// ── 피해 계산 ───────────────────────────────────

function outgoing(attacker: Combatant, base: number): number {
  let dmg = base + status(attacker, 'strength');
  if (status(attacker, 'weak') > 0) dmg = Math.floor(dmg * WEAK_MULT);
  return Math.max(0, dmg);
}

function dealDamage(target: Combatant, raw: number): number {
  let dmg = raw;
  if (status(target, 'vulnerable') > 0) dmg = Math.floor(dmg * VULNERABLE_MULT);

  const absorbed = Math.min(target.block, dmg);
  target.block -= absorbed;
  const through = dmg - absorbed;
  target.hp = Math.max(0, target.hp - through);
  return through;
}

// ── 카드 사용 ───────────────────────────────────

export function canPlay(s: CombatState, card: CardInstance): boolean {
  return s.outcome === null && s.energy >= card.def.cost;
}

/**
 * 카드를 사용한다. needsTarget 카드는 targetIndex가 필요하다.
 * 반환값이 false면 아무 일도 일어나지 않았다는 뜻.
 */
export function playCard(s: CombatState, uid: string, targetIndex: number | null, rng: Rng): boolean {
  if (s.outcome !== null) return false;

  const idx = s.hand.findIndex((c) => c.uid === uid);
  if (idx === -1) return false;
  const card = s.hand[idx]!;
  if (s.energy < card.def.cost) return false;

  const living = s.enemies.filter((e) => e.hp > 0);
  if (living.length === 0) return false;

  let target: EnemyInstance | null = null;
  if (card.def.needsTarget) {
    const candidate = targetIndex === null ? null : s.enemies[targetIndex];
    target = candidate && candidate.hp > 0 ? candidate : living[0]!;
  }

  s.hand.splice(idx, 1);
  s.energy -= card.def.cost;
  s.log.push(`${card.def.name} 사용.`);

  for (const effect of card.def.effects) {
    applyEffect(s, effect, target, rng);
  }

  if (card.def.exhaust) s.exhaustPile.push(card);
  else s.discardPile.push(card);

  checkOutcome(s);
  return true;
}

function applyEffect(s: CombatState, effect: Effect, target: EnemyInstance | null, rng: Rng): void {
  switch (effect.kind) {
    case 'damage': {
      const victim = target ?? s.enemies.find((e) => e.hp > 0) ?? null;
      if (!victim) return;
      const times = effect.times ?? 1;
      for (let i = 0; i < times; i++) {
        if (victim.hp <= 0) break;
        dealDamage(victim, outgoing(s.player, effect.amount));
      }
      return;
    }
    case 'damageAll': {
      for (const e of s.enemies) {
        if (e.hp > 0) dealDamage(e, outgoing(s.player, effect.amount));
      }
      return;
    }
    case 'block':
      s.player.block += effect.amount;
      return;
    case 'draw':
      draw(s, effect.amount, rng);
      return;
    case 'energy':
      s.energy += effect.amount;
      return;
    case 'heal':
      s.player.hp = Math.min(s.player.maxHp, s.player.hp + effect.amount);
      return;
    case 'status': {
      if (effect.to === 'self') {
        addStatus(s.player, effect.status, effect.amount);
      } else if (effect.to === 'allEnemies') {
        for (const e of s.enemies) if (e.hp > 0) addStatus(e, effect.status, effect.amount);
      } else {
        const victim = target ?? s.enemies.find((e) => e.hp > 0) ?? null;
        if (victim) addStatus(victim, effect.status, effect.amount);
      }
      return;
    }
  }
}

// ── 턴 진행 ─────────────────────────────────────

export function endTurn(s: CombatState, rng: Rng): void {
  if (s.outcome !== null) return;

  // 손패 전부 버리기
  s.discardPile.push(...s.hand);
  s.hand = [];
  tickDownStatuses(s.player.statuses);

  enemyTurn(s);
  checkOutcome(s);
  if (s.outcome !== null) return;

  // 새 플레이어 턴
  s.turn += 1;
  s.player.block = 0;
  s.energy = s.maxEnergy;

  const regen = status(s.player, 'regen');
  if (regen > 0) {
    s.player.hp = Math.min(s.player.maxHp, s.player.hp + regen);
    s.log.push(`재생으로 ${regen} 회복.`);
  }

  draw(s, HAND_SIZE, rng);
}

function enemyTurn(s: CombatState): void {
  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    e.block = 0;
    resolveIntent(s, e, e.intent);
    if (s.player.hp <= 0) break;
  }

  for (const e of s.enemies) {
    if (e.hp <= 0) continue;
    tickDownStatuses(e.statuses);
    advanceIntent(e);
  }
}

function resolveIntent(s: CombatState, e: EnemyInstance, intent: Intent): void {
  switch (intent.kind) {
    case 'attack': {
      const times = intent.times ?? 1;
      for (let i = 0; i < times; i++) {
        if (s.player.hp <= 0) break;
        dealDamage(s.player, outgoing(e, intent.amount));
      }
      s.log.push(`${e.name}의 공격.`);
      return;
    }
    case 'block':
      e.block += intent.amount;
      s.log.push(`${e.name}이(가) 몸을 웅크린다.`);
      return;
    case 'buff':
      if (intent.status) addStatus(e, intent.status, intent.amount);
      s.log.push(`${e.name}이(가) 강해진다.`);
      return;
    case 'debuff':
      if (intent.status) addStatus(s.player, intent.status, intent.amount);
      s.log.push(`${e.name}이(가) 당신을 약화시킨다.`);
      return;
  }
}

function advanceIntent(e: EnemyInstance): void {
  const def = getEnemy(e.defId);
  e.patternIndex = (e.patternIndex + 1) % def.pattern.length;
  e.intent = def.pattern[e.patternIndex]!;
}

function checkOutcome(s: CombatState): void {
  if (s.player.hp <= 0) {
    s.outcome = 'lose';
    s.log.push('쓰러졌다.');
  } else if (s.enemies.every((e) => e.hp <= 0)) {
    s.outcome = 'win';
    s.log.push('승리.');
  }
}
