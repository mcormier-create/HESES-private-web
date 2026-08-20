import { z } from "zod";
import { DOCUMENT_TYPES } from "../projects/project.types.js";

export const documentUploadSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  source: z.enum(["MANUAL", "OUTLOOK"]).default("MANUAL")
});
