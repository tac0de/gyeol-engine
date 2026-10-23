# 에이전트의 비주얼 제작과 게임 연결

## 선택 원칙

**Imagegen은 새 외형·배경·핵심 포즈의 후보 제작에 사용하고, TypeScript + Aseprite는 편집 가능한 최종 픽셀·프레임·검사를 소유합니다.** 기존에 충분한 원본이 있으면 그 원본을 수정·재출력합니다. 손그림·픽셀·벡터 중 어느 스타일을 쓸지는 게임의 기존 결정이 우선입니다. 이 흐름을 정리하는 작업은 새 이미지를 생성하거나 기존 아트를 바꾸는 작업과 다릅니다.

| 필요 | 우선 재사용할 경로 |
| --- | --- |
| 기존 캐릭터 수정·정확한 팔레트·타일 경계·정해진 32×32 픽셀 | 기존 `.aseprite`/벡터 원본과 TypeScript 도구. Lua는 최소 Aseprite API 연결만 담당 |
| 새로운 캐릭터 외형·풍부한 배경·중요한 전신 포즈 | native Imagegen으로 후보 제작 → 선택 원본 보존 → 필요한 편집/게임용 가공 |
| 손그림 정적 배경·부품 | 기존 미디어 brief → 원본 PNG → bounded sharp WebP export → bundle·게임 등록 |
| 단순 UI·판정 도형·텍스트·정확한 개수의 요소 | 기존 SVG/Canvas/TypeScript 표현 유지 |
| 애니메이션 | 좋은 기존 포즈 우선. 부족한 주요 포즈만 생성하고 Aseprite에서 프레임·피벗·타이밍과 연결을 마무리 |

Imagegen 결과가 픽셀처럼 보여도 실제 32×32 규격이나 자연스러운 애니메이션을 보증하지 않습니다. 원본을 자동 축소·감색·알파 이진화하지 않습니다. 실제 저해상도 요구가 있으면 원본을 보존한 새 후보에서 변환 이유·크기·필터·팔레트·알파 기준을 명시하고 1× 및 정수 배율에서 확인합니다. 이미지의 해상도와 게임에서 보이는 크기는 별개입니다.

## 한 에셋의 제작 흐름

1. **재사용 조사:** 현재 게임의 원본·원본 프롬프트·스타일·공개 출력·소비 코드를 확인합니다. 기존 에셋이 충분하면 생성하지 않습니다. 이전에 폐기한 게임의 경로를 활성 파이프라인으로 되살리지 않습니다.
2. **역할과 제작 규격:** 무엇을 보여줄지, 실제 화면 크기, 시점·색/조명·실루엣·HUD 여백, 투명도, 피벗, 프레임/클립과 용량을 작성합니다. 모르는 중요한 스타일 선택은 native 에이전트가 확인하며 JSON이나 도구가 정하지 않습니다.
3. **후보 제작:** 필요한 새 bitmap만 내장 Imagegen으로 생성/편집합니다. 같은 캐릭터의 선택된 참조와 유지할 얼굴·비율·의상·카메라·광원을 명시하고, 한 번의 수정에는 실제 결함을 구체적으로 지정합니다. 파일·요청/참조·선택/기각 근거를 게임의 `art/`에 보존합니다. 정확한 프레임 수나 그리드 정렬을 프롬프트만으로 믿지 않습니다. 모델 호출·새 API 키·원격 생성·자동 재시도는 엔진 CLI가 수행하지 않습니다.
4. **편집 가능한 원본:** 픽셀/애니메이션은 기존 `game.animation.assemble`을 통해 `.aseprite`로 가져오고, Aseprite 원본에서 포즈·타이밍·필요한 레이어를 편집합니다. 수정 원본을 exporter가 절차적 캐릭터로 다시 그리지 않습니다. 정확한 도형·타일·팔레트에는 기존 결정적 제작 방식도 계속 사용합니다.
5. **기술 확인과 출력:** 픽셀은 기존 `export/validate`, 손그림은 `game.media.publish/validate`와 소비 측 전체 이미지 decode를 사용합니다. 원본/계획/atlas SHA, 프레임 ID·피벗·시간·투명 여백·용량을 연결합니다. 출력 성공은 미술 승인이나 자연스러운 동작의 증거가 아닙니다.
6. **게임 연결:** 픽셀은 `bindPixel`이 검증된 PNG/atlas/클립과 원본 SHA를 `pixel-NAME.generated.ts`로 연결합니다. 손그림은 기존 `media.generated.ts` 형식을 유지합니다. 직접 만든 임시 URL이 아니라 실제 공개 출력 URL을 사용합니다. source/native 파일은 게임이, 런타임 로딩·중단·종료는 엔진이 소유합니다.
7. **실제 관찰과 수정:** 실제 게임 크기·정상 재생 속도에서 얼굴/장비 유지, 지면 접촉·반대쪽 발·무게 이동·전후 포즈 연결, 피격/공격 판독성, HUD 대비, 터치·재시작·이탈/음소거·실패 복구를 확인합니다. 결함이 생긴 단계만 수정하고 종속 출력을 다시 만듭니다. 기준 원본과 좋은 포즈는 보존합니다. 사용자 미술 승인이 실제로 필요한 경우에만 그 결정을 별도로 받습니다.

