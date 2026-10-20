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
        // index: 폐기 예정 스캐폴딩 (카드/손패 프로토타입)
        index: resolve(__dirname, 'index.html'),
        // proto: 턴 노트 전투 검증용 샌드박스. /proto.html
        proto: resolve(__dirname, 'proto.html'),
      },
    },
  },
});
