// 계승의 장 — 전역 타입.
//
// 기준은 `.claude/rules/design.md`의 **확정** 구획이다. 미정 항목은 타입으로도
// 결정하지 않는다. 미정이라 비워 둔 자리는 주석에 그 사실을 적어 둔다.
//
// 용어: **턴** = 1회 행동 / **사이클** = 행동 가능한 전원이 행동을 끝내기까지.
//
// 상태 설계 원칙 두 가지 (이전 스캐폴딩에서 문제가 됐던 것):
//  1. 정의(Def) 객체를 상태에 품지 않는다. 상태는 **id만** 들고 조회한다.
//     -> GameState가 그대로 직렬화되므로 저장/이어하기를 붙이기 쉽다.
//  2. 화면과 그 화면에 필요한 데이터를 **판별 유니온**으로 묶는다.
//     -> `run!` 같은 비null 단정이 필요 없어진다.

export type CharacterId = string;
export type SkillId = string;
export type EnemyId = string;
export type UpgradeId = string;
export type GridLineId = string;
export type NodeId = string;

/** 강화와 자원의 두 계열. 역할 분리는 확정이다. */
export type Polarity = 'positive' | 'negative';

export type PolarityCount = Record<Polarity, number>;

export function emptyPolarityCount(): PolarityCount {
  return { positive: 0, negative: 0 };
}

// ── 스킬 ────────────────────────────────────────

/** 과부하 규칙이 이 구분에 따라 갈린다. */
export type SkillKind = 'action' | 'defense';

/**
 * 방어 스킬의 경감 방식.
 * design.md는 경감이 고정값인지 비율인지 **미정**이라고 적어 뒀다.
 * 어느 한쪽으로 정하지 않기 위해 둘 다 표현할 수 있게 둔다.
 */
export type Mitigation =
  | { kind: 'flat'; amount: number }
  | { kind: 'ratio'; ratio: number };

export interface SkillDef {
  id: SkillId;
  name: string;
  kind: SkillKind;
  /** 기본 코스트(턴 노트). 행동 스킬은 사용 시 현재 과부하만큼 증가한다. */
  cost: number;
  text: string;
  /** 공용 스킬이면 undefined, 캐릭터 전용이면 그 캐릭터 id */
  characterId?: CharacterId;
  /** 행동 스킬만 */
  damage?: number;
  /** 행동 스킬만. 모든 적을 때린다. */
  hitsAll?: boolean;
  /** 방어 스킬만 */
  mitigation?: Mitigation;
}

// ── 자원 적립 ───────────────────────────────────

/**
 * 전투 중 일어난 일. 자원 적립 조건이 이걸 보고 판정한다.
 * design.md 확정: 획득 조건은 "어떤 행동을 했느냐"에 따른다.
 */
export type CombatEvent =
  | { kind: 'action'; skillId: SkillId }
  | { kind: 'defended'; skillId: SkillId; raw: number; taken: number }
  | { kind: 'unguarded'; raw: number; taken: number }
  | { kind: 'cycleEnd'; notesLeft: number; overload: number };

/**
 * 자원 적립 조건.
 *
 * design.md **확정**: 긍정 자원과 부정 자원은 서로 다른 조건으로 쌓이고,
 * 조건은 행동 기반이며, 캐릭터마다 다르다.
 *
 * design.md **미정**: 구체적인 조건. 아래 trigger 종류는 제작자가 예시로 든 셋
 * (완막 성공 / 피해를 받음 / 노트를 0으로 만들고 사이클 종료)만 옮긴 것이며,
 * 최종 목록이 아니다.
 */
export type ResourceTrigger =
  /** 완전 방어(완막) — 경감 후 피해가 0 */
  | { on: 'fullyBlocked' }
  /** 무방비로 피해를 받음 */
  | { on: 'tookUnguarded' }
  /** 턴 노트를 0으로 만들고 사이클 종료 */
  | { on: 'cycleEndedEmpty' };

export interface ResourceRule {
  polarity: Polarity;
  trigger: ResourceTrigger;
  amount: number;
}

// ── 강화 ────────────────────────────────────────

/**
 * 강화가 바꾸는 전투 수치.
 *
 * **확정 규칙이 정의한 값만** 대상으로 둔다. 강화가 규칙 자체를 바꾸는 종류까지
 * 필요한지는 design.md에서 결론나지 않았으므로 여기서 정하지 않는다.
 * 필요해지면 이 인터페이스에 항목을 늘리는 것이 확장 지점이다.
 */
