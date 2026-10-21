// 콘텐츠 레지스트리 — 적 · 스킬 · 강화 · 포션 · 이벤트를 **같은 모양으로** 정의한다.
//
// 목적: 콘텐츠를 추가·편집하기 쉽게, 그리고 **잘못 쓰면 바로 터지게** 만드는 것.
// 모든 검사는 모듈 로드 시점에 돈다. 게임을 켜자마자 알 수 있고, 빌드에서도 잡힌다.
//
// ── 새 콘텐츠를 추가하는 법 ──────────────────────
//
//   1. 배열에 객체를 하나 추가한다 (id는 그 종류 안에서 유일해야 한다)
//   2. 끝. 검사는 레지스트리가 알아서 한다
//
// ── 새 콘텐츠 *종류*를 만드는 법 ─────────────────
//
//   export interface ThingDef extends ContentEntry { ... }
//
//   const THINGS: ThingDef[] = [ ... ];
//
//   export const Things = defineRegistry('사물', THINGS, (t) => {
//     if (t.cost < 0) return '코스트는 0 이상이어야 한다';
//     return null;              // null이면 통과
//   });
//
//   export const getThing = Things.get;

/** 모든 콘텐츠가 갖는 최소 조건. id로 참조하고 상태에는 id만 저장한다. */
export interface ContentEntry {
  id: string;
  name: string;
}

/** 문제가 있으면 사람이 읽을 메시지를, 없으면 null을 돌려준다. */
export type Validator<T> = (entry: T, all: readonly T[]) => string | null;

export interface Registry<T extends ContentEntry> {
  /** 정의된 순서 그대로 */
  readonly all: readonly T[];
  /** 없으면 어떤 종류의 어떤 id인지 알려주며 던진다 */
  get(id: string): T;
  has(id: string): boolean;
  filter(fn: (entry: T) => boolean): T[];
  ids(): string[];
}

/**
 * 레지스트리를 만들면서 전부 검사한다.
 *
 * 공통으로 잡는 것:
 * - id 중복
 * - 빈 id / 빈 이름
 * 종류별 규칙은 validate로 넘긴다.
 */
export function defineRegistry<T extends ContentEntry>(
  label: string,
  entries: T[],
  validate?: Validator<T>,
): Registry<T> {
  const seen = new Set<string>();

  for (const entry of entries) {
    const where = `${label} "${entry.id || '(id 없음)'}"`;
    if (!entry.id) throw new Error(`${label}: id가 비어 있는 항목이 있다`);
    if (!entry.name) throw new Error(`${where}: name이 비어 있다`);
    if (seen.has(entry.id)) throw new Error(`${where}: id가 중복된다`);
    seen.add(entry.id);

    const problem = validate?.(entry, entries);
    if (problem) throw new Error(`${where}: ${problem}`);
  }

  const byId = new Map(entries.map((e) => [e.id, e]));

  return {
    all: entries,
    get(id: string): T {
      const entry = byId.get(id);
      if (!entry) throw new Error(`${label}: 알 수 없는 id "${id}"`);
      return entry;
    },
    has: (id: string) => byId.has(id),
    filter: (fn) => entries.filter(fn),
    ids: () => entries.map((e) => e.id),
  };
}

/**
 * 다른 레지스트리의 id를 참조하는 필드를 검사할 때 쓴다.
 * 예: 캐릭터의 skillPool이 실제 스킬을 가리키는지.
 */
export function checkRefs(
  label: string,
  ids: readonly string[],
  has: (id: string) => boolean,
): string | null {
  const missing = ids.filter((id) => !has(id));
  return missing.length ? `${label}에 없는 id: ${missing.join(', ')}` : null;
}
