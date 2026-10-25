# 결 엔진 (Gyeol Engine)

GitHub: https://github.com/tac0de/gyeol-engine

독립 TypeScript 패키지 `@thedivineparadox/game-engine`입니다. 게임 프로젝트는 빌드된 npm 설치 파일을 사용하며 이 저장소의 위치에 의존하지 않습니다. 현재 소비자는 thedivineparadox입니다.

## 경계와 사용

- `runtime/core`: DOM 없는 규칙·시간·시드 난수·세션·재생. Node에서도 React/Vite 없이 사용할 수 있습니다.
- `runtime/browser/*`: 입력·프레임·이미지·음향 scope.
- `runtime/react`: 선택적 React 19 Canvas 화면. CSS를 함께 배포합니다.
- `tools`: 게임 생성·manifest 조회·로컬 미리보기·규칙 테스트·시나리오/재생. 미리보기는 Vite 8, 타입 검사는 TypeScript 7을 소비 프로젝트에 설치합니다. React/Vite/TypeScript는 선택적 peer이며 runtime/core에 로드되지 않습니다.
- 게임 규칙·캐릭터/배경·미술 방향·계정/저장·공개 카탈로그는 소비 프로젝트가 소유합니다. tools의 생성물은 표준 `portal/games/<id>` 배치를 사용하며 플랫폼의 공개 승인을 수행하지 않습니다.
- 에셋 생성·미술 판단은 native 에이전트가 담당합니다. 이 패키지는 모델 호출이나 자동 제작 루프를 추가하지 않습니다.
- 이미지·애니메이션·카드/UI 프레임 제작은 [에셋 제작 진입점](docs/asset-production.md)에서 시작합니다. Codex Imagegen 원본→Aseprite 보정→TypeScript 후처리를 따르며 `/tools/asset-production`은 종류별 초안과 규격 누락 검사를 제공합니다.

`import {createSession} from "@thedivineparadox/game-engine/runtime"`

`import {GameSurface} from "@thedivineparadox/game-engine/runtime/react"`

`import {createGame, startPreview, testGames} from "@thedivineparadox/game-engine/tools"`

도구 함수는 절대 프로젝트 root를 명시적으로 받습니다. `createGame(root,id,title,{reservedIds})`의 저장 슬롯 예약 정책과 공개 catalog 생성은 소비 프로젝트가 연결합니다. 에셋 URL은 기존 `/assets/<game-id>/` 계약을 유지합니다. 미리보기의 계정/API·다른 게임 차단, 배타 lock·소유 close 동작을 유지합니다. 개발 소스의 보안 sandbox는 아닙니다.

## 빌드·설치

Node 24.2+에서 `npm ci`, `npm run check`, `npm pack --pack-destination /absolute/output`을 실행합니다. `dist/`의 ESM JavaScript·타입 선언·CSS, 템플릿·AGENTS·제작 문서를 설치 파일에 포함합니다. 소비 프로젝트에서 `npm install /absolute/output/thedivineparadox-game-engine-0.4.0.tgz`로 설치합니다. npm registry 공개는 하지 않습니다. 소비자의 Node 요구사항이 더 높으면 그 요구사항을 따릅니다.

엔진 변경은 버전을 올리고 새 설치 파일을 만든 뒤 소비 프로젝트의 lockfile과 함께 검토합니다. 기존 설치 파일을 같은 버전으로 교체하지 않습니다. `npm run check`는 runtime 회귀·공개 export·오프라인 별도 프로젝트 설치를 검사합니다. 현재 게임 5개의 실제 UI/CLI 호환성은 소비 프로젝트의 `npm run check`로 확인합니다.

