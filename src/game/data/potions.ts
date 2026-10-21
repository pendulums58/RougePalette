// 포션 — 일정 층 동안 지속되는 스택형 버프. (design.md 확정)
//
// ⚠️ 종류·효과·지속 층수·가격은 전부 플레이스홀더다.
//    design.md "포션 — 미해결 부분" 참조.
//
// ── 추가하는 법 ──────────────────────────────────
//   아래 배열에 객체 하나 추가하면 끝이다. id는 유일해야 하고,
//   floors >= 1, price >= 0, modifiers가 비어 있지 않아야 한다.
//   어기면 게임을 켤 때 바로 터진다 (registry.ts).
//
//   { id: 'x', name: '이름', text: '설명', floors: 3, price: 40,
//     modifiers: { damage: 3 } }

import type { PotionDef } from '../types';
import { defineRegistry } from './registry';

const POTIONS: PotionDef[] = [
  {
    id: 'brew_edge',
    name: '날선 물약',
    text: '행동 스킬 피해 +4.',
    floors: 3,
    price: 35,
    modifiers: { damage: 4 },
  },
  {
    id: 'brew_hide',
    name: '굳은살 물약',
    text: '방어 경감 +4.',
    floors: 3,
    price: 35,
    modifiers: { mitigation: 4 },
  },
  {
    id: 'brew_breath',
    name: '긴숨 물약',
    text: '사이클당 턴 노트 +1.',
    floors: 2,
    price: 50,
    modifiers: { notes: 1 },
  },
  {
    id: 'brew_guard',
    name: '방패 물약',
    text: '무방비로 받는 피해가 줄어든다.',
    floors: 4,
    price: 30,
    modifiers: { unguardedMult: -0.25 },
  },
  {
    // 훅(반응)을 쓰는 예. 값 질의로는 표현할 수 없는 효과다.
    id: 'brew_echo',
    name: '메아리 물약',
    text: '피해를 받을 때마다 쌓이고, 2번 쌓이면 사이클 끝에 노트 1을 돌려준다.',
    floors: 3,
    price: 45,
    modifiers: {},
    hooks: {
      onDamaged(api) {
        api.addStack('echo', 1);
      },
      onCycleEnd(api) {
        if (api.getStack('echo') >= 2) {
          api.addStack('echo', -api.getStack('echo'));
          api.refundNotes(1);
          api.log('메아리가 노트 1을 돌려준다.');
        }
      },
    },
  },
  {
    id: 'brew_surge',
    name: '격류 물약',
    text: '피해 +8. 짧게 간다.',
    floors: 1,
    price: 40,
    modifiers: { damage: 8 },
  },
];

export const Potions = defineRegistry('포션', POTIONS, (p) => {
  if (p.floors < 1) return 'floors는 1 이상이어야 한다 (최소 한 층은 지속)';
  if (p.price < 0) return 'price는 0 이상이어야 한다';
  if (Object.keys(p.modifiers).length === 0 && !p.hooks && !p.multipliers && !p.meta && !p.rules)
    return 'modifiers / multipliers / meta / hooks / rules 중 아무것도 없다 — 효과가 없는 포션';
  return null;
});

export const getPotion = Potions.get;
export const POTION_IDS = Potions.ids();
