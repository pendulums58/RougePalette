// ⚠️ 캐릭터 구성은 전부 플레이스홀더다.
//
// design.md에 확정된 것은 이것뿐이다:
// - 조작 캐릭터는 1명 (파티제 아님)
// - **캐릭터마다 턴 노트 수치가 다르다**
// - 자원 적립 조건은 **캐릭터마다 다르고**, 긍정/부정이 서로 다른 조건이며, 행동 기반이다
//
// 누가 등장하는지, 몇 명인지, 해금 구조는 전부 미정이다.
// 아래 둘은 "턴 노트 수치가 다른 캐릭터 둘"이라는 확정 규칙을 돌려보기 위한 더미다.

import type { CharacterDef } from '../types';

export const CHARACTERS: CharacterDef[] = [
  {
    id: 'heir',
    name: '계승자',
    tagline: '노트가 적다. 한 번에 크게 쓴다.',
    maxHp: 70,
    notes: 4,
    startingSkills: ['slash', 'guard_flat', 'heavy'],
    skillPool: ['slash', 'heavy', 'sweep', 'bulwark', 'guard_flat', 'guard_ratio'],
    // 완막으로 긍정을, 무방비로 부정을 쌓는다.
    // design.md가 예시로 든 조건 중 둘을 옮긴 것이며 확정이 아니다.
    resourceRules: [
      { polarity: 'positive', trigger: { on: 'fullyBlocked' }, amount: 1 },
      { polarity: 'negative', trigger: { on: 'tookUnguarded' }, amount: 1 },
    ],
  },
  {
    id: 'observer',
    name: '관측자',
    tagline: '노트가 많다. 잘게 나눠 쓴다.',
    maxHp: 56,
    notes: 6,
    startingSkills: ['slash', 'guard_ratio', 'pierce'],
    skillPool: ['slash', 'pierce', 'scatter', 'deflect', 'guard_flat', 'guard_ratio'],
    // 노트를 전부 쓰고 사이클을 끝내면 긍정, 무방비로 맞으면 부정.
    // 같은 세 예시 중 다른 조합이다 — "조건은 캐릭터마다 다르다"를 표현하려고.
    resourceRules: [
      { polarity: 'positive', trigger: { on: 'cycleEndedEmpty' }, amount: 1 },
      { polarity: 'negative', trigger: { on: 'tookUnguarded' }, amount: 2 },
    ],
  },
];

const BY_ID = new Map(CHARACTERS.map((c) => [c.id, c]));

export function getCharacter(id: string): CharacterDef {
  const c = BY_ID.get(id);
  if (!c) throw new Error(`unknown character id: ${id}`);
  return c;
}
