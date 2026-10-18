# 프로젝트 안내

턴제 덱빌딩 로그라이트 웹게임. Vite + 바닐라 TypeScript, 프레임워크 없음.

## 구조

```
src/
  main.ts            상태 보관 + 클릭 액션 디스패치 + 렌더 호출
  types.ts           전역 타입. 새 개념은 여기부터
  style.css          전체 스타일 (CSS 변수는 :root)
  data/
    cards.ts         카드 정의 (CARDS 배열)
    characters.ts    캐릭터 정의 + 보상 카드 풀
    enemies.ts       적 정의 + 턴 패턴
  systems/
    rng.ts           시드 난수 (mulberry32)
    combat.ts        전투 로직 전부. 순수하게 state를 변형
    run.ts           런/맵 생성, 보상 추첨
  ui/
    render.ts        GameState -> HTML 문자열. DOM 이벤트는 main의 위임 핸들러가 처리
```

## 아키텍처 규칙

- **렌더는 전체 다시 그리기.** `render()`는 HTML 문자열을 반환하고 `main.ts`가 `innerHTML`로 통째로 교체한다. 부분 갱신/가상 DOM 없음. 성능 문제가 생기기 전까지는 이대로 둘 것.
- **이벤트는 위임만.** `#app`에 걸린 단일 클릭 핸들러가 `data-action` 속성을 읽어 `main.ts`의 `actions` 맵에서 함수를 찾는다. 개별 요소에 리스너를 붙이지 말 것.
- **로직은 UI를 모른다.** `systems/`는 DOM을 건드리지 않는다. 테스트 가능해야 한다.
- **난수는 전부 `Rng` 인스턴스로.** `Math.random()`을 직접 쓰지 말 것 — 시드 재현이 깨진다.

## 자주 하는 작업

- **카드 추가**: `data/cards.ts`의 `CARDS`에 객체 추가 → 해당 캐릭터의 `cardPool`에 id 추가.
- **새 효과 종류 추가**: `types.ts`의 `Effect` 유니온에 한 줄 → `combat.ts`의 `applyEffect` switch에 케이스 한 개.
- **적 추가**: `data/enemies.ts`에 정의 → `run.ts`의 `NORMAL_POOLS` / `ELITE_POOLS`에 등장 조합 추가.
- **밸런스**: 층 수는 `run.ts`의 `FLOORS_BEFORE_BOSS`, 에너지/손패는 `combat.ts`의 `BASE_ENERGY` / `HAND_SIZE`.

## 명령어

```
npm run dev        로컬 개발 서버
npm run build      타입체크 + 프로덕션 빌드 (dist/)
npm run typecheck  타입체크만
```

`npm run build`가 통과하지 않으면 커밋하지 말 것. CI가 똑같은 걸 돌린다.

## 배포

`main`에 푸시하면 `.github/workflows/deploy.yml`이 GitHub Pages로 배포한다.
`vite.config.ts`의 `base`가 `'./'`라 레포 이름에 의존하지 않는다. 클라이언트 라우터를 붙이게 되면
`base`를 `'/<레포이름>/'`으로 바꿔야 한다.
