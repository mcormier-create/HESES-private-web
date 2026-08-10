export const PROJECT_STATUSES = [
  "QUOTATION",
  "QUOTATION_SENT",
  "CLIENT_PO_RECEIVED",
  "ORDER_SENT_TO_CAREL",
  "ORDER_ACK_RECEIVED",
  "ENGINEERING",
  "PRODUCTION",
  "SHIPPED",
  "RECEIVED",
  "DELIVERED",
  "COMMISSIONING",
  "COMPLETED"
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

export const DOCUMENT_TYPES = [
  "QUOTATION",
  "PURCHASE_ORDER",
  "ORDER_ACKNOWLEDGEMENT",
  "DRAWING",
  "MANUAL",
  "INVOICE",
  "EMAIL",
  "PHOTO"
] as const;

export type DocumentType =
  | "QUOTATION"
  | "PURCHASE_ORDER"
  | "ORDER_ACKNOWLEDGEMENT"
  | "DRAWING"
  | "MANUAL"
  | "INVOICE"
  | "EMAIL"
  | "PHOTO";

export type Project = {
  id: string;
  projectNumber: string;
  projectName: string;
  clientName: string;
  clientEmail: string;
  engineer: string;
  contractor: string;
  salesRep: string;
  owner: string;
  clientPo: string;
  carelPo: string;
  status: ProjectStatus;
  priority: ProjectPriority;
  expectedDeliveryDate: string;
  notes: string;
};

export type DashboardSnapshot = {
  activeProjects: number;
  pendingOrders: number;
  delayedDeliveries: number;
  weeklyShipments: number;
  quotationsToFollowUp: number;
  aiAlerts: number;
};
