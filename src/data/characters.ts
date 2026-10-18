import type { CharacterDef } from '../types';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'swordsman',
    name: '검사',
    tagline: '정직한 숫자. 힘을 쌓아 한 번에 끝낸다.',
    maxHp: 72,
    startingDeck: [
      { id: 'strike', count: 5 },
      { id: 'guard', count: 4 },
      { id: 'shield_bash', count: 1 },
    ],
    cardPool: [
      'heavy_swing',
      'double_slash',
      'war_cry',
      'shield_bash',
      'cleave',
      'second_wind',
      'execute',
    ],
  },
  {
    id: 'scholar',
    name: '학자',
    tagline: '체력은 낮지만 패가 빨리 돈다. 상태이상으로 깎는다.',
    maxHp: 58,
    startingDeck: [
      { id: 'strike', count: 4 },
      { id: 'guard', count: 4 },
      { id: 'spark', count: 1 },
      { id: 'insight', count: 1 },
    ],
    cardPool: [
      'spark',
      'insight',
      'hex',
      'ward',
      'overclock',
      'chain_bolt',
      'regeneration',
      'curse_all',
    ],
  },
];

export function getCharacter(id: string): CharacterDef {
  const c = CHARACTERS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown character id: ${id}`);
  return c;
}