export interface CombatModifiers {
  /** 사이클당 턴 노트 가산 */
  notes: number;
  /** 행동당 과부하 증가량 (확정 기본값 1) */
  overloadPerAction: number;
  /** 무방비 배율 가산. 음수면 무방비가 덜 아프다 */
  unguardedMult: number;
  /** 행동 스킬 피해 가산 */
  damage: number;
  /** 방어 경감 가산 */
  mitigation: number;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  /** 확정: 긍정 = 순수 메리트 / 부정 = 리스크를 감안한 큰 리턴 */
  polarity: Polarity;
  /** 확정: 공용 강화와 캐릭터 전용 강화를 섞는다. undefined면 공용 */
  characterId?: CharacterId;
  /** 자원 배분으로 켤 때 드는 코스트. 0이면 자원 없이도 켤 수 있다 */
  cost: number;
  text: string;
  modifiers: Partial<CombatModifiers>;
}

/**
 * 배분 그리드의 한 라인.
 *
 * design.md **확정**: SC2 캠페인 태양 핵과 완전히 같은 구조.
 * - 같은 라인에서는 **하나만** 고를 수 있다
 * - 각 라인에서 **아무것도 안 고를 수는 없다** (항상 정확히 하나가 활성)
 *
 * 위 규칙에서 따라 나오는 제약: 자원이 0일 때도 모든 라인이 채워져야 하므로
 * **라인마다 0코스트 후보가 반드시 하나 있어야 한다.** `assertGridValid()`가 검사한다.
 *
 * 미정: 라인 수, 라인 이름, 라인당 후보 수와 코스트 티어.
 */
export interface GridLine {
  id: GridLineId;
  name: string;
  polarity: Polarity;
  /** 이 라인의 후보들. 전부 같은 계열이고, 하나는 반드시 cost 0이다. */
  candidates: UpgradeId[];
}

export interface UpgradeState {
  /** 무작위 제시로 획득한 것 (확정: 런 중 획득, 런이 끝나면 사라짐) */
  granted: UpgradeId[];
  /**
   * 라인마다 지금 켜져 있는 강화. **모든 라인에 항상 하나씩 들어 있다.**
   * 비울 수 없으므로 Record에서 키가 빠지는 일이 없다.
   *
   * 확정: 재배분(교체)이 자유롭고, 휴식 지점의 기회를 소모하지 않는다.
   * 미정: 재배분 제약(횟수/시점/비용).
   */
  allocated: Record<GridLineId, UpgradeId>;
  /**
   * 적립한 자원. 확정: 캐릭터마다 다르고, 런 한정이다.
   * 미정: 긍정/부정이 각각 별도 예산인지, 하나로 합쳐 쓰는지.
   * 지금은 둘을 따로 세되 라인의 계열에서만 차감한다.
   */
  resources: PolarityCount;
}

// ── 캐릭터 ──────────────────────────────────────

export interface CharacterDef {
  id: CharacterId;
  name: string;
  tagline: string;
  maxHp: number;
  /** 확정: 캐릭터마다 턴 노트 수치가 다르다 */
  notes: number;
  /** 시작 시 보유한 스킬 */
  startingSkills: SkillId[];
  /** 전투 보상으로 제시될 후보 */
  skillPool: SkillId[];
  /** 확정: 조건은 캐릭터마다 다르다. 구체 내용은 미정(플레이스홀더) */
  resourceRules: ResourceRule[];
  /** 배분 그리드. 라인 수와 이름은 미정이라 플레이스홀더다. */
  grid: GridLine[];
}

// ── 적 ──────────────────────────────────────────

export interface EnemyAttack {
  name: string;
  damage: number;
}

export interface EnemyDef {
  id: EnemyId;
  name: string;
  hp: number;
  /**
   * 적 턴 하나에 들어오는 공격 묶음. 사이클마다 순서대로 돌고 끝나면 처음으로.
   *
   * 이 패턴은 **플레이어에게 표시하지 않는다.** design.md: 적 행동이 플레이어
   * 행동의 함수이므로 적 의도 표시는 구조적으로 성립하지 않는다.
   *
   * 미정이라 없는 것: 적의 턴 노트와 방어. "적이 방어에 노트를 소모한다"는
   * design.md의 "검토 중인 제안(AI)" 구획에 있고 확정이 아니다.
   */
  pattern: EnemyAttack[][];
}

// ── 전투 ────────────────────────────────────────

export interface PlayerCombatState {
  hp: number;
  maxHp: number;
  /** 남은 턴 노트. 확정: 행동과 방어 양쪽에 쓰는 공용 자원 */
  notes: number;
  /** 사이클마다 이 값으로 리필된다 */
  maxNotes: number;
  /** 확정: 행동마다 누적, 사이클 종료 시 소멸 */
  overload: number;
}

export interface EnemyCombatState {
  defId: EnemyId;
  hp: number;
  maxHp: number;
  patternIndex: number;
}

