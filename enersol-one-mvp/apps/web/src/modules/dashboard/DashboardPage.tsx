import { useEffect, useState } from "react";
import { KpiCard } from "../../components/KpiCard";
import { apiClient } from "../../services/apiClient";
import type { DashboardSnapshot } from "../../types/domain";

const emptyData: DashboardSnapshot = {
  activeProjects: 0,
  pendingOrders: 0,
  delayedDeliveries: 0,
  weeklyShipments: 0,
  quotationsToFollowUp: 0,
  aiAlerts: 0
};

export function DashboardPage() {
  const [data, setData] = useState<DashboardSnapshot>(emptyData);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [lastRefresh, setLastRefresh] = useState<string>("");

  async function loadDashboard() {
    setIsLoading(true);
    setError("");
    try {
      const snapshot = await apiClient.getDashboard();
      setData(snapshot);
      setLastRefresh(new Date().toISOString());
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Dashboard load failed");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadDashboard();
  }, []);

  const delayedTone = data.delayedDeliveries > 0 ? "high" : "low";
  const alertTone = data.aiAlerts > 0 ? "high" : "low";
  const pendingTone = data.pendingOrders > 0 ? "medium" : "low";
  const operationalPressure = data.delayedDeliveries * 3 + data.aiAlerts * 2 + data.pendingOrders;
  const operationalScore = Math.max(0, 100 - operationalPressure * 5);
  const scoreTone = operationalScore >= 80 ? "good" : operationalScore >= 55 ? "watch" : "critical";
  const scoreMessage =
    scoreTone === "good"
      ? "Flux stable"
      : scoreTone === "watch"
        ? "Surveillance recommandee"
        : "Intervention immediate";

  const priorities: string[] = [];
  if (data.delayedDeliveries > 0) priorities.push(`${data.delayedDeliveries} livraison(s) a traiter en priorite`);
  if (data.pendingOrders > 0) priorities.push(`${data.pendingOrders} commande(s) en attente de suivi`);
  if (data.quotationsToFollowUp > 0) priorities.push(`${data.quotationsToFollowUp} soumission(s) a relancer`);
  if (priorities.length === 0) priorities.push("Aucun blocage critique detecte pour le moment");

  return (
    <section className="dashboard-shell">
      <div className="dashboard-hero">
        <div className="dashboard-hero-copy">
          <p className="dashboard-kicker">Operations Enersol</p>
          <h2 className="section-heading">Tableau de bord</h2>
          <p className="dashboard-subtitle">Vue consolidee des projets, commandes et alertes IA.</p>
          <div className="dashboard-hero-tags">
            <span>Suivi en temps reel</span>
            <span>Priorites automatisees</span>
            <span>Decision rapide</span>
          </div>
        </div>
        <div className="dashboard-actions">
          <div className={`score-panel score-panel-${scoreTone}`}>
            <div className="score-ring" role="img" aria-label={`Score operationnel ${operationalScore} sur 100`}>
              <strong>{operationalScore}</strong>
              <span>/100</span>
            </div>
            <div>
              <p className="score-title">Score operationnel</p>
              <p className="score-message">{scoreMessage}</p>
            </div>
          </div>
          <button className="refresh-button" type="button" onClick={() => void loadDashboard()} disabled={isLoading}>
            {isLoading ? "Chargement..." : "Rafraichir"}
          </button>
          <p className="dashboard-refresh-meta">
            Derniere synchro: {lastRefresh ? new Date(lastRefresh).toLocaleTimeString() : "-"}
          </p>
        </div>
      </div>

      <div className="dashboard-chip-row">
        <div className={`status-chip status-chip-${pendingTone}`}>Commandes en attente: {data.pendingOrders}</div>
        <div className={`status-chip status-chip-${delayedTone}`}>Retards: {data.delayedDeliveries}</div>
        <div className={`status-chip status-chip-${alertTone}`}>Alertes IA: {data.aiAlerts}</div>
      </div>

      {error ? <p style={{ color: "#b00020" }}>Erreur: {error}</p> : null}
      <div className="kpi-grid">
        <KpiCard title="Projets actifs" value={data.activeProjects} tone="ocean" hint="Pipeline en execution" />
        <KpiCard
          title="Commandes en attente"
          value={data.pendingOrders}
          tone="sun"
          emphasis={data.pendingOrders > 0 ? "warn" : "stable"}
          hint="A valider avec fournisseurs"
        />
        <KpiCard
          title="Retards de livraison"
          value={data.delayedDeliveries}
          tone="ember"
          emphasis={data.delayedDeliveries > 0 ? "warn" : "stable"}
          hint="Risque de depassement"
        />
        <KpiCard title="Expeditions semaine" value={data.weeklyShipments} tone="leaf" hint="Sorties prevues" />
        <KpiCard
          title="Soumissions a relancer"
          value={data.quotationsToFollowUp}
          tone="iris"
          emphasis={data.quotationsToFollowUp > 0 ? "up" : "stable"}
          hint="Opportunites commerciales"
        />
        <KpiCard
          title="Alertes IA"
          value={data.aiAlerts}
          tone="mint"
          emphasis={data.aiAlerts > 0 ? "warn" : "stable"}
          hint="Signaux detectes"
        />
      </div>

      <div className="dashboard-bottom-grid">
        <article className="dashboard-note-card">
          <h3>Priorites du jour</h3>
          <ul>
            {priorities.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
        <article className="dashboard-note-card">
          <h3>Etat plateforme</h3>
          <p>Suivi automatique IA actif et rafraichissement manuel disponible a tout moment.</p>
          <p>
            KPI visibles: Projets actifs, commandes en attente, retards, expeditions semaine, soumissions a relancer,
            alertes IA.
          </p>
        </article>
      </div>
    </section>
  );
}
