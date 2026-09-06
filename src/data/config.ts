// 게임 전역 설정. 미확정 수치는 임시값 10 (사용자 규칙 2026-09-06).

export const CONFIG = {
  grid: { w: 10, h: 10 }, // 임시: Obsidian "n x m" 미정 → =10
  tickHz: 10,             // 초당 시뮬 틱 (속도 등급 0.1초 = 1틱)

  startingGold: 0,        // Obsidian 명시값
  freeConveyors: 3,       // Obsidian 명시값: 무료 컨베이어 3개
  conveyorCost: 10,       // 임시 =10 (타일당)
  buildingCost: 10,       // 임시 =10 (Node/Exporter 추가 구매)

  // 시작 킷: Node(칩) 1 + Exporter 1 배치. 사이 3칸은 플레이어가 무료 컨베이어로 연결.
  // 칩 Node는 동쪽(Exporter 방향)을 향함. 플레이어가 컨베이어 3개를 동쪽 방향으로 이어주면 연결됨.
  startKit: {
    node: { resource: 'chip', tile: [2, 4] as readonly [number, number], dir: 'E' as const },
    exporter: { tile: [6, 4] as readonly [number, number] },
  },
} as const;
