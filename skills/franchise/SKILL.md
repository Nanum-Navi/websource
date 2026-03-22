---
name: franchise
description: >
  프랜차이즈 매장 데이터 수집 위저드.
  brand_id, brand_name, 매장찾기 URL을 입력받아 매장 정보를 추출하고
  표준화된 JSON 파일로 저장한다.
  Trigger on: "/franchise", "매장 수집", "프랜차이즈 수집", "가맹점 수집"
triggers:
  - "franchise"
  - "매장 수집"
  - "프랜차이즈 수집"
  - "가맹점 수집"
---

# franchise wizard

<!-- Replace the path below with the absolute path to your websource installation -->
PROJECT_DIR="/path/to/websource"

All scripts are run as:
```
cd "$PROJECT_DIR" && npx tsx scripts/<script>.ts <args>
```

## References

이 위저드는 다음 파일들을 참조한다:
- `config/crawl_rules.json` — 필드 매핑, 후처리, 검증 규칙
- `meta/store_schema.json` — 출력 데이터 검증 스키마

위저드 시작 시 두 파일을 읽고 내용을 숙지한 상태에서 진행한다.

---

## Wizard flow

사용자가 프랜차이즈 매장 데이터를 수집하려 할 때 아래 단계를 순서대로 진행한다.
각 단계의 결과를 사용자에게 보여주고 확인을 받은 뒤 다음 단계로 넘어간다.

---

### Step 0 — 입력 확인

사용자로부터 정보를 하나씩 순서대로 물어본다. 각 입력 후 검증하고, 실패 시 재입력을 요청한다.

```
프랜차이즈 매장 수집을 시작합니다.

브랜드 ID를 입력해주세요 (영문 키, 예: bbq):
> bbq

브랜드명을 입력해주세요 (한글, 예: BBQ치킨):
> BBQ치킨

매장찾기 URL을 입력해주세요:
> https://www.bbq.co.kr/shop/shopList.asp
```

3가지 입력이 끝나면 확인 테이블을 보여준다:

```
| 항목        | 값                                        |
|------------|-------------------------------------------|
| brand_id   | bbq                                       |
| brand_name | BBQ치킨                                    |
| URL        | https://www.bbq.co.kr/shop/shopList.asp   |

이 정보로 진행할까요? (yes/수정할 항목 지정)
```

입력 검증:
- `brand_id`: 영문 소문자, 숫자, 하이픈만 허용
- `brand_name`: 비어있지 않은 문자열
- `url`: 유효한 URL 형식

같은 `brand_id`로 이미 `data/` 에 파일이 존재하면 덮어쓸 것인지 확인한다.

---

### Step 1 — 페이지 분석

```bash
cd "$PROJECT_DIR" && npx tsx scripts/analyze-page.ts <URL> --mode rendered
```

**결과 해석:**

1. `fieldQuality: "none"` 또는 `"poor"` → URL이 잘못되었을 가능성 높음
   - `suggestedBlock.selector`가 nav/sidebar(`.lnb`, `.sidebar`, `nav li`)이면 실제 매장 목록 페이지가 아님
   - URL을 자동 추론하여 재시도 (검색 결과 페이지, 필터 뷰 등)
   - 2회 실패 시 사용자에게 올바른 URL 요청
2. `robotsAllowed: false` → 사용자에게 경고 후 진행 여부 확인
3. 성공 시 → `suggestedFields`를 테이블로 표시

```
페이지 분석 완료: https://example.com/store/list

| # | 원본 필드명  | 타입   | 샘플 값          |
|---|-------------|--------|-----------------|
| 1 | 매장명       | text   | 강남역점         |
| 2 | 주소        | text   | 서울시 강남구 ... |
| 3 | 전화번호     | text   | 02-1234-5678    |
| 4 | 위도        | number | 37.4979         |
| 5 | 경도        | number | 127.0276        |
```

---

### Step 2 — 필드 자동 매핑

`config/crawl_rules.json`의 `fields.fieldMapping`을 사용하여 분석된 필드를 공통 필드명으로 자동 매칭한다.

매칭 로직:
1. 분석된 필드명이 `aliases` 목록에 포함되면 자동 매핑
2. 필드명이 정확히 일치하면 자동 매핑 (예: `lat` → `lat`)

매칭 결과를 테이블로 보여주고 확인 요청:

```
필드 매핑 결과:

| 원본 필드명  | → 매핑 필드  | 상태 |
|-------------|------------|------|
| 매장명       | → name     | ✓    |
| 주소         | → address  | ✓    |
| 전화번호     | → contact  | ✓    |
| 위도         | → lat      | ✓    |
| 경도         | → lng      | ✓    |

이 매핑으로 진행할까요? (yes/no/수정할 매핑 지정)
```

