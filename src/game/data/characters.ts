// ⚠️ 캐릭터 구성은 전부 플레이스홀더다.
//
// design.md에 확정된 것은 이것뿐이다:
// - 조작 캐릭터는 1명 (파티제 아님)
// - **캐릭터마다 턴 노트 수치가 다르다**
// - 자원 적립 조건은 **캐릭터마다 다르고**, 긍정/부정이 서로 다른 조건이며, 행동 기반이다
//
// 누가 등장하는지, 몇 명인지, 해금 구조는 전부 미정이다.
// 아래 둘은 "턴 노트 수치가 다른 캐릭터 둘"이라는 확정 규칙을 돌려보기 위한 더미다.
//
// ── 추가하는 법 ──────────────────────────────────
//   배열에 객체 하나. startingSkills/skillPool은 실제 스킬 id여야 하고,
//   resourceRules에는 긍정·부정이 둘 다 있어야 하며, grid는 buildGrid()로 만든다.
//   어기면 게임을 켤 때 바로 터진다.

import type { CharacterDef } from '../types';
import { assertGridValid, buildGrid } from './upgrades';
import { Skills } from './skills';
import { checkRefs, defineRegistry } from './registry';

const CHARACTERS: CharacterDef[] = [
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
    grid: buildGrid('heir'),
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
    grid: buildGrid('observer'),
  },
];

export const Characters = defineRegistry('캐릭터', CHARACTERS, (c) => {
  if (c.maxHp <= 0) return 'maxHp는 1 이상이어야 한다';
  if (c.notes < 1) return 'notes는 1 이상이어야 한다 (확정: 캐릭터마다 다른 턴 노트 수치)';
  if (c.startingSkills.length === 0) return 'startingSkills가 비어 있다';
  if (c.skillPool.length === 0) return 'skillPool이 비어 있다';
  if (c.resourceRules.length === 0) return 'resourceRules가 비어 있다';

  const bad =
    checkRefs('startingSkills', c.startingSkills, Skills.has) ??
    checkRefs('skillPool', c.skillPool, Skills.has);
  if (bad) return bad;

  // 확정: 긍정 자원과 부정 자원은 서로 다른 조건으로 쌓인다
  const polarities = new Set(c.resourceRules.map((r) => r.polarity));
  if (polarities.size < 2) return '긍정/부정 자원 적립 조건이 둘 다 있어야 한다 (확정 규칙)';

  // 그리드 규칙 (라인마다 0코스트 후보 하나, 후보 계열이 라인과 일치)
  try {
    assertGridValid(c.grid);
  } catch (e) {
    return (e as Error).message;
  }
  return null;
});

export const getCharacter = Characters.get;
export const CHARACTER_IDS = Characters.ids();
