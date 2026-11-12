const internalNotes = [
  "실제 시행일 및 공식 현행 기준 확인 필요",
  "이미지 기준의 실제 적용 시점 확인 필요",
  "실제 변경 시행일 확인 필요",
  "사용자 제공 현장 자료 · 공식 확인 필요",
  "제공된 제조 예시 · 공식 기준 확인 필요",
  "원본 이미지 판독 자료. 실제 현행 레시피 및 프로모션 연도 확인 필요.",
  "이미지 HOT V 칼로리 숫자 일부 판독 불확실 → 확인 필요.",
  "- T/G/V 수량 매핑을 적용하되 제공 사이즈의 최신 공식 검증 상태는 별도로 유지한다.",
];

export function displayNote(note: string) {
  return internalNotes
    .reduce((copy, line) => copy.replaceAll(line, ""), note)
    .trim();
}
