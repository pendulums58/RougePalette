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

/** 보스 전까지의 층 수. design.md: 휴식 지점 간격(n) 미정 */
export const FLOORS_BEFORE_BOSS = 7;

/** 전투 보상으로 제시할 스킬 후보 수 */
export const SKILL_CHOICES = 3;

/** 전투 보상으로 제시할 강화 후보 수 (무작위 제시 경로) */
export const UPGRADE_CHOICES = 3;

/** 휴식에서 회복하는 최대 체력 비율 */
export const REST_HEAL_RATIO = 0.3;

/**
 * 휴식 지점 간격. design.md 용어표는 휴식 지점을 "n층마다 있는 지점"이라고
 * 정의했지만 n은 미정이다.
 */
export const REST_INTERVAL = 3;
