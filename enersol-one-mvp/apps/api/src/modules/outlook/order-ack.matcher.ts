import type { Project } from "../projects/project.types.js";
import type { OrderAckExtraction } from "./order-ack.parser.js";

export class OrderAckMatcher {
  match(projects: Project[], extraction: OrderAckExtraction): Project | undefined {
    const carelKey = extraction.carelOrderNumber.trim().toUpperCase();
    const clientPoKey = extraction.clientPurchaseOrder.trim().toUpperCase();

    return projects.find(
      (project) =>
        project.carelPo.trim().toUpperCase() === carelKey ||
        project.clientPo.trim().toUpperCase() === clientPoKey
    );
  }
}
