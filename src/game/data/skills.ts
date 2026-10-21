// ⚠️ 스킬 내용과 수치는 플레이스홀더다. design.md의 "스킬 코스트 분포"는 미정.
//
// ── 추가하는 법 ──────────────────────────────────
//   배열에 객체 하나. 행동 스킬은 damage, 방어 스킬은 mitigation이 필요하다.
//   characterId를 빼면 공용, 넣으면 그 캐릭터 전용.
//   규칙을 어기면 게임을 켤 때 바로 터진다 (registry.ts).
//
// 틀을 돌리는 데 필요한 최소 구성만 둔다:
// - 공용 스킬 (characterId 없음) + 캐릭터 전용 스킬
// - 행동 스킬: 싼 것 / 비싼 것 / 전체 공격 → 과부하와의 상호작용을 보려고
// - 방어 스킬: 고정값 경감 / 비율 경감 → 경감 방식이 미정이라 둘 다

import type { SkillDef } from '../types';
import { defineRegistry } from './registry';

const SKILLS: SkillDef[] = [
  // ── 공용 ────────────────────────────────────
  {
    id: 'slash',
    name: '참격',
    kind: 'action',
    cost: 1,
    text: '피해 8.',
    damage: 8,
  },
  {
    id: 'guard_flat',
    name: '받아넘기기',
    kind: 'defense',
    cost: 1,
    text: '피해 8 경감 (고정값).',
    mitigation: { kind: 'flat', amount: 8 },
  },
  {
    id: 'guard_ratio',
    name: '흘리기',
    kind: 'defense',
    cost: 1,
    text: '피해 50% 경감 (비율).',
    mitigation: { kind: 'ratio', ratio: 0.5 },
  },

  // ── 계승자 전용 ─────────────────────────────
  {
    id: 'heavy',
    name: '강타',
    kind: 'action',
    cost: 2,
    text: '피해 20.',
    characterId: 'heir',
    damage: 20,
  },
  {
    id: 'sweep',
    name: '쓸어베기',
    kind: 'action',
    cost: 2,
    text: '모든 적에게 피해 10.',
    characterId: 'heir',
    damage: 10,
    hitsAll: true,
  },
  {
    id: 'bulwark',
    name: '성벽',
    kind: 'defense',
    cost: 2,
    text: '피해 18 경감 (고정값).',
    characterId: 'heir',
    mitigation: { kind: 'flat', amount: 18 },
  },

  // ── 관측자 전용 ─────────────────────────────
  {
    id: 'pierce',
    name: '꿰뚫기',
    kind: 'action',
    cost: 1,
    text: '피해 11.',
    characterId: 'observer',
    damage: 11,
  },
  {
    id: 'scatter',
    name: '산개',
    kind: 'action',
    cost: 1,
    text: '모든 적에게 피해 5.',
    characterId: 'observer',
    damage: 5,
    hitsAll: true,
  },
  {
    id: 'deflect',
    name: '비껴내기',
    kind: 'defense',
    cost: 1,
    text: '피해 70% 경감 (비율).',
    characterId: 'observer',
    mitigation: { kind: 'ratio', ratio: 0.7 },
  },
];

export const Skills = defineRegistry('스킬', SKILLS, (s) => {
  if (s.cost < 0) return 'cost는 0 이상이어야 한다';
  if (s.kind === 'action' && s.damage === undefined) return '행동 스킬에는 damage가 필요하다';
  if (s.kind === 'defense' && !s.mitigation) return '방어 스킬에는 mitigation이 필요하다';
  if (s.kind === 'defense' && s.hitsAll) return '방어 스킬에 hitsAll은 의미가 없다';
  if (s.mitigation?.kind === 'ratio' && (s.mitigation.ratio <= 0 || s.mitigation.ratio > 1))
    return 'ratio는 0 초과 1 이하여야 한다';
  return null;
});

export const getSkill = Skills.get;
export const SKILL_IDS = Skills.ids();

/** 해당 캐릭터가 쓸 수 있는 스킬 (공용 + 그 캐릭터 전용) */
export function skillsFor(characterId: string): SkillDef[] {
  return Skills.filter((s) => s.characterId === undefined || s.characterId === characterId);
}
