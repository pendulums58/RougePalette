// 검증 스위트 실행기.
//
// 각 *.ts를 esbuild로 번들해 node로 돌린다. 스위트는 FAIL을 찍고 0이 아닌 코드로
// 끝나므로, 하나라도 실패하면 이 스크립트도 실패한다.
//
//   npm run verify            전부
//   npm run verify -- counter 이름이 맞는 것만
//
// 왜 vitest가 아닌가: 러너를 하나 더 들이지 않으려고. 스위트가 그냥 스크립트라
// 실패하면 왜 실패했는지가 got/want로 바로 보인다. 필요해지면 갈아끼우면 된다.

import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const filter = process.argv.slice(2);
const suites = readdirSync(here)
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.replace(/\.ts$/, ''))
  .filter((n) => filter.length === 0 || filter.some((f) => n.includes(f)))
  .sort();

if (suites.length === 0) {
  console.error(filter.length ? `맞는 스위트가 없다: ${filter.join(', ')}` : '스위트가 없다');
  process.exit(1);
}

const out = mkdtempSync(join(tmpdir(), 'verify-'));
let failed = 0;

for (const name of suites) {
  // 캐시를 쓰지 않는다 — 옛 번들이 돌아서 "가짜 통과"가 나온 적이 있다
  await build({
    entryPoints: [join(here, `${name}.ts`)],
    outfile: join(out, `${name}.cjs`),
    bundle: true,
    platform: 'node',
    format: 'cjs',
    logLevel: 'error',
  });

  try {
    execFileSync(process.execPath, [join(out, `${name}.cjs`)], { stdio: 'pipe' });
    console.log(`통과   ${name}`);
  } catch (e) {
    failed += 1;
    console.log(`실패   ${name}`);
    const text = `${e.stdout ?? ''}${e.stderr ?? ''}`;
    for (const line of text.split('\n').filter((l) => l.startsWith('FAIL'))) console.log(`       ${line}`);
    if (!text.includes('FAIL')) console.log(text.split('\n').slice(0, 6).map((l) => `       ${l}`).join('\n'));
  }
}

console.log(failed === 0 ? `\n${suites.length}종 전부 통과` : `\n${failed}종 실패`);
process.exit(failed === 0 ? 0 : 1);
