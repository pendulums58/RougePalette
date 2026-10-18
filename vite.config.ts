import { defineConfig } from 'vite';

export default defineConfig({
  // './' 로 두면 GitHub Pages의 프로젝트 사이트(user.github.io/repo/)에서도
  // 레포 이름을 하드코딩하지 않고 그대로 동작한다. 라우터를 붙이게 되면
  // base를 '/<repo-name>/' 로 바꿔야 한다.
  base: './',
  build: {
    outDir: 'dist',
    target: 'es2022',
  },
});
