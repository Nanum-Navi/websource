# 프랜차이즈 매장 수집 가이드

프랜차이즈 공식 사이트에서 매장 정보를 수집하여 표준화된 JSON으로 저장하는 팀 공통 가이드입니다.

---

## 전체 워크플로

```
1. /franchise 실행
2. brand_id, brand_name, URL 입력
3. 자동 분석 → 필드 매핑 확인
4. 프리뷰 확인 → 전체 추출
5. 후처리 & 검증
6. data/{brand_name}({brand_id}).json 저장
7. Git PR 제출
```

---

## 사전 준비

### websource 설치

```bash
git clone <repo-url>
cd websource
npm install
npx playwright install  # JS 렌더링 지원
```

### /franchise 스킬 설치

`skills/franchise/SKILL.md`가 Claude Code에서 인식되도록 설정:

```bash
# 프로젝트 루트의 skills/ 디렉토리가 자동 인식됩니다
# 또는 ~/.claude/skills/franchise/SKILL.md 에 복사
```

---

## 수집 방법

### 1. 위저드 시작

Claude Code에서 `/franchise`를 입력하거나, "매장 수집해줘"라고 요청합니다.

### 2. 정보 입력

```
프랜차이즈 매장 수집을 시작합니다.

1. 브랜드 ID (영문 키, 예: bbq): bbq
2. 브랜드명 (한글, 예: BBQ치킨): BBQ치킨
3. 매장찾기 URL: https://www.bbq.co.kr/shop/shopList.asp
```

### 3. 분석 & 매핑 확인

위저드가 페이지를 분석하고 필드를 자동 매핑합니다.
매핑 결과를 확인하고 `yes`로 진행합니다.

```
필드 매핑 결과:

| 원본 필드명  | → 매핑 필드  | 상태 |
|-------------|------------|------|
| 매장명       | → name     | ✓    |
| 주소         | → address  | ✓    |
| 전화번호     | → contact  | ✓    |
| 위도         | → lat      | ✓    |
| 경도         | → lng      | ✓    |

이 매핑으로 진행할까요? (yes/no)
```

### 4. 프리뷰 & 추출

5건 프리뷰를 확인한 뒤 전체 추출을 진행합니다.

### 5. 저장

후처리와 검증이 완료되면 `data/BBQ치킨(bbq).json`으로 저장됩니다.

---

## 데이터 표준

### 파일명 규칙

```
data/{brand_name}({brand_id}).json
```

예시: `data/BBQ치킨(bbq).json`, `data/스타벅스(starbucks).json`

### 필드 정의

| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `id` | integer | O | 순번 (1부터) |
| `name` | string | O | 매장명 (브랜드명 접두어 포함) |
| `address` | string | O | 도로명/지번 주소 |
| `contact` | string \| null | - | 전화번호 |
| `lat` | string | O | 위도 (WGS84, 문자열) |
| `lng` | string | O | 경도 (WGS84, 문자열) |
| `region` | string | O | 시/도 |
| `district` | string | O | 시/군/구 |

### 변환 규칙

**매장명 (name):**
브랜드명으로 시작하지 않으면 자동으로 접두어 추가.
- `"강남역점"` → `"BBQ치킨 강남역점"`
- `"BBQ치킨 강남역점"` → 변경 없음

**좌표 (lat/lng):**
정확도 보존을 위해 문자열로 저장.
- `37.497942` → `"37.497942"`

**지역 (region/district):**
주소에서 자동 파싱.
- `"서울특별시 강남구 역삼로 123"` → region: `"서울특별시"`, district: `"강남구"`

**연락처 (contact):**
없으면 `null`. 빈 문자열은 `null`로 변환.

### 출력 파일 구조

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

---

## PR 제출 규칙

### 브랜치

```bash
git checkout -b crawl/{brand_id}
# 예: git checkout -b crawl/bbq
```

### PR 포함 파일

`data/{brand_name}({brand_id}).json` — 1개 파일만 포함

### 검증

PR 전에 검증 스크립트를 실행합니다:

```bash
npx tsx scripts/validate-store-data.ts data/BBQ치킨\(bbq\).json
```

### PR 본문 템플릿

```markdown
## 매장 데이터 수집

- 브랜드: BBQ치킨 (bbq)
- 매장 수: 2,051
- 수집일: 2026-03-17
- 원본 URL: https://www.bbq.co.kr/shop/shopList.asp
```

### 스프레드시트 업데이트

PR 제출 후, 아래 스프레드시트에 업데이트 내역을 반영합니다:

https://docs.google.com/spreadsheets/d/17c1ZKs1Y0DfunJhJ5F8l7p-2sDDaDhO9BZtLj87SjyQ/edit?usp=sharing

---

## 검증 항목

검증 스크립트(`scripts/validate-store-data.ts`)가 확인하는 항목:

| 항목 | 설명 |
|------|------|
| JSON Schema 준수 | `meta/store_schema.json` 기준 |
| 필수 필드 | name, address, lat, lng, region, district 누락 체크 |
| 좌표 범위 | lat 33~39, lng 124~132 (한국 범위) |
| 중복 | name + address 동일한 레코드 |
| 추가 필드 | 스키마에 없는 필드 포함 여부 |
| contact 형식 | 전화번호 패턴 확인 |

---

## 트러블슈팅

### 페이지 분석 실패 (`fieldQuality: none/poor`)

- 매장찾기 URL이 실제 매장 목록이 아닐 수 있음
- 검색 결과 페이지나 필터가 적용된 URL을 사용해 보세요
- JS 렌더링이 필요한 페이지는 자동으로 `--mode rendered`로 재시도됩니다

### 좌표가 없는 사이트

- 일부 프랜차이즈 사이트는 좌표를 제공하지 않음
- 주소 기반 지오코딩이 필요할 수 있음 (별도 작업)

### robots.txt 차단

- `robotsAllowed: false` 경고가 나오면 사이트 정책을 확인하세요
- 위저드가 경고를 표시하고 진행 여부를 묻습니다

### 추출 건수가 0

- URL이 올바른 매장 목록 페이지인지 확인
- 페이지가 로그인이나 특정 파라미터를 요구하는지 확인

### 5% 이상 오류로 추출 중단

- 필수 필드 매핑이 올바른지 재확인
- 일부 매장의 데이터 형식이 다를 수 있음 — 셀렉터 조정 필요

---

## 참고 파일

| 파일 | 설명 |
|------|------|
| `meta/store_schema.json` | 출력 데이터 JSON Schema |
| `config/crawl_rules.json` | 수집 규칙 (필드 매핑, 후처리, 검증) |
| `skills/franchise/SKILL.md` | 위저드 스킬 정의 |
| `data/examples/` | 기존 수집 데이터 샘플 (참고용) |
