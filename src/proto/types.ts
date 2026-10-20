// 턴 노트 전투 프로토타입의 타입.
// `design.md`의 **확정** 구획만 반영한다. 미정 항목은 구현하지 않는다.
//
// 용어 (design.md 용어표):
//   턴    = 1회 행동. 캐릭터 한 명이 스킬 하나를 사용하는 단위
//   사이클 = 행동 가능한 모든 캐릭터가 각자의 행동을 종료하기까지

/** 행동 스킬 / 방어 스킬. 과부하 규칙이 이 구분에 따라 갈린다. */
export type SkillKind = 'action' | 'defense';

/** 방어 스킬의 경감 방식. 고정값인지 비율인지는 design.md에서 미정이라 둘 다 둔다. */
export type Mitigation =
  | { kind: 'flat'; amount: number }
  | { kind: 'ratio'; ratio: number };

export interface SkillDef {
  id: string;
  name: string;
  kind: SkillKind;
  /** 기본 코스트(턴 노트). 행동 스킬은 사용 시 현재 과부하만큼 증가한다. */
  cost: number;
  text: string;
  /** 행동 스킬만 */
  damage?: number;
  /** 방어 스킬만 */
  mitigation?: Mitigation;
}

export interface EnemyAttack {
  name: string;
  damage: number;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /**
   * 적 턴 하나당 수행하는 공격 묶음. 사이클마다 순서대로 돌고 끝나면 처음으로 돌아간다.
   *
   * 주의: 이 패턴은 **플레이어에게 표시하지 않는다.** design.md는 적 의도 표시가
   * 이 시스템에서 구조적으로 성립하지 않는다고 못박았다.
   */
  pattern: EnemyAttack[][];
}

export interface PlayerState {
  hp: number;
  maxHp: number;
  /** 남은 턴 노트. 행동과 방어 양쪽에 쓰는 공용 자원이다. */
  notes: number;
  /** 사이클마다 이 값으로 리필된다. */
  maxNotes: number;
  /** 사이클 중 행동할 때마다 1씩. 사이클 종료 시 0으로 돌아간다. */
  overload: number;
}

export interface EnemyState {
  defId: string;
  name: string;
  hp: number;
  maxHp: number;
  patternIndex: number;
}

/** 적 공격이 플레이어를 지정한 순간. 리액티브 방어는 여기서 결정된다. */
export interface PendingAttack {
  attack: EnemyAttack;
  /** 이 공격 이후 같은 적 턴에 남아 있는 공격들 */
  rest: EnemyAttack[];
}

export type Phase = 'player' | 'defend' | 'over';

export interface ProtoState {
  cycle: number;
  phase: Phase;
  player: PlayerState;
  enemy: EnemyState;
  /** phase === 'defend'일 때만 non-null */
  pending: PendingAttack | null;
  outcome: 'win' | 'lose' | null;
  log: string[];
}
