// 게임 전체에서 쓰는 타입 정의.
// 여기 타입만 지키면 data/ 쪽 카드·적 데이터를 마음껏 늘려도 로직은 그대로 돈다.

export type StatusKey = 'strength' | 'weak' | 'vulnerable' | 'regen';

export type Statuses = Partial<Record<StatusKey, number>>;

export type CardType = 'attack' | 'skill' | 'power';
export type Rarity = 'starter' | 'common' | 'uncommon' | 'rare';

/** 카드가 실행하는 단일 효과. 새 효과를 넣으려면 여기에 한 줄, combat.ts의 applyEffect에 한 케이스. */
export type Effect =
  | { kind: 'damage'; amount: number; times?: number }
  | { kind: 'damageAll'; amount: number }
  | { kind: 'block'; amount: number }
  | { kind: 'draw'; amount: number }
  | { kind: 'energy'; amount: number }
  | { kind: 'heal'; amount: number }
  | { kind: 'status'; status: StatusKey; amount: number; to: 'self' | 'target' | 'allEnemies' };

export interface CardDef {
  id: string;
  name: string;
  type: CardType;
  cost: number;
  rarity: Rarity;
  /** UI에 보여줄 설명. 숫자는 effects와 직접 연결돼 있지 않으니 같이 고칠 것. */
  text: string;
  /** true면 적을 지정해야 사용 가능 */
  needsTarget: boolean;
  /** 사용 후 덱에서 영구 제거(해당 전투 한정) */
  exhaust?: boolean;
  effects: Effect[];
}

/** 손패/더미에 들어가는 카드 인스턴스. 같은 카드를 여러 장 들고 있을 수 있어서 uid가 따로 있다. */
export interface CardInstance {
  uid: string;
  def: CardDef;
}

export interface CharacterDef {
  id: string;
  name: string;
  tagline: string;
  maxHp: number;
  /** 시작 덱: 카드 id와 장수 */
  startingDeck: Array<{ id: string; count: number }>;
  /** 이 캐릭터의 보상 카드 풀 */
  cardPool: string[];
}

export type IntentKind = 'attack' | 'block' | 'buff' | 'debuff';

export interface Intent {
  kind: IntentKind;
  amount: number;
  times?: number;
  status?: StatusKey;
  label: string;
}

export interface EnemyDef {
  id: string;
  name: string;
  hp: number;
  /** 턴마다 순서대로 반복되는 행동 패턴 */
  pattern: Intent[];
}

export interface Combatant {
  name: string;
  hp: number;
  maxHp: number;
  block: number;
  statuses: Statuses;
}

export interface EnemyInstance extends Combatant {
  defId: string;
  /** 패턴 내 현재 위치 */
  patternIndex: number;
  intent: Intent;
}

export interface CombatState {
  player: Combatant;
  enemies: EnemyInstance[];
  energy: number;
  maxEnergy: number;
  hand: CardInstance[];
  drawPile: CardInstance[];
  discardPile: CardInstance[];
  exhaustPile: CardInstance[];
  turn: number;
  /** null이면 전투 진행 중 */
  outcome: 'win' | 'lose' | null;
  log: string[];
}

export type NodeKind = 'combat' | 'elite' | 'rest' | 'boss';

export interface MapNode {
  id: string;
  kind: NodeKind;
  /** 이 노드에서 등장할 적 def id들 */
  enemies: string[];
}

export type Screen =
  | { name: 'title' }
  | { name: 'characterSelect' }
  | { name: 'map' }
  | { name: 'combat' }
  | { name: 'reward'; choices: CardDef[] }
  | { name: 'rest' }
  | { name: 'gameOver'; won: boolean };

export interface RunState {
  character: CharacterDef;
  deck: CardDef[];
  hp: number;
  maxHp: number;
  /** 각 층마다 고를 수 있는 노드 후보들 */
  floors: MapNode[][];
  floorIndex: number;
  currentNode: MapNode | null;
  seed: number;
}

export interface GameState {
  screen: Screen;
  run: RunState | null;
  combat: CombatState | null;
}
