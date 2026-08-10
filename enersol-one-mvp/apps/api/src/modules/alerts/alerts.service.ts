import type { Project } from "../projects/project.types.js";

export type AlertItem = {
  id: string;
  projectId: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
};

export class AlertsService {
  private readonly alerts: AlertItem[] = [];

  list(): AlertItem[] {
    return this.alerts;
  }

  createDelayAlertIfNeeded(project: Project, thresholdDays: number): AlertItem | null {
    if (!project.expectedDeliveryDate) return null;

    const expected = new Date(project.expectedDeliveryDate).getTime();
    const now = Date.now();
    const deltaDays = Math.floor((expected - now) / (1000 * 60 * 60 * 24));

    if (deltaDays < -Math.abs(thresholdDays)) {
      const alert: AlertItem = {
        id: crypto.randomUUID(),
        projectId: project.id,
        level: "CRITICAL",
        message: `Expected delivery is late by ${Math.abs(deltaDays)} day(s).`,
        createdAt: new Date().toISOString()
      };
      this.alerts.push(alert);
      return alert;
    }

    return null;
  }
}