## 재사용한 구현과 설치

- `tools/visual`: 기존 공용 커널의 `game.media.*`, `game.animation.assemble|export|validate|retouch`를 명시적으로 호출하는 얇은 adapter. Aseprite assembler·exporter·검사기와 최소 Lua bridge는 공용 커널에 하나만 유지합니다. 별도 모델 wrapper·플래너·상주 제작 루프는 없습니다.
- `tools/media`: thedivineparadox에서 검증해 사용하던 이미지 decode/가공·알파 frame·bundle 확인·TypeScript 등록을 추출했습니다. 원본 producer/prompt/rights는 프로젝트가 명시합니다. 이 WebP 경로로 정확한 픽셀 atlas를 손실 변환하지 않습니다.
- `runtime/browser/assets`, `runtime/react`: 기존 이미지 scope와 Canvas 표현을 그대로 사용합니다. 새 renderer를 추가하지 않습니다.
- Sharp는 `/tools/media`에만 필요한 선택적 peer입니다. Node core 실행이나 `/tools/visual`의 픽셀 adapter에 강제하지 않습니다. 제작 호출은 기존 커널 CLI/Aseprite가 필요하며, 등록된 출력의 CI 해시 검사에는 필요하지 않습니다.

```ts
import {createVisualTools} from '@thedivineparadox/game-engine/tools/visual';
import {createMediaTools} from '@thedivineparadox/game-engine/tools/media';
const visual = createVisualTools({project: absoluteProject, kernelBin: existingKernelBin,
  authorityRef: existingUserDecisionReference});
visual.pixel('assemble', 'art/hero/plan.json');
// native Codex가 Aseprite 원본의 실제 픽셀과 포즈를 편집한 뒤 실행합니다.
visual.pixel('export', 'art/hero/plan.json');
visual.bindPixel('art/hero/plan.json', 'my-game', 'hero');
visual.checkPixelBinding('my-game', 'hero'); // native 도구 없이 변경된 원본/출력/등록을 거절
```

pixel plan은 기존 공용 커널의 production-plan v1 계약을 그대로 사용합니다. `output`은 해당 게임의 `/assets/my-game/.../hero`처럼 확장자 없는 prefix입니다. 소스 크기·클립·피벗과 provenance를 계획에 기록하고 기존 assemble/export 안내를 따릅니다. 변경된 원본은 새 revision으로 보존하며 출력 생성이 원본을 덮어쓰지 않습니다. 등록 변경은 명시적 refresh가 필요합니다. `authorityRef`는 기존 사용자 결정의 참조이며 새 실행 권한이나 자동 미술 승인을 만들지 않습니다. 실제 CLI 요청/응답은 소스 밖 `~/.local/state/paradox-visual-tools/`에 보존합니다.

게임의 `GamePresentation`에는 `assets.images: {hero: sprite.image}`를 연결합니다. `sprite.frames`의 `x/y/w/h/durationMs`, `sprite.clips`의 frame ID 범위, `sprite.pivot/scale`을 draw callback에서 사용합니다. 표시 시간은 게임의 기존 tick/상태에서 계산하고 피해 판정·게임 시간·이벤트를 표시 프레임이나 GIF의 별도 시계로 옮기지 않습니다. 클립의 `loop`와 각 프레임 duration을 지키며 정상 속도에서 확인합니다. 이 등록은 자동으로 게임 규칙이나 draw callback을 편집하지 않습니다.

## 검증 범위

일반 검사는 경로 탈출·symlink·출처 미지정 제작을 거절하고 기존 runtime/package 회귀를 확인합니다. `npm run test:visual-native`는 설치된 공용 커널+Aseprite에서 기술용 픽셀 fixture를 assemble/export/validate/bind/import하고 원본 변경 시 CI 검사 실패를 확인합니다. 이 fixture는 출시 에셋이나 Imagegen 품질 비교가 아닙니다. 기존 게임의 미디어와 브라우저 검사는 소비 프로젝트에서 별도로 수행합니다.

## 근거와 판단의 한계

기존 RI의 활성 자료에서 `imagegen pixel`에 해당하는 소스를 찾지 못해, 현재 TypeScript/최소 Lua 구현·기존 프로젝트 결과·다음 원문을 대조했습니다. “후보 생성에는 Imagegen, 정밀 마무리에는 기존 도구”는 이 근거에 대한 제작 설계 판단이며 두 방식의 미술 품질을 비교 실험한 결과는 아닙니다.

- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation): 반복 등장 캐릭터의 일관성과 정밀 구도에는 여전히 한계가 있어 생성 뒤 검수가 필요합니다.
- [OpenAI image prompting](https://developers.openai.com/api/docs/guides/image-prompting): 참조와 유지해야 할 세부를 명시하는 편집 지침을 적용합니다. API 모델 설명을 내장 Imagegen의 실제 옵션으로 가정하지 않습니다.
- [Aseprite CLI](https://www.aseprite.org/docs/cli/): 편집 원본에서 PNG sheet와 JSON frame/tag/timing을 출력하는 기존 경로를 재사용합니다.
