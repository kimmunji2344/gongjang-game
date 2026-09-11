// 게임 전역 설정. 미확정 수치는 임시값 10 (사용자 규칙 2026-09-06).

export const CONFIG = {
  grid: { w: 10, h: 10 }, // 임시: Obsidian "n x m" 미정 → =10 (= 구역 1개 크기)
  tickHz: 10,             // 초당 시뮬 틱 (속도 등급 0.1초 = 1틱)

  // M3-A 확장 구역 (십자 3×3). 중앙 구역 = 타일 [0..9, 0..9], 시작부터 소유.
  zone: { size: 10, span: 1 }, // span=1 → 구역 좌표 -1..1 (3×3)
  zoneCostBase: 10,            // 구역 비용 = base × 현재 소유 구역 수 (선형 임시, 실제 지수곡선은 밸런싱 때)
  resourceUnlockChips: 10,     // 누적 칩 판매 이만큼이면 A1·A2 해금 (임시)

  startingGold: 0,        // Obsidian 명시값
  freeConveyors: 3,       // Obsidian 명시값: 무료 컨베이어 3개
  conveyorCost: 10,       // 임시 =10 (타일당)
  buildingCost: 10,       // 임시 =10 (Node/Exporter 추가 구매)
  converterCost: 10,      // 임시 =10 (Converter 설치/철거)
  storageCost: 10,        // 임시 =10 (Storage 설치/철거)
  autosaveMs: 30000,      // 자동저장 주기 (Code.md 확정: 30초)

  // M2 가공·저장·셧다운 (전부 임시 =10, Obsidian 확정 시 교체)
  storageCapacity: 10,   // Storage 레벨 1 기본 용량 (자원 개수 합계 기준)
  shutdownWeight: 10,    // Converter 재고 누적 무게 한도 — 도달 시 셧다운

  // M3-B 레벨링 — 전부 임시. 스펙 "레벨-스탯 매핑표는 추후 오브젝트별 개별 결정".
  upgradeCostBase: 10,        // Node/Storage 업그레이드 골드 = base × 현재 레벨
  upgradeMaterial: 'B1',      // 업그레이드에 소모하는 가공품 (임시 — 용어정리 확정 시 교체)
  upgradeMaterialPerLevel: 1, // 업그레이드 재료 개수 = 이 값 × 현재 레벨 (Storage 에서 인출)
  nodeGradePerLevel: 1,       // Node 레벨당 생산 등급 감소 (= 빨라짐), 등급 1 에서 캡
  storageCapPerLevel: 10,     // Storage 레벨당 용량 증가
  exporterLevelUpBase: 10,    // Exporter 레벨업 필요 누적 판매 수 = base × 현재 레벨
  exporterLevelBonus: 0.1,    // Exporter 레벨당 판매 수익률 +10%
  tierPriceBonus: 0.5,        // 가공 tier 당 판매가 +50%

  // M6 NPC 일일 퀘스트 — 임시. 스펙 "알파(보너스)" 수치 미정.
  npcQuestQty: 10,       // 하루 요청 수량 (임시 =10)
  npcAlphaMultiplier: 2, // 보상 = 기본 판매가 × 수량 × 이 배수 (임시 =2, "기본가의 2배")

  // 시작 킷: Node(칩) 1 + Exporter 1 배치. 사이 3칸은 플레이어가 무료 컨베이어로 연결.
  // 칩 Node는 동쪽(Exporter 방향)을 향함. 플레이어가 컨베이어 3개를 동쪽 방향으로 이어주면 연결됨.
  startKit: {
    node: { resource: 'chip', tile: [2, 4] as readonly [number, number], dir: 'E' as const },
    exporter: { tile: [6, 4] as readonly [number, number] },
  },
} as const;
