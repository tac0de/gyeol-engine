# Paradox game engine

- 소유 로직은 TypeScript입니다. `runtime/`은 게임 실행만, `tools/`는 명시적 로컬 제작만 담당합니다.
- 게임 규칙·아트 방향·계정·공개 카탈로그·native 생성 판단은 소비 프로젝트가 소유합니다.
- 에셋 작업은 [제작 진입점](docs/asset-production.md)과 [시각 제작 지침](docs/visual-production.md)을 먼저 읽습니다. Codex Imagegen 원본 생성/수정→Aseprite 보정→TypeScript 후처리·검증·등록이 기본입니다. 생성 그림을 참고만 하고 Lua/TypeScript로 처음부터 다시 그리지 않습니다. 충분한 기존 원본은 재사용하며 소비 프로젝트의 확정 방향을 우선합니다.
- 이미지·애니메이션·UI/카드 프레임은 templates/asset-production의 미정 값이 남은 초안과 tools/asset-production의 명세 검사를 사용합니다. 스타일·규격을 임의 확정하지 않으며 검사가 이미지 생성·미술 승인·실행 권한을 대신하지 않습니다. Lua는 공용 kernel의 최소 Aseprite API 연결에 둡니다.
- `npm ci`, `npm run check`, `npm pack`으로 빌드·검사·설치 파일을 만듭니다. 배포/레지스트리 발행은 별도 요청이 필요합니다.
- `codex/` 브랜치와 공용 커널 check/report 및 Git delivery를 사용합니다. 다른 작업과 인증을 보존합니다.