/** 적 공격이 플레이어를 지정한 순간. 리액티브 방어는 여기서 결정된다. */
export interface PendingAttack {
  enemyIndex: number;
  attack: EnemyAttack;
  /** 같은 적 턴에 아직 남아 있는 공격들 */
  rest: Array<{ enemyIndex: number; attack: EnemyAttack }>;
}

export type CombatPhase = 'player' | 'defend' | 'over';

export interface CombatState {
  cycle: number;
  phase: CombatPhase;
  player: PlayerCombatState;
  enemies: EnemyCombatState[];
  /** phase === 'defend'일 때만 non-null */
  pending: PendingAttack | null;
  outcome: 'win' | 'lose' | null;
  /** 이번 전투에서 적립한 자원. 전투가 끝나면 런으로 넘어간다 */
  earned: PolarityCount;
  log: string[];
}

// ── 런 ──────────────────────────────────────────

export type NodeKind = 'combat' | 'elite' | 'rest' | 'boss' | 'shop' | 'event';

/**
 * 맵의 노드 하나.
 *
 * design.md 확정: 맵은 알고리즘으로 매 런 무작위 생성되고, STS처럼 **올라가는
 * 분기 구조가 화면에 보여야 한다.** 그래서 노드는 좌표(floor, col)와 간선(next)을
 * 들고 있다 — 층마다 독립된 선택지 목록이 아니라 진짜 그래프다.
 */
export interface MapNode {
  id: NodeId;
  kind: NodeKind;
  /** 0이 맨 아래(시작 층). 화면에서는 아래에서 위로 올라간다 */
  floor: number;
  /** 가로 위치 (0 .. width-1). 레이아웃과 생성 알고리즘이 함께 쓴다 */
  col: number;
  /** 이 노드에서 등장할 적 def id들. 휴식이면 빈 배열 */
  enemies: EnemyId[];
  /** 다음 층에서 갈 수 있는 노드들. 맨 윗층이면 빈 배열 */
  next: NodeId[];
}

export interface GameMap {
  /** 한 층의 최대 갈래 수 (미정 — 플레이스홀더) */
  width: number;
  /** 층별 노드 id. floors[0]이 시작 층 */
  floors: NodeId[][];
  nodes: Record<NodeId, MapNode>;
}

export interface RunState {
  characterId: CharacterId;
  seed: number;
  hp: number;
  maxHp: number;
  /** 보유 스킬 */
  skills: SkillId[];
  /**
   * 상점 화폐 (확정: 골드가 있다).
   *
   * 미정이라 비어 있는 것: **어떻게 버는지**(전투 보상인지 이벤트인지)와
   * **무엇을 사는지**. 그래서 지금은 늘 0이다. 임의로 드랍을 만들지 말 것.
   * 추가 화폐를 하나 더 둘지는 "미정 — 제작자 발의"다.
   */
  gold: number;
  map: GameMap;
  floorIndex: number;
  /** 마지막으로 들어간 노드. null이면 아직 시작 층을 고르지 않았다 */
  currentNodeId: NodeId | null;
  /** 이미 지나온 노드들 (화면에 경로를 보여주기 위해) */
  visited: NodeId[];
  upgrades: UpgradeState;
}

// ── 화면 ────────────────────────────────────────
//
// 화면과 그 화면이 쓰는 데이터를 같이 묶는다. 덕분에 `game.run!` 같은
// 비null 단정이 한 번도 필요하지 않다.

export type GameState =
  | { screen: 'title' }
  | { screen: 'characterSelect' }
  | { screen: 'map'; run: RunState }
  | { screen: 'combat'; run: RunState; combat: CombatState }
  | {
      screen: 'reward';
      run: RunState;
      skillChoices: SkillId[];
      /** 확정: 무작위 제시 경로로 주는 강화 후보 */
      upgradeChoices: UpgradeId[];
    }
  | { screen: 'rest'; run: RunState }
  /** 상점. 확정: 노드 종류로 둔다. 미정: 무엇을 파는지, 화폐가 무엇인지 */
  | { screen: 'shop'; run: RunState }
  /** 이벤트. 확정: 노드 종류로 둔다. 미정: 내용과 형태 */
  | { screen: 'event'; run: RunState }
  /**
   * 자원 배분 화면.
   * 확정: 배분/재배분은 휴식 지점의 기회를 소모하지 않는다. 그래서 휴식의
   * 하위 메뉴가 아니라 맵에서도 들어올 수 있는 별도 화면이다.
   */
  | { screen: 'allocate'; run: RunState; returnTo: 'map' | 'rest' }
  | { screen: 'gameOver'; run: RunState; won: boolean };

export type ScreenName = GameState['screen'];
