# Kimi K2.5 Turbo - OpenCode Skill Pack

GLM 5.1 주간 할당량 소진 시 Kimi K2.5 Turbo(Fireworks Fire Pass)로 전환하기 위한 보완 스킬 세트.
Superpowers와 함께 사용하도록 설계됨.

## 포함된 스킬

| 스킬 | 보완 대상 | 활성화 시점 |
|------|----------|------------|
| `kimi-model-awareness` | 전반적 행동 교정 | **항상** |
| `token-budget` | 과도한 토큰 생성 (6x) | **항상** |
| `backend-discipline` | 백엔드 과설계 경향 | 백엔드 작업 시 |
| `anti-drift-guard` | 지시 무시 / 구현 드리프트 | 다단계 구현 시 |
| `swarm-consistency` | 병렬 에이전트 간 불일치 | 서브에이전트 위임 시 |

## 설치

### 방법 1: 프로젝트 로컬 (권장)
```bash
# 프로젝트 루트에서
mkdir -p .opencode/skills/kimi-guard

# 스킬 파일 복사
cp -r /path/to/kimi-opencode-skills/* .opencode/skills/kimi-guard/
```

### 방법 2: 글로벌 설치
```bash
# 글로벌 스킬 디렉토리에 복사
mkdir -p ~/.config/opencode/skills/kimi-guard
cp -r /path/to/kimi-opencode-skills/* ~/.config/opencode/skills/kimi-guard/
```

## OpenCode 설정

`opencode.json` 에서 모델을 Kimi K2.5 Turbo로 전환:

```jsonc
{
  "provider": {
    "fireworks": {
      "apiKey": "YOUR_FIREWORKS_API_KEY"
    }
  },
  "model": {
    // Kimi K2.5 Turbo (Fire Pass 대상)
    "id": "accounts/fireworks/routers/kimi-k2p5-turbo",
    "provider": "fireworks"
  },
  "plugin": [
    "superpowers@git+https://github.com/obra/superpowers.git"
  ]
  // 스킬은 .opencode/skills/ 에서 자동 감지됨
}
```

## GLM ↔ Kimi 전환 팁

GLM 5.1 할당량이 복구되면 다시 전환:

```jsonc
{
  "model": {
    // GLM 5.1 (Z.AI)
    "id": "glm-5.1", 
    "provider": "zai"
  }
}
```

Kimi 스킬들은 GLM 사용 시 무해함 (GLM이 이미 잘하는 영역이라 무시됨).
별도로 제거할 필요 없이 공존 가능.

## 작업 유형별 권장 전략

### Kimi가 잘하는 작업 (자신 있게 맡기기)
- React/Vue 컴포넌트 생성
- CSS/Tailwind 스타일링
- UI 스크린샷 → 코드 변환
- 알고리즘 문제 풀기
- 문서/PDF 파싱

### Kimi가 조심해야 하는 작업 (스킬 활성 필수)
- REST API / GraphQL 리졸버 설계 → `backend-discipline`
- DB 스키마 마이그레이션 → `backend-discipline` + `anti-drift-guard`
- 멀티파일 리팩토링 → `anti-drift-guard`
- 마이크로서비스 간 통신 → `swarm-consistency`

### Kimi 대신 GLM 복구를 기다리는 게 나은 작업
- 복잡한 시스템 아키텍처 설계 (8시간 장기 태스크)
- 대규모 코드베이스 리팩토링
- 성능 최적화 반복 작업 (GLM의 장기 실행이 핵심)
