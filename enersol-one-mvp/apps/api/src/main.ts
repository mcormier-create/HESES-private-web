import express from "express";
import multer from "multer";
import { healthHandler } from "./modules/health/health.controller.js";
import { AlertsService } from "./modules/alerts/alerts.service.js";
import { DashboardService } from "./modules/dashboard/dashboard.service.js";
import { DocumentsService } from "./modules/documents/documents.service.js";
import { documentUploadSchema } from "./modules/documents/documents.validation.js";
import { MailDraftsService } from "./modules/mail-drafts/mail-drafts.service.js";
import { OutlookImportService } from "./modules/outlook/outlook-import.service.js";
import { OutlookGraphClient, type GraphMessage } from "./modules/outlook/outlook-graph.client.js";
import { ProjectsService } from "./modules/projects/projects.service.js";
import {
  projectCreateSchema,
  projectStatusUpdateSchema
} from "./modules/projects/projects.validation.js";
import { DocumentStorageService } from "./infra/storage/document-storage.service.js";

const app = express();
app.use(express.json());

const projectsService = new ProjectsService();
const documentsService = new DocumentsService();
const alertsService = new AlertsService();
const dashboardService = new DashboardService();
const mailDraftsService = new MailDraftsService();
const outlookGraphClient = new OutlookGraphClient();
const outlookImportService = new OutlookImportService(
  projectsService,
  alertsService,
  mailDraftsService
);
const documentStorageService = new DocumentStorageService();
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }
});

app.get("/health", healthHandler);

app.get("/api/projects", (_req, res) => {
  res.json(projectsService.list());
});

app.post("/api/projects", (req, res) => {
  const parsed = projectCreateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const created = projectsService.create({
      id: crypto.randomUUID(),
      ...parsed.data
    });
    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    res.status(409).json({ error: message });
  }
});

app.patch("/api/projects/:projectId/status", (req, res) => {
  const parsed = projectStatusUpdateSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const updated = projectsService.updateStatus(req.params.projectId, parsed.data.status);
    res.json(updated);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    const statusCode = message === "PROJECT_NOT_FOUND" ? 404 : 409;
    res.status(statusCode).json({ error: message });
  }
});

app.get("/api/dashboard", (_req, res) => {
  const snapshot = dashboardService.build(projectsService.list(), alertsService.list().length);
  res.json(snapshot);
});

app.get("/api/alerts", (_req, res) => {
  res.json(alertsService.list());
});

app.get("/api/mail-drafts", (_req, res) => {
  res.json(mailDraftsService.list());
});

app.get("/api/projects/:projectId/documents", (req, res) => {
  res.json(documentsService.listByProject(req.params.projectId));
});

app.post("/api/projects/:projectId/documents/upload", upload.single("file"), async (req, res) => {
  const project = projectsService.findById(req.params.projectId);
  if (!project) {
    res.status(404).json({ error: "PROJECT_NOT_FOUND" });
    return;
  }

  if (!req.file) {
    res.status(400).json({ error: "FILE_REQUIRED" });
    return;
  }

  const parsed = documentUploadSchema.safeParse({
    type: req.body.type,
    source: req.body.source
  });

  if (!parsed.success) {
    res.status(400).json({
      error: "VALIDATION_ERROR",
      details: parsed.error.flatten()
    });
    return;
  }

  try {
    const documentId = crypto.randomUUID();
    const storedFile = await documentStorageService.save(
      req.params.projectId,
      documentId,
      req.file.originalname,
      req.file.buffer
    );

    const created = documentsService.add({
      id: documentId,
      projectId: req.params.projectId,
      type: parsed.data.type,
      filename: req.file.originalname,
      mimeType: req.file.mimetype || "application/octet-stream",
      sizeBytes: req.file.size,
      storagePath: storedFile.relativePath,
      source: parsed.data.source,
      createdAt: new Date().toISOString()
    });

    res.status(201).json(created);
  } catch (error) {
    const message = error instanceof Error ? error.message : "UNKNOWN_ERROR";
    res.status(500).json({ error: message });
  }
});

app.get("/api/documents/:documentId", (req, res) => {
  const document = documentsService.findById(req.params.documentId);
  if (!document) {
    res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    return;
  }
  res.json(document);
});

app.get("/api/documents/:documentId/download", (req, res) => {
  const document = documentsService.findById(req.params.documentId);
  if (!document) {
    res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    return;
  }

  res.download(documentStorageService.resolveAbsolutePath(document.storagePath), document.filename);
});

app.get("/api/documents/:documentId/preview", (req, res) => {
  const document = documentsService.findById(req.params.documentId);
  if (!document) {
    res.status(404).json({ error: "DOCUMENT_NOT_FOUND" });
    return;
  }

  const absolutePath = documentStorageService.resolveAbsolutePath(document.storagePath);
  res.type(document.mimeType || "application/octet-stream");
  res.sendFile(absolutePath, {
    headers: {
      "Content-Disposition": `inline; filename="${document.filename}"`
    }
  });
});

app.post("/api/outlook/import-order-acks", async (req, res) => {
  const thresholdDays = Number(req.body?.thresholdDays ?? process.env.DELAY_ALERT_DAYS ?? 14);
  const bodyMessages = req.body?.messages;

  let messages: GraphMessage[] = [];
  if (Array.isArray(bodyMessages)) {
    messages = bodyMessages;
  } else {
    messages = await outlookGraphClient.listInboxMessages();
  }

  const results = outlookImportService.importOrderAcknowledgements(messages, thresholdDays);

  res.json({
    importedCount: results.filter((item) => item.status === "IMPORTED").length,
    unmatchedCount: results.filter((item) => item.status === "UNMATCHED").length,
    skippedCount: results.filter((item) => item.status === "SKIPPED").length,
    errorCount: results.filter((item) => item.status === "ERROR").length,
    results
  });
});

const port = Number(process.env.PORT || 4000);
app.listen(port, () => {
  console.log(`Enersol One API listening on :${port}`);
});
