// Maps topic category values (slugs) to the names shown on screen. Unknown values are shown as they are.
const LABELS: Record<string, string> = {
  account: "Account",
  billing: "Billing",
  plans: "Plans",
  collaboration: "Collaboration",
  integrations: "Integrations",
  security: "Security",
};

export function topicLabel(name: string | null | undefined) {
  if (!name) return "Other";
  return LABELS[name] ?? name;
}
