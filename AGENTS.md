# Paradox game engine

- 소유 로직은 TypeScript입니다. `runtime/`은 게임 실행만, `tools/`는 명시적 로컬 제작만 담당합니다.
- 게임 규칙·아트 방향·계정·공개 카탈로그·native 생성 판단은 소비 프로젝트가 소유합니다.
- `npm ci`, `npm run check`, `npm pack`으로 빌드·검사·설치 파일을 만듭니다. 배포/레지스트리 발행은 별도 요청이 필요합니다.
- `codex/` 브랜치와 공용 커널 check/report 및 Git delivery를 사용합니다. 다른 작업과 인증을 보존합니다.
