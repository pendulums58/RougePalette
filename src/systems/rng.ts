// 시드 기반 난수. 같은 시드 = 같은 런이라 버그 재현이 쉬워진다.
// mulberry32: 짧고 분포가 충분히 괜찮다.

export class Rng {
  private state: number;

  constructor(seed: number) {
    this.state = seed >>> 0;
  }

  /** [0, 1) */
  next(): number {
    this.state = (this.state + 0x6d2b79f5) >>> 0;
    let t = this.state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  /** [min, max] 정수 */
  int(min: number, max: number): number {
    return min + Math.floor(this.next() * (max - min + 1));
  }

  pick<T>(arr: readonly T[]): T {
    if (arr.length === 0) throw new Error('pick() on empty array');
    return arr[Math.floor(this.next() * arr.length)]!;
  }

  /** 중복 없이 n개 뽑기. n이 배열보다 크면 전부 반환. */
  sample<T>(arr: readonly T[], n: number): T[] {
    const copy = [...arr];
    this.shuffle(copy);
    return copy.slice(0, n);
  }

  /** 제자리 셔플 (Fisher–Yates) */
  shuffle<T>(arr: T[]): T[] {
    for (let i = arr.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      const a = arr[i]!;
      const b = arr[j]!;
      arr[i] = b;
      arr[j] = a;
    }
    return arr;
  }
}

export function randomSeed(): number {
  return Math.floor(Math.random() * 0xffffffff) >>> 0;
}
