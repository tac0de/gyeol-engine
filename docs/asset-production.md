# 에셋 제작 진입점

에이전트는 이 문서→[시각 제작 지침](visual-production.md)→해당 종류 template 순서로 읽는다. **Codex Imagegen 원본 생성·수정 → Aseprite에서 다듬기 → TypeScript 후처리·검증·게임 등록**이 기본이다. 소비 프로젝트의 확정된 아트 방향과 충분한 기존 원본을 먼저 확인한다. 엔진이 게임의 스타일·팔레트·해상도·프레임 수를 정하지 않는다.

## 종류별 시작점

| 종류 | 배포 템플릿 | 에이전트가 채울 내용 |
| --- | --- | --- |
| 정적 이미지 | templates/asset-production/image.json | 배경/초상의 역할·시점·실제 표시 크기·캔버스·스타일·참조·팔레트/알파·원본/출력 경로 |
| 애니메이션 | templates/asset-production/animation.json | 위 내용과 핵심 포즈·프레임 ID/재생시간·클립 범위/반복·피벗. 한 이미지 복제를 새 포즈로 세지 않음 |
| UI/카드 프레임 | templates/asset-production/ui-frame.json | 위 내용과 초상/문구/내용의 안전영역·고정 크기 또는 nine-slice·테두리 insets·목표 논리 크기 |

모든 template는 null/빈 값을 그대로 둔 초안이다. 프로젝트에 복사하고 확정된 내용만 채운다. `purpose`는 게임에서의 역할, `visualBrief`는 생성/보정할 모양과 보존할 특징을 설명한다. `game/id`는 소문자 식별자, `canvas`는 소스 픽셀 크기다. `source` 경로는 프로젝트 상대 경로이며 계획 단계에는 파일이 없어도 된다. Imagegen 원본과 Aseprite 수정본은 별도 경로로 보존한다.

`output.prefix`는 확장자 없는 /assets/GAME/... 경로, `scale`은 정수 표시 배율이다. `palette`는 명시한 고유 #RRGGBB 색 목록 또는 preserve, `alpha`는 binary 또는 preserve로 정한다. 기존 값을 조용히 감색/이진화하지 않는다. 이 명세의 숫자는 기술 계획이며 미술 품질의 대용이 아니다.

## 명세 검사 API

```ts
import {assetBriefTemplate, reviewAssetBrief} from '@thedivineparadox/game-engine/tools/asset-production';
const draft = assetBriefTemplate('ui-frame'); // image | animation | ui-frame
const result = reviewAssetBrief(draft);
// incomplete와 누락 필드 목록. 채운 명세는 specified, visualReview는 항상 unverified.
```

TypeScript 타입 `AssetBrief`와 `reviewAssetBrief`가 이 제작 brief의 계약이다. 초안을 복사해도 패키지 template가 변하지 않는다. API는 파일을 쓰거나 모델/native 도구를 실행하지 않는다. 검사는 필드·경로 형식·치수·프레임/클립·UI 기하만 확인한다. 파일 존재·바이트·원본 일관성·자연스러운 동작·미술·권리·사용자 승인은 확인하지 않는다. specified는 자동 생성/실행 권한이나 출시 상태가 아니다.

소비 프로젝트는 기존 TypeScript CLI에서 API를 호출한다. 예: `npm run media -- brief template ui-frame`로 JSON 초안을 보고 `brief check RELATIVE_JSON`으로 채운 명세를 확인할 수 있도록 얇게 연결한다. 해당 CLI 유무는 소비 프로젝트가 소유한다.

## 애니메이션과 프레임 검수

`animation.frames`는 `{id,durationMs}`, `clips`는 `{idle:{from,to,loop}}` 형식이다. 프레임 ID는 고유하고 모든 프레임이 한 클립에 속해야 한다. 잘못된 범위·겹침·시간·피벗을 찾지만 좋은 포즈/전환은 실제 속도로 관찰해야 한다. 생성된 sheet의 격자나 프레임 수는 직접 확인하고 제작 plan에 원본 crop/프레임 경로를 적는다.

`uiFrame.regions`는 `{id,x,y,width,height}` 목록이다. 예를 들어 portrait/title/body 영역을 게임에 맞게 정하고 모든 영역을 캔버스 안에 둔다. 장식과 실제 텍스트/스탯/판정은 분리하며 글자를 생성 그림에 굽지 않는다. 겹침이 의도적인지는 native가 판단한다. 이 계약이 카드의 전투 수치나 희귀도를 정하지 않는다.

`resize: fixed`는 논리 캔버스 크기를 유지하고 정수 배율은 output.scale로 표현한다. insets는 모두 null이다. `nine-slice`는 left/top/right/bottom 원본 픽셀 폭을 명시하고 중심과 목표 크기가 남는지 확인한다. targetSizes는 배율 적용 전 논리 크기다. 안전영역 좌표는 원본 기준이며 실제 크기 변경 때 내용 재배치는 게임 UI가 설계한다. 이 도구는 nine-slice 렌더러나 자동 카드 레이아웃이 아니다.

## 기존 실행 경로와 연결

이 brief는 **제작 전에 필요한 선택을 적는 문서**이고 기존 production-plan v1을 대체하지 않는다. 실제 Imagegen 원본을 얻고 프레임/crop을 확인한 뒤 기존 pixel plan에 이미지·캔버스·팔레트·duration·clips·pivot·출처를 연결한다. 조립→Aseprite 보정→export/validate→bindPixel을 그대로 사용한다. 새 명세를 검사했다고 커널 실행을 자동 호출하거나 미완성 산출물을 등록하지 않는다.

현재 설치 패키지 안에는 이 안내·templates·tools가 함께 있다. native assembler/exporter/검사·최소 Lua bridge는 기존 공용 kernel이 소유한다. 런타임은 검증된 출력만 소비하고 제작 도구를 로딩하지 않는다. 원본 해시/binding 검사는 기존 tools/visual과 소비 프로젝트의 media check를 사용한다.
