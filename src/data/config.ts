// 게임 전역 설정. 미확정 수치는 임시값 10 (사용자 규칙 2026-09-06).
// 2026-09-17: "공장 게임 확정 대기 목록" 1차 확정 반영 — 자원 도감 완성 전까지도 여전히 임시인 값은 주석에 명시.

export const CONFIG = {
  tickHz: 10, // 초당 시뮬 틱 (속도 등급 0.1초 = 1틱)

  // 확장 구역. 중앙 구역 = 타일 [0..4, 0..4], 시작부터 소유.
  // 2026-09-20 확정: 구역 크기 10×10→5×5로 축소, span 1→10으로 확대(가로세로 10구역씩, 최대 21×21구역).
  zone: { size: 5, span: 10 },
  zoneCostBase: 1000,    // 확정 (2026-09-17): 1번째 구역 비용
  zoneCostGrowth: 1.15,  // 임시 적용 (사용자: "게임 진행해 보고 체감상으로 조절할게") — 비용(n) = base × growth^(n-1)
  resourceUnlockChips: 10,     // 누적 칩 판매 이만큼이면 스크랩·데브리 해금 (여전히 임시)

  startingGold: 0,        // Obsidian 명시값
  freeConveyors: 2,       // 2026-09-20: 구역 5×5 축소로 시작 킷 간격이 3칸→2칸이 되어 맞춰 조정
  conveyorCost: 5,        // 확정 (2026-09-17)
  nodeCostBase: 15,       // 확정: Node 설치비 = 이 값 × 현재 보유 Node 개수 (구역비용과 동일한 방식, 살수록 오름)
  exporterCost: 20,       // 확정 (2026-09-17), 고정가
  converterCost: 30,      // 확정 (2026-09-17), 고정가
  storageCost: 5,         // 확정 (2026-09-17), 고정가
  removalFeeRatio: 0.5,   // 확정: 철거비 = 그 순간 설치비 × 이 비율 (기존 100%에서 변경)
  autosaveMs: 30000,      // 자동저장 주기 (Code.md 확정: 30초)

  // M2 가공·저장·셧다운 — 자원 도감(캡슐/모듈 등) 완성 후 정하기로 함, 전부 임시 유지
  storageCapacity: 10,   // Storage 레벨 1 기본 용량 (자원 개수 합계 기준) — 임시
  shutdownWeight: 10,    // Converter 재고 누적 무게 한도 — 도달 시 셧다운, 임시

  // M3-B 레벨링 (Node/Storage/컨베이어 공통) — 확정 (2026-09-17)
  // 1~5레벨(레벨업 전 기준): 골드만, base × growth^(level-1). 6~10레벨: 재료 미정이라 legacy 공식 임시 유지.
  upgradeCostBase: 50,          // 1~5레벨 구간 골드 공식의 기준값
  upgradeCostGrowth: 1.5,       // 1~5레벨 구간 레벨당 배수
  upgradeCostLegacyPerLevel: 10, // 6~10레벨 구간(재료 미정 동안 유지하는 옛 공식) 골드 = 이 값 × 레벨
  upgradeMaterial: 'core',      // 6~10레벨 구간에서만 쓰는 재료(재료 자체도 최종 확정 아님, 자원 도감 완성 후 교체 가능)
  upgradeMaterialPerLevel: 1,   // 위 재료 개수 = 이 값 × 현재 레벨
  maxLevel: 10,                 // 확정: Node/Storage/컨베이어/Exporter 공통 레벨 상한
  nodeGradePerLevel: 1,         // Node 레벨당 생산 등급 감소량 — "모르겠음" 답변, 기존값 유지(임시)
  storageCapPerLevel: 250,      // 확정 (2026-09-17)
  exporterLevelThresholds: [50, 100, 200, 500, 1000, 2500, 6000, 10000, 100000] as const, // 확정: n번째 값 = n레벨→n+1레벨 필요 누적 판매 수
  exporterRevenuePctPerLevel: 0.01, // 확정: 레벨당 수익률 = +레벨×1% (레벨5=+5%, 레벨10=+10%)
  tierPriceBonus: 0,            // tier 효과는 resources.ts 판매가 표에 이미 반영(2026-10-25) — 별도 배율 없음

  // M6 NPC 일일 퀘스트 — 확정 (2026-09-17). 특정 자원 가중치는 자원 도감 완성 후.
  npcQuestQty: 3,        // 하루 요청 수량
  npcAlphaMultiplier: 3, // 보상 = 기본 판매가 × 수량 × 이 배수

  // 컨베이어 업그레이드 (신규, 확정 2026-09-17) — 골드 공식은 위 upgradeCostBase/Growth 재사용.
  // 2026-09-20 확정: 레벨1~10 등급을 표로 직접 지정(등급→초 매핑: gradeToTicks 참고).
  conveyorGradeTable: [15, 14, 13, 12, 11, 10, 8, 6, 4, 2] as const,

  // 시작 킷: Node(칩) 1 + Exporter 1 배치. 사이 2칸은 플레이어가 무료 컨베이어로 연결.
  // 2026-09-20 확정: 구역이 5×5(타일 0~4)로 줄어들어 좌표 재배치(간격은 유지, 3칸→2칸).
  // 칩 Node는 동쪽(Exporter 방향)을 향함. 플레이어가 컨베이어 2개를 동쪽 방향으로 이어주면 연결됨.
  startKit: {
    node: { resource: 'chip', tile: [0, 2] as readonly [number, number], dir: 'E' as const },
    exporter: { tile: [3, 2] as readonly [number, number] },
  },
} as const;
