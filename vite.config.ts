import { defineConfig } from 'vite';
import { resolve } from 'node:path';

export default defineConfig({
  // './' 로 두면 GitHub Pages의 프로젝트 사이트(user.github.io/repo/)에서도
  // 레포 이름을 하드코딩하지 않고 그대로 동작한다. 라우터를 붙이게 되면
  // base를 '/<repo-name>/' 로 바꿔야 한다.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
    rollupOptions: {
      input: {
        // 본 게임 — 턴 노트 전투
        index: resolve(__dirname, 'index.html'),
        // 폐기 예정 카드 스캐폴딩. 지워도 되면 이 줄과 legacy.html, src/{main,types}.ts,
        // src/{data,systems,ui}/ 를 같이 지운다.
        legacy: resolve(__dirname, 'legacy.html'),
      },
    },
  },
});
