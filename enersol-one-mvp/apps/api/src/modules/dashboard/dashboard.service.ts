import type { DashboardSnapshot, Project } from "../projects/project.types.js";

export class DashboardService {
  build(projects: Project[], aiAlertsCount: number): DashboardSnapshot {
    const pendingOrders = projects.filter((p) =>
      ["CLIENT_PO_RECEIVED", "ORDER_SENT_TO_CAREL", "ORDER_ACK_RECEIVED"].includes(p.status)
    ).length;

    const delayedDeliveries = projects.filter((p) => {
      if (!p.expectedDeliveryDate) return false;
      return new Date(p.expectedDeliveryDate).getTime() < Date.now() && p.status !== "DELIVERED";
    }).length;

    return {
      activeProjects: projects.filter((p) => p.status !== "COMPLETED").length,
      pendingOrders,
      delayedDeliveries,
      weeklyShipments: 0,
      quotationsToFollowUp: projects.filter((p) => p.status === "QUOTATION_SENT").length,
      aiAlerts: aiAlertsCount
    };
  }
}
