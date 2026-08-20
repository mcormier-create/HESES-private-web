import type { AlertsService } from "../alerts/alerts.service.js";
import type { MailDraftsService } from "../mail-drafts/mail-drafts.service.js";
import type { ProjectsService } from "../projects/projects.service.js";
import { OrderAckMatcher } from "./order-ack.matcher.js";
import { OrderAckParser } from "./order-ack.parser.js";
import type { GraphMessage } from "./outlook-graph.client.js";

export type ImportResultItem = {
  messageId: string;
  subject: string;
  status: "SKIPPED" | "UNMATCHED" | "IMPORTED" | "ERROR";
  reason?: string;
  projectId?: string;
  carelOrderNumber?: string;
  clientPurchaseOrder?: string;
  expectedDeliveryDate?: string;
  alertCreated?: boolean;
  draftCreated?: boolean;
};

export class OutlookImportService {
  private readonly parser = new OrderAckParser();
  private readonly matcher = new OrderAckMatcher();

  constructor(
    private readonly projectsService: ProjectsService,
    private readonly alertsService: AlertsService,
    private readonly mailDraftsService: MailDraftsService
  ) {}

  importOrderAcknowledgements(messages: GraphMessage[], thresholdDays: number): ImportResultItem[] {
    const results: ImportResultItem[] = [];

    for (const message of messages) {
      const body = message.bodyPreview ?? "";
      if (!this.parser.isOrderAcknowledgement(message.subject, body)) {
        results.push({
          messageId: message.id,
          subject: message.subject,
          status: "SKIPPED",
          reason: "NOT_ORDER_ACK"
        });
        continue;
      }

      const extraction = this.parser.parseFromText(`${message.subject}\n${body}`);
      if (!extraction) {
        results.push({
          messageId: message.id,
          subject: message.subject,
          status: "ERROR",
          reason: "EXTRACTION_FAILED"
        });
        continue;
      }

      const project = this.matcher.match(this.projectsService.list(), extraction);
      if (!project) {
        results.push({
          messageId: message.id,
          subject: message.subject,
          status: "UNMATCHED",
          carelOrderNumber: extraction.carelOrderNumber,
          clientPurchaseOrder: extraction.clientPurchaseOrder,
          expectedDeliveryDate: extraction.expectedDeliveryDate
        });
        continue;
      }

      let updatedStatus = false;
      try {
        this.projectsService.updateStatus(project.id, "ORDER_ACK_RECEIVED");
        updatedStatus = true;
      } catch {
        updatedStatus = false;
      }

      if (extraction.expectedDeliveryDate) {
        project.expectedDeliveryDate = extraction.expectedDeliveryDate;
      }

      const alert = this.alertsService.createDelayAlertIfNeeded(project, thresholdDays);
      let draftCreated = false;
      if (alert) {
        this.mailDraftsService.createDelayFollowUp(project);
        draftCreated = true;
      }

      results.push({
        messageId: message.id,
        subject: message.subject,
        status: "IMPORTED",
        reason: updatedStatus ? undefined : "STATUS_NOT_UPDATED",
        projectId: project.id,
        carelOrderNumber: extraction.carelOrderNumber,
        clientPurchaseOrder: extraction.clientPurchaseOrder,
        expectedDeliveryDate: extraction.expectedDeliveryDate,
        alertCreated: Boolean(alert),
        draftCreated
      });
    }

    return results;
  }
}
