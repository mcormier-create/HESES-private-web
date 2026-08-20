import { z } from "zod";
import { PROJECT_PRIORITIES, PROJECT_STATUSES, type ProjectStatus } from "./project.types.js";

export const projectCreateSchema = z.object({
  projectNumber: z.string().trim().min(1),
  projectName: z.string().trim().min(1),
  clientName: z.string().trim().min(1),
  clientEmail: z.string().trim().email(),
  engineer: z.string().trim().min(1),
  contractor: z.string().trim().min(1),
  salesRep: z.string().trim().min(1),
  owner: z.string().trim().min(1),
  clientPo: z.string().trim().min(1),
  carelPo: z.string().trim().min(1),
  status: z.enum(PROJECT_STATUSES),
  priority: z.enum(PROJECT_PRIORITIES),
  expectedDeliveryDate: z.string().trim().min(1),
  notes: z.string().trim().default("")
});

export const projectStatusUpdateSchema = z.object({
  status: z.enum(PROJECT_STATUSES)
});

export const ALLOWED_STATUS_TRANSITIONS: Record<ProjectStatus, ProjectStatus[]> = {
  QUOTATION: ["QUOTATION_SENT"],
  QUOTATION_SENT: ["CLIENT_PO_RECEIVED"],
  CLIENT_PO_RECEIVED: ["ORDER_SENT_TO_CAREL"],
  ORDER_SENT_TO_CAREL: ["ORDER_ACK_RECEIVED"],
  ORDER_ACK_RECEIVED: ["ENGINEERING"],
  ENGINEERING: ["PRODUCTION"],
  PRODUCTION: ["SHIPPED"],
  SHIPPED: ["RECEIVED"],
  RECEIVED: ["DELIVERED"],
  DELIVERED: ["COMMISSIONING"],
  COMMISSIONING: ["COMPLETED"],
  COMPLETED: []
};
