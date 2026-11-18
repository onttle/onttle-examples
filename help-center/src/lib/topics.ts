// topic 카테고리 값(영문 slug)을 화면에 보일 한국어 이름으로. 모르는 값은 그대로 보인다.
const LABELS: Record<string, string> = {
  account: "계정",
  billing: "결제",
  plans: "요금제",
  collaboration: "협업",
  integrations: "연동",
  security: "보안",
};

export function topicLabel(name: string | null | undefined) {
  if (!name) return "기타";
  return LABELS[name] ?? name;
}