**필수 필드 매핑 실패 시:**
- `crawl_rules.json`의 `fields.required`에 있는 필드가 매핑되지 않으면 경고
- 사용자에게 수동으로 셀렉터를 지정하도록 요청
- lat/lng가 없는 경우: 지오코딩 스크립트로 주소→좌표 변환을 자동 수행한다 (Step 3.5 참조)

---

### Step 3 — 추출 실행

먼저 5건 프리뷰:

```bash
cd "$PROJECT_DIR" && npx tsx scripts/preview-extraction.ts <id> --limit 5
```

프리뷰 결과를 매핑된 필드명으로 변환하여 테이블로 표시:

```
프리뷰 (5건):

| name              | address                    | contact       | lat       | lng        |
|-------------------|----------------------------|---------------|-----------|------------|
| BBQ치킨 강남역점   | 서울특별시 강남구 역삼로 123  | 02-1234-5678  | 37.497942 | 127.027621 |
| ...               | ...                        | ...           | ...       | ...        |

전체 추출을 진행할까요? (yes/no)
```

"yes" 시 전체 추출:

```bash
cd "$PROJECT_DIR" && npx tsx scripts/run-extraction.ts <id>
```

**에러 임계값:**
전체 레코드 중 5% 이상 오류(필수 필드 누락, 좌표 범위 이탈) 발생 시 추출을 중단하고 사용자에게 상황을 알린다.

---

### Step 3.5 — 지오코딩 (좌표 없는 경우)

사이트에서 lat/lng를 제공하지 않거나, 추출된 좌표가 비어있는 매장이 있으면 이 단계를 실행한다.
사이트에서 좌표를 모두 제공하는 경우 이 단계를 건너뛴다.

**지오코딩 스크립트:**
```bash
# 단건
cd "$PROJECT_DIR" && npx tsx scripts/geocode.ts "서울특별시 강남구 역삼로 123"

# 배치 (stdin으로 JSON 배열 전달)
echo '["주소1","주소2","주소3"]' | cd "$PROJECT_DIR" && npx tsx scripts/geocode.ts --stdin
```

출력 형식:
```json
{
  "ok": true,
  "results": [
    { "address": "서울특별시 강남구 역삼로 123", "lat": "37.4941840", "lng": "127.0330224" },
    { "address": "잘못된 주소", "lat": null, "lng": null }
  ]
}
```

**사용 방식:**

추출된 매장 데이터에서 좌표가 없는 매장의 주소 목록을 JSON 배열로 만들어 `--stdin`으로 전달한다.
한 번에 최대 100건씩 배치로 호출하고 결과를 매장 데이터에 병합한다.

```bash
# 예: 좌표 없는 주소들을 배치 지오코딩
echo '["서울 마포구 어울마당로 133","경기도 파주시 와석순환로 380"]' | \
  cd "$PROJECT_DIR" && npx tsx scripts/geocode.ts --stdin --rate-limit 150
```

**환경변수 필요:**
`.env` 파일에 네이버 클라우드 API 키가 설정되어 있어야 한다. `.env.example` 참조.

**지오코딩 실패 처리:**
- `lat: null` 또는 `lng: null`인 경우 → 원본 주소 오타/불완전 가능성
- 실패 매장은 별도 `_failed.json` 파일에 저장
- 전체 실패율이 5% 이상이면 사용자에게 알림

---

### Step 4 — 후처리

추출된 데이터에 다음 변환을 적용한다:

**1. name 변환:**
매장명이 `brand_name`으로 시작하지 않으면 접두어를 추가한다.
```
"강남역점" → "BBQ치킨 강남역점"
"BBQ치킨 강남역점" → "BBQ치킨 강남역점" (변경 없음)
```

**2. lat/lng 문자열 변환:**
숫자로 추출된 좌표를 문자열로 변환한다. 원본 정밀도를 그대로 유지한다.
```
37.497942 → "37.497942"
127.027621 → "127.027621"
```

**3. address 정규화 및 region/district 파싱:**
`src/normalize/address.ts`의 `normalizeStoreAddress(address)`를 사용한다.

이 함수는 다음을 수행한다:
1. address 클리닝: HTML 태그 제거, 유니코드 이상문자 제거, NBSP/탭→공백, region 중복 접두어 제거, 공백 축소
2. region 정규화: 주소 첫 토큰을 현행 17개 공식 시/도명으로 매핑 (약칭, 구명칭, 오타 모두 처리)
3. address 내 region을 정식명으로 치환
4. district 추출: 정규화된 주소의 두 번째 토큰

