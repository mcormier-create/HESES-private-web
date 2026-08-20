type KpiCardProps = {
  title: string;
  value: number;
  tone?: "ocean" | "leaf" | "sun" | "ember" | "iris" | "mint";
  hint?: string;
  emphasis?: "stable" | "up" | "warn";
};

export function KpiCard({ title, value, tone = "ocean", hint, emphasis = "stable" }: KpiCardProps) {
  const badge = emphasis === "warn" ? "Attention" : emphasis === "up" ? "Action" : "Stable";

  return (
    <div className={`kpi-card tone-${tone}`}>
      <div className="kpi-title">{title}</div>
      <div className="kpi-value">{value}</div>
      <div className={`kpi-badge kpi-badge-${emphasis}`}>{badge}</div>
      {hint ? <div className="kpi-hint">{hint}</div> : null}
      <div className="kpi-footer">Mise a jour operationnelle</div>
    </div>
  );
}