[Node package exports](https://nodejs.org/api/packages.html)와 [TypeScript 확장자 재작성](https://www.typescriptlang.org/tsconfig/rewriteRelativeImportExtensions.html)에 따라 public entry와 빌드 출력을 분리했습니다.

## 이관 근거

thedivineparadox 커밋 `9562c09cbf595c224254ef4502bb972ffc7bcc96`의 `portal/engine`, 공통 제작 도구, 생성 템플릿에서 추출했습니다. 아래 API·수명 설명은 이관한 동작이며 과거 아카이브 경로는 출처 기록입니다.

### Runtime API

Native Codex가 게임을 설계·편집하고, 이 패키지의 TypeScript 엔진과 명시적 CLI가 같은 규칙을 실행·검사합니다. 모델 라우터·자율 제작 루프·새 MCP 서버는 없습니다. 현재 로컬 카탈로그에는 첫 게임 5개가 연결되어 있습니다.

| 모듈 | 소유 범위 |
| --- | --- |
| `core/` | 화면 없는 규칙, 60Hz 게임 시간, 독립적인 정지 사유, 시드 난수, 명령·상태·재생 |
| `browser/host.ts` | 포인터/키보드, 입력 취소, 단일 RAF, 화면 이탈, 크기 변경, 종료 |
| `browser/assets.ts` | 선택적 같은 게임 이미지 로딩, 취소와 늦게 끝난 decode 정리 |
| `browser/audio.ts` | 사용자 입력 후 활성화하는 선택적 음향, 음소거·종료 |
| `react/game-surface.tsx` | 선택적 Canvas2D 화면과 시작/정지/재시작 UI |

핵심 API는 `createSession(rules, seed)`의 `command`, `inspect`, `exportRecording`, `dispose`입니다. `start`, `advance {ticks}`, `action {action}`, `pause {reason,paused}`, `restart` 명령을 브라우저와 CLI가 공유합니다. 규칙의 `create/reduce/update/finished`에는 DOM·React·계정·벽시계가 없습니다. 난수는 context.random을 사용합니다. 규칙이 외부 시계나 Math.random을 직접 읽으면 재현 보장은 성립하지 않습니다.

`inspect`는 복사본을 반환합니다. 실패한 규칙 호출은 상태·tick·난수를 복구합니다. 기록은 게임 ID·규칙 버전·seed에 결속하며 10,000개 명령과 1MB JSON 범위로 제한합니다. 연속 advance는 합쳐 저장합니다. restart는 이전 판의 기록을 비우고 새 기록 구간을 시작합니다. 현재 pause 사유는 새 기록의 시작에 보존하므로 숨겨진 탭에서 재시작해도 정확히 replay할 수 있습니다. 필요한 이전 판의 recording은 restart 전에 export해야 합니다. 기록 한도에서도 restart가 가능하며, 실패한 restart는 이전 상태와 기록을 보존합니다. 같은 JS 환경에서의 재현이며 모든 JS 엔진 간 수치 동일성이나 서버 점수의 부정행위 방지를 뜻하지 않습니다. 공개 점수판·경쟁 점수 검증은 포함하지 않습니다.

호스트는 정지/종료 시 RAF를 예약하지 않습니다. 화면 이탈·포커스·수동 정지는 별개 사유이며 하나를 해제해도 나머지는 유지합니다. 누르던 입력은 취소로 전달하며 성공 동작인 손 떼기와 구분합니다. 복귀 첫 프레임은 0ms, 프레임당 최대 8tick이며 지연 초과분은 따라잡지 않습니다. 누르지 않은 키의 해제·중복 keydown은 무시하고 포인터 capture 실패도 소유 host의 오류/정리 경로로 전달합니다. 알림과 draw는 같은 detached snapshot을 읽기 전용으로 소비하며 스케줄러는 마지막 phase를 사용해 중복 inspect 복사를 줄입니다. CPU/FPS 변화량은 측정하지 않았습니다. 종료는 입력 listener·ResizeObserver·RAF를 해제합니다. 이미지·오디오 스코프는 사용한 게임이 dispose를 호출합니다.

Canvas2D는 제공하는 기본 표현 어댑터일 뿐입니다. core는 DOM 없이, browser host는 DOM/SVG/WebGL 표현에서도 사용할 수 있습니다. 픽셀·해상도·색상·장르를 강제하지 않습니다. 물리 엔진·에디터·타임라인·상점·네트워크·신규 저장 정책은 포함하지 않습니다.

## 아카이브 재사용

원본 커밋 `fe7dcc6a156c361edfd81d88587bb1dbe941cd40`의 다음 코드를 재사용/축소했습니다.

- `portal/engine/core/pause.ts`: 독립 pause reason 집합.
- `portal/engine/core/frame.ts`: 복귀 첫 프레임과 큰 지연 제한.
- `portal/engine/core/simulation/clock.ts`: 정수 마이크로초 누산과 tick 분할.
- `portal/engine/survivor/simulation.ts`의 `nextSeededRandom`: LCG32. 해당 게임 모듈 의존성은 가져오지 않았습니다.

기존 전체 simulation ledger·다중 backend·게임 규칙·픽셀 제작기·계정 진행 조정기를 복원하지 않았습니다. 현재 엔진은 그 저장/기록 포맷의 호환 대체제가 아닙니다.

## 에이전트 관찰

독립 preview에서만 canvas의 `tdpGame`에 `inspect/command/exportRecording`이 연결됩니다. 실제 UI와 동일한 세션이며 상태 강제 교체나 개인 데이터 쓰기 명령은 없습니다. 출시 페이지는 `preview` prop을 전달하지 않으므로 이 연결을 만들지 않습니다. 이것은 로컬 개발용 관찰 인터페이스이며 인증 경계나 원격 제어 서버가 아닙니다.

## 누르기 입력 조합

`browser/hold-input.ts`의 `createHoldInput()`은 터치/포인터와 Space를 하나의 누르기 동작으로 합칩니다. 마지막 입력을 뗄 때만 hold:false를 전달하고, 취소는 전체 동작을 중단하므로 뒤늦은 keyup이 성공으로 바뀌지 않습니다. 각 마운트에 별도 adapter를 만들고, 정지/재시작/종료는 host가 입력을 취소합니다. 생성 템플릿과 음료 게임이 같은 adapter를 사용합니다.

치명적 host 오류는 소유 자원을 닫고 오류 안내와 다시 불러오기 버튼을 제공합니다. 버튼은 새 host와 입력/음향 scope를 만들며 페이지 전체나 계정 상태를 초기화하지 않습니다. 기록 한도에서 restart할 때는 core 기록 구간을 먼저 열고 남은 입력을 취소합니다.

## 비주얼 제작 도구

[제작 진입점과 template 계약](docs/asset-production.md), [시각 제작 흐름](docs/visual-production.md)을 따릅니다. `/tools/asset-production`은 초안과 명세 검사, `/tools/visual`은 기존 커널/Aseprite의 명시적 호출과 pixel binding, `/tools/media`는 재사용 이미지 export/등록·decode 검사입니다. native 생성·미술 결정은 에이전트가 담당합니다. 카드 프레임 template가 카드 렌더러나 자동 nine-slice 구현을 뜻하지는 않습니다.
# 소스에 결속한 재현·규칙 실험

`@thedivineparadox/game-engine/tools`의 `collectIdentity/createReproduction/replayReproduction/compareReproductions`는 선언한 rules/config/engine/assets 파일 지문과 실제 명령·tick trace를 연결합니다. 다른 지문은 실행 전에 거절하며 같은 version 문자열만으로 재생하지 않습니다. 기존 raw recording/replay는 그대로이며 새 bundle로 조용히 승격하지 않습니다.

trace는 최대 16MiB·14,000지점, 기본 3,600진행 step이며 core의 기존 JSON/recording 한도를 늘리지 않습니다. 전체 advance 실패 시 실제 rollback과 진단용 한 tick씩의 prefix를 구분합니다. 두 revision 비교는 최초 불일치 tick/필드만 진단하고, 다른 source를 같은 코드인 것처럼 재생하지 않습니다. 파일 목록은 신뢰된 프로젝트 어댑터가 선언하며 자동 dependency discovery·서명·권한 검사가 아닙니다.

`runExperiment`는 실제 rules와 신뢰된 TypeScript 정책을 matched seeds·지연된 관찰·행동 주기·tick/전체/wall-time 한도에서 실행합니다. 실패/한도/분포와 개별 raw recording을 보존합니다. 동기 policy는 내부 timer로 선점할 수 없으므로 기존 외부 명령 timeout도 사용합니다. 정책은 사람의 실력 집단이 아니며 win rate·가상 시간·elapsed를 재미나 실제 기기 지연으로 해석하지 않습니다. 계정/인증/공개 debug API·모델 호출은 추가하지 않습니다.
