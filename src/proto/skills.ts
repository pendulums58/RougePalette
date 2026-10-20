// ⚠️ 플레이스홀더. design.md의 "스킬 코스트 분포"는 미정이다.
//
// 검증 목적에 맞춰 최소 구성만 뒀다:
// - 행동 스킬 2개: 싸고 약한 것 / 비싸고 강한 것 → 과부하와의 상호작용을 보려고
// - 방어 스킬 2개: 고정값 경감 / 비율 경감 → design.md가 "고정값인지 비율인지 미정"이라 둘 다

import type { SkillDef } from './types';

export const SKILLS: SkillDef[] = [
  {
    id: 'slash',
    name: '참격',
    kind: 'action',
    cost: 1,
    text: '피해 8. 과부하가 쌓이면 급격히 비싸진다.',
    damage: 8,
  },
  {
    id: 'heavy',
    name: '강타',
    kind: 'action',
    cost: 2,
    text: '피해 20. 노트당 효율이 좋지만 한 번에 많이 쓴다.',
    damage: 20,
  },
  {
    id: 'guard_flat',
    name: '받아넘기기',
    kind: 'defense',
    cost: 1,
    text: '피해 8 경감 (고정값). 과부하 영향 없음.',
    mitigation: { kind: 'flat', amount: 8 },
  },
  {
    id: 'guard_ratio',
    name: '흘리기',
    kind: 'defense',
    cost: 1,
    text: '피해 50% 경감 (비율). 과부하 영향 없음.',
    mitigation: { kind: 'ratio', ratio: 0.5 },
  },
];

const BY_ID = new Map(SKILLS.map((s) => [s.id, s]));

export function getSkill(id: string): SkillDef {
  const s = BY_ID.get(id);
  if (!s) throw new Error(`unknown skill id: ${id}`);
  return s;
}

export const ACTION_SKILLS = SKILLS.filter((s) => s.kind === 'action');
export const DEFENSE_SKILLS = SKILLS.filter((s) => s.kind === 'defense');
