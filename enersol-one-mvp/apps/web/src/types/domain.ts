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

export type ProjectStatus =
  | "QUOTATION"
  | "QUOTATION_SENT"
  | "CLIENT_PO_RECEIVED"
  | "ORDER_SENT_TO_CAREL"
  | "ORDER_ACK_RECEIVED"
  | "ENGINEERING"
  | "PRODUCTION"
  | "SHIPPED"
  | "RECEIVED"
  | "DELIVERED"
  | "COMMISSIONING"
  | "COMPLETED";

export const PROJECT_PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"] as const;
export type ProjectPriority = (typeof PROJECT_PRIORITIES)[number];

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

export type ProjectCreateInput = Omit<Project, "id">;

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

export type DocumentType = (typeof DOCUMENT_TYPES)[number];
export type DocumentSource = "MANUAL" | "OUTLOOK";

export type ProjectDocument = {
  id: string;
  projectId: string;
  type: DocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  source: DocumentSource;
  createdAt: string;
};

export type DashboardSnapshot = {
  activeProjects: number;
  pendingOrders: number;
  delayedDeliveries: number;
  weeklyShipments: number;
  quotationsToFollowUp: number;
  aiAlerts: number;
};

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

export type ImportOrderAcksResponse = {
  importedCount: number;
  unmatchedCount: number;
  skippedCount: number;
  errorCount: number;
  results: ImportResultItem[];
};

export type AlertItem = {
  id: string;
  projectId: string;
  level: "INFO" | "WARNING" | "CRITICAL";
  message: string;
  createdAt: string;
};

export type EmailDraft = {
  id: string;
  projectId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
};