```
normalizeStoreAddress("경남 밀양시 창밀로 3566")
→ { address: "경상남도 밀양시 창밀로 3566", region: "경상남도", district: "밀양시" }

normalizeStoreAddress("전라북도 전주시 덕진구 조경단로 59")
→ { address: "전북특별자치도 전주시 덕진구 조경단로 59", region: "전북특별자치도", district: "전주시" }

normalizeStoreAddress("서울특별시 강남구 역삼로 123<br>1층\u200b")
→ { address: "서울특별시 강남구 역삼로 123 1층", region: "서울특별시", district: "강남구" }
```

region 또는 district가 `null`이면 주소 파싱 실패로 판단하고 수동 확인 대상으로 분류한다.

**4. 중복 제거:**
`name` + `address`가 동일한 레코드를 제거한다.

**5. id 채번:**
중복 제거 후 1부터 순번을 매긴다.

**6. contact 정리:**
값이 빈 문자열이면 `null`로 변환한다.

---

### Step 5 — 검증

`meta/store_schema.json`으로 전체 데이터를 검증한다.

검증 항목:
1. JSON Schema 준수 여부
2. 필수 필드 누락 레코드
3. 좌표 범위 이탈 (lat 33~39, lng 124~132)
4. 중복 레코드 (name + address)
5. 스키마 외 필드 포함 여부

검증 결과를 요약 표시:

```
검증 결과:
- 전체: 2,051건
- 통과: 2,048건
- 필수 필드 누락: 2건 (id: 45, 1203)
- 좌표 범위 이탈: 1건 (id: 892)
- 중복: 0건

계속 진행할까요? (yes/문제 레코드 제외 후 저장/중단)
```

---

### Step 6 — 저장

파일명은 `crawl_rules.json`의 `naming` 규칙을 따른다:

```
data/{brand_name}({brand_id}).json
```

예시: `data/BBQ치킨(bbq).json`

JSON 구조:
```json
{
  "meta": {
    "brand_id": "bbq",
    "brand_name": "BBQ치킨",
    "totalCount": 2051,
    "extractedAt": "2026-03-17T10:30:00.000Z",
    "sourceUrl": "https://www.bbq.co.kr/shop/shopList.asp"
  },
  "stores": [
    {
      "id": 1,
      "name": "BBQ치킨 강남역점",
      "address": "서울특별시 강남구 역삼로 123",
      "contact": "02-1234-5678",
      "lat": "37.497942",
      "lng": "127.027621",
      "region": "서울특별시",
      "district": "강남구"
    }
  ]
}
```

저장 완료 메시지:

```
저장 완료: data/BBQ치킨(bbq).json (2,051건)

PR을 제출하려면:
  브랜치: crawl/bbq
  파일: data/BBQ치킨(bbq).json

아래 스프레드시트에 업데이트 내역을 반영해주세요.
https://docs.google.com/spreadsheets/d/17c1ZKs1Y0DfunJhJ5F8l7p-2sDDaDhO9BZtLj87SjyQ/edit?usp=sharing
```

---

## Operations

### 검증만 실행
```bash
cd "$PROJECT_DIR" && npx tsx scripts/validate-store-data.ts data/<파일명>.json
```

### 기존 데이터 재수집
동일한 brand_id로 위저드를 다시 실행하면 기존 파일을 덮어쓴다.
Git으로 이전 버전을 추적할 수 있다.

---

## Error handling

| 상황 | 대응 |
|------|------|
| `fieldQuality: none/poor` | URL 자동 추론 후 재시도, 2회 실패 시 사용자에게 URL 요청 |
| `robotsAllowed: false` | 경고 후 사용자 확인 |
| 필수 필드 매핑 실패 | 수동 매핑 요청 |
| 좌표 없는 사이트 | Step 3.5 지오코딩 자동 실행 (`scripts/geocode.ts --stdin`) |
| 5% 이상 오류 | 추출 중단, 사용자에게 알림 |
| 추출 건수 0 | URL 재확인 요청 |

---

## Notes

- 스크립트 출력은 JSON — 파싱 후 사용자에게 읽기 좋은 형태로 표시
- 에러(`ok: false`) 발생 시 사용자에게 안내하고 재시도 방법 제안
- 위저드 시작 시 반드시 `config/crawl_rules.json`과 `meta/store_schema.json`을 읽는다
- 후처리는 위저드 내에서 데이터 변환으로 수행한다 (별도 스크립트 불필요)
