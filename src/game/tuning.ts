// ⚠️ 이 파일의 수치는 전부 플레이스홀더다. 설계 결정이 아니다.
//
// `design.md`의 "수치 전반"은 **전부 미정**이다 — 캐릭터별 턴 노트 기본값,
// 스킬 코스트 분포, 무방비 배율, 방어 경감량, 적 체력·공격력, 휴식 지점 간격.
// 여기 값은 틀을 돌려보기 위해 임의로 넣은 것이며 제작자가 정한 값이 아니다.
//
// 확정되면 `design.md`로 옮기고 이 경고를 지운다. 그때까지 근거로 삼지 말 것.

/** 무방비 배율. 방어 스킬을 쓰지 않았을 때 받는 피해 = 원래 피해 × 이 값 */
export const UNGUARDED_MULT = 1.5;

/** 확정 규칙: 사이클 중 행동할 때마다 과부하가 1씩 쌓인다. */
export const OVERLOAD_PER_ACTION = 1;

// ── 맵 ──────────────────────────────────────────
//
// design.md 확정: n층마다 휴식 확정 / n층마다 보스 확정. 알고리즘 기반 무작위 생성.
// 아래 n 값들과 폭·갈래 수는 전부 미정이다.

/** 휴식 지점이 확정으로 등장하는 간격. 제작자 발의: 난이도마다 다르게 할 수도 있다 */
export const REST_EVERY = 3;

/** 보스가 확정으로 등장하는 간격 */
export const BOSS_EVERY = 8;

/** 보스를 몇 번 지나면 런이 끝나는가. 1막/2막/3막 구조를 쓸지는 미정 */
export const BOSS_COUNT = 2;

/** 한 층의 최대 갈래 수 */
export const MAP_WIDTH = 5;

/** 생성 시 바닥에서 꼭대기까지 긋는 경로 수. 많을수록 맵이 빽빽해진다 */
export const MAP_PATHS = 6;

/** 전투 보상으로 제시할 스킬 후보 수 */
export const SKILL_CHOICES = 3;

/** 전투 보상으로 제시할 강화 후보 수 (무작위 제시 경로) */
export const UPGRADE_CHOICES = 3;

/** 휴식에서 회복하는 최대 체력 비율 */
export const REST_HEAL_RATIO = 0.3;

// ── 골드 ────────────────────────────────────────
//
// design.md 확정: 골드는 전투 보상과 이벤트에서 얻고, 정예·보스가 더 준다.
// STS 레퍼런스를 그대로 따른다.
//
// ⚠️ 아래 수치는 **STS의 값을 그대로 옮긴 것**이다. 이 게임은 런 길이와 전투 수가
//    다르므로 재조정이 필요할 수 있다. design.md: "골드의 획득량과 가격대" 미정.

export const GOLD_COMBAT: [number, number] = [10, 20];
export const GOLD_ELITE: [number, number] = [25, 35];
export const GOLD_BOSS: [number, number] = [95, 105];

// ── 상점 ────────────────────────────────────────
//
// design.md 확정: 상점은 스킬을 판다. (그것만 확정)
// ⚠️ 재고 수와 가격대는 플레이스홀더다.

export const SHOP_SKILL_STOCK = 3;
export const SHOP_POTION_STOCK = 2;
export const SHOP_SKILL_PRICE: [number, number] = [45, 80];
