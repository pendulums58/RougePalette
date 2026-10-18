import type { CardDef, CharacterDef, MapNode, NodeKind, RunState } from '../types';
import { getCard } from '../data/cards';
import { Rng } from './rng';

/** 보스 전까지의 층 수. 늘리면 런이 길어진다. */
export const FLOORS_BEFORE_BOSS = 7;

const NORMAL_POOLS: string[][] = [
  ['slime'],
  ['rat', 'rat'],
  ['slime', 'rat'],
  ['sentinel'],
];

const ELITE_POOLS: string[][] = [['brute'], ['sentinel', 'rat'], ['brute', 'rat']];

export function buildDeck(character: CharacterDef): CardDef[] {
  const deck: CardDef[] = [];
  for (const entry of character.startingDeck) {
    for (let i = 0; i < entry.count; i++) deck.push(getCard(entry.id));
  }
  return deck;
}

/**
 * 층별로 2개(또는 1개)의 노드 후보를 만든다.
 * 분기는 전부 다음 층으로 합류하는 느슨한 구조 — 맵 그래프를 제대로 만들 거면 여기를 갈아끼우면 된다.
 */
export function generateFloors(rng: Rng): MapNode[][] {
  const floors: MapNode[][] = [];

  for (let i = 0; i < FLOORS_BEFORE_BOSS; i++) {
    const options: MapNode[] = [];
    const count = i === 0 ? 1 : 2;

    for (let j = 0; j < count; j++) {
      const kind = pickKind(i, rng, options.map((o) => o.kind));
      options.push({
        id: `f${i}-${j}`,
        kind,
        enemies: kind === 'rest' ? [] : rng.pick(kind === 'elite' ? ELITE_POOLS : NORMAL_POOLS),
      });
    }
    floors.push(options);
  }

  floors.push([{ id: 'boss', kind: 'boss', enemies: ['warden'] }]);
  return floors;
}

function pickKind(floorIndex: number, rng: Rng, taken: NodeKind[]): NodeKind {
  // 1층은 무조건 평범한 전투로 시작
  if (floorIndex === 0) return 'combat';

  const roll = rng.next();
  let kind: NodeKind;
  if (floorIndex >= 3 && roll < 0.25) kind = 'elite';
  else if (roll < 0.45) kind = 'rest';
  else kind = 'combat';

  // 같은 층에 휴식만 두 개 뜨는 건 막는다
  if (kind === 'rest' && taken.includes('rest')) kind = 'combat';
  return kind;
}

export function startRun(character: CharacterDef, seed: number): RunState {
  const rng = new Rng(seed);
  return {
    character,
    deck: buildDeck(character),
    hp: character.maxHp,
    maxHp: character.maxHp,
    floors: generateFloors(rng),
    floorIndex: 0,
    currentNode: null,
    seed,
  };
}

/** 전투 보상으로 제시할 카드 3장. */
export function rollReward(run: RunState, rng: Rng): CardDef[] {
  return rng.sample(run.character.cardPool, 3).map(getCard);
}

export function isLastFloor(run: RunState): boolean {
  return run.floorIndex >= run.floors.length - 1;
}
