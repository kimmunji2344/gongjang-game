// 자원/가공품 데이터 표. 코드에 하드코딩하지 않고 여기서만 관리한다.
// (Obsidian "자원 데이터 설계": 새 자원은 이 표에 한 줄 추가로 끝나야 함)
// 2026-10-25: Obsidian <자원 정리표(엑셀)> Resource_Synthesis_Bilingual_100.xlsx 100종 반영.
// 판매가·무게는 엑셀에 없어 tier 별 임시 표(확정 대기)로 채움 — 개별 조정은 아래 줄을 직접 수정.
// 판매가에는 tier 효과가 이미 들어 있어 CONFIG.tierPriceBonus 는 0 이다.

export type ResourceDef = {
  readonly id: string;
  readonly name: string;         // 표시명 (엑셀 한글 발음)
  readonly produceGrade: number; // Node 기본 생산 속도 등급 (1~30) — 원자재만 의미
  readonly sellPrice: number;    // Exporter 기본 판매가 (G)
  readonly weight: number;       // Converter 셧다운 누적용 무게
  readonly tier: number;         // 0 = 원자재, 1+ = 가공 단계
};

export const RESOURCES: Record<string, ResourceDef> = {

  // --- Tier 0 (원자재, Node 로 생산) ---
  scrap: { id: 'scrap', name: '스크랩', produceGrade: 20, sellPrice: 8, weight: 7, tier: 0 },
  debris: { id: 'debris', name: '데브리', produceGrade: 20, sellPrice: 20, weight: 15, tier: 0 },
  chip: { id: 'chip', name: '칩', produceGrade: 20, sellPrice: 5, weight: 5, tier: 0 },

  // --- Tier 1 ---
  metal: { id: 'metal', name: '메탈', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },
  rock: { id: 'rock', name: '락', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },
  wire: { id: 'wire', name: '와이어', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },
  alloy: { id: 'alloy', name: '얼로이', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },
  core: { id: 'core', name: '코어', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },
  pulse: { id: 'pulse', name: '펄스', produceGrade: 20, sellPrice: 30, weight: 10, tier: 1 },

  // --- Tier 2 ---
  frame: { id: 'frame', name: '프레임', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  hull: { id: 'hull', name: '헐', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  armor: { id: 'armor', name: '아머', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  dust: { id: 'dust', name: '더스트', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  meteor: { id: 'meteor', name: '미티어', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  void: { id: 'void', name: '보이드', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  relay: { id: 'relay', name: '릴레이', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  matrix: { id: 'matrix', name: '매트릭스', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  gear: { id: 'gear', name: '기어', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  plate: { id: 'plate', name: '플레이트', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  cable: { id: 'cable', name: '케이블', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  grid: { id: 'grid', name: '그리드', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  cell: { id: 'cell', name: '셀', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  drive: { id: 'drive', name: '드라이브', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  sensor: { id: 'sensor', name: '센서', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  beacon: { id: 'beacon', name: '비콘', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  tuner: { id: 'tuner', name: '튜너', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },
  valve: { id: 'valve', name: '밸브', produceGrade: 20, sellPrice: 80, weight: 15, tier: 2 },

  // --- Tier 3 ---
  mesh: { id: 'mesh', name: '메쉬', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  shield: { id: 'shield', name: '실드', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  base: { id: 'base', name: '베이스', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  panel: { id: 'panel', name: '패널', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  pump: { id: 'pump', name: '펌프', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  scope: { id: 'scope', name: '스코프', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  frost: { id: 'frost', name: '프로스트', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  shard: { id: 'shard', name: '샤드', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  essence: { id: 'essence', name: '에센스', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  coil: { id: 'coil', name: '코일', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  signal: { id: 'signal', name: '시그널', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  node: { id: 'node', name: '노드', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  lens: { id: 'lens', name: '렌즈', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  logic: { id: 'logic', name: '로직', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  module: { id: 'module', name: '모듈', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  drone: { id: 'drone', name: '드론', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  cover: { id: 'cover', name: '커버', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  probe: { id: 'probe', name: '프로브', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  circuit: { id: 'circuit', name: '서킷', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  solenoid: { id: 'solenoid', name: '솔레노이드', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  fiber: { id: 'fiber', name: '파이버', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  battery: { id: 'battery', name: '배터리', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  unit: { id: 'unit', name: '유닛', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  beam: { id: 'beam', name: '빔', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  filter: { id: 'filter', name: '필터', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  booster: { id: 'booster', name: '부스터', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  prism: { id: 'prism', name: '프리즘', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },
  trap: { id: 'trap', name: '트랩', produceGrade: 20, sellPrice: 200, weight: 20, tier: 3 },

  // --- Tier 4 ---
  meter: { id: 'meter', name: '미터', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  station: { id: 'station', name: '스테이션', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  vent: { id: 'vent', name: '벤트', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  intake: { id: 'intake', name: '인테이크', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  automa: { id: 'automa', name: '오토마', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  reactor: { id: 'reactor', name: '리액터', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  magnet: { id: 'magnet', name: '마그넷', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  receiver: { id: 'receiver', name: '리시버', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  frequency: { id: 'frequency', name: '프리퀀시', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  scout: { id: 'scout', name: '스카우트', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  accelerator: { id: 'accelerator', name: '엑셀러레이터', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  detector: { id: 'detector', name: '디텍터', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  purifier: { id: 'purifier', name: '퓨리파이어', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  engine: { id: 'engine', name: '엔진', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  atlas: { id: 'atlas', name: '아틀라스', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  kernel: { id: 'kernel', name: '커널', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  anchor: { id: 'anchor', name: '앵커', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  pipe: { id: 'pipe', name: '파이프', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  gyro: { id: 'gyro', name: '자이로', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  torch: { id: 'torch', name: '토치', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  generator: { id: 'generator', name: '제너레이터', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  chime: { id: 'chime', name: '차임', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  hologram: { id: 'hologram', name: '홀로그램', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  vault: { id: 'vault', name: '볼트', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },
  warp: { id: 'warp', name: '워프', produceGrade: 20, sellPrice: 500, weight: 25, tier: 4 },

  // --- Tier 5 ---
  echo: { id: 'echo', name: '에코', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  remnant: { id: 'remnant', name: '렘넌트', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  lantern: { id: 'lantern', name: '랜턴', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  warmth: { id: 'warmth', name: '웜쓰', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  whisper: { id: 'whisper', name: '위스퍼', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  silence: { id: 'silence', name: '사일런스', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  catcher: { id: 'catcher', name: '캐처', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  rune: { id: 'rune', name: '룬', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  sphere: { id: 'sphere', name: '스피어', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  melody: { id: 'melody', name: '멜로디', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  relic: { id: 'relic', name: '렐릭', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  portal: { id: 'portal', name: '포탈', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  drift: { id: 'drift', name: '드리프트', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  haven: { id: 'haven', name: '헤이븐', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  aurora: { id: 'aurora', name: '오로라', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  lullaby: { id: 'lullaby', name: '러러바이', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  terrarium: { id: 'terrarium', name: '테라리움', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  globe: { id: 'globe', name: '글로브', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  refuge: { id: 'refuge', name: '레퓨지', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
  harmony: { id: 'harmony', name: '하모니', produceGrade: 20, sellPrice: 1500, weight: 30, tier: 5 },
};
