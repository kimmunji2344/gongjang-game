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
  storageCapacity: 10,   // Storage 1개가 담는 최대 개수
  shutdownWeight: 10,    // Converter 재고 누적 무게 한도 — 도달 시 셧다운

  // 시작 킷: Node(칩) 1 + Exporter 1 배치. 사이 3칸은 플레이어가 무료 컨베이어로 연결.
  // 칩 Node는 동쪽(Exporter 방향)을 향함. 플레이어가 컨베이어 3개를 동쪽 방향으로 이어주면 연결됨.
  startKit: {
    node: { resource: 'chip', tile: [2, 4] as readonly [number, number], dir: 'E' as const },
    exporter: { tile: [6, 4] as readonly [number, number] },
  },
} as const;
