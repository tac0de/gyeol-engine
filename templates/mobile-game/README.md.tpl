# __TITLE_TEXT__

개발용 초안입니다. 이 생성 예제는 엔진의 입력·시간·결과·재시작 연결을 확인하는 용도이며 출시 게임이나 승인된 미술이 아닙니다.

- 규칙: `rules.ts` — DOM/React/저장/실시간 시계 없이 실행합니다.
- 표현: `client.tsx` — 현재 Canvas2D 예제이며 DOM/SVG/WebGL로 바꿀 수 있습니다.
- 검사: `rules.test.ts` — 실제 규칙을 실행합니다.
- 메타데이터: `manifest.json` — 초안은 홈·sitemap·프로덕션 경로에 등록되지 않습니다.

```sh
npm run game -- preview __ID_TEXT__
npm run game -- test __ID_TEXT__
npm run game -- run __ID_TEXT__ --scenario /absolute/private/scenario.json --output /absolute/private/result.json
```

첫 게임 설계에서 핵심 선택·실패/성공·한 판 길이·조작·아트 방향·저장 여부를 확정하고 이 예제를 교체합니다. 같은 seed와 명령의 재현은 같은 JS 실행 환경을 기준으로 하며 재미나 미술 승인이 아닙니다.
