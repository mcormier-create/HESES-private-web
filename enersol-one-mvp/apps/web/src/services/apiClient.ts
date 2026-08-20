import type {
  AlertItem,
  DashboardSnapshot,
  DocumentSource,
  DocumentType,
  EmailDraft,
  ImportOrderAcksResponse,
  Project,
  ProjectDocument,
  ProjectCreateInput,
  ProjectStatus
} from "../types/domain";

async function parseJsonResponse<T>(response: Response): Promise<T> {
  const data = await response.json();
  if (!response.ok) {
    const message = typeof data?.error === "string" ? data.error : "REQUEST_FAILED";
    throw new Error(message);
  }
  return data as T;
}

export const apiClient = {
  async getDashboard(): Promise<DashboardSnapshot> {
    const response = await fetch("/api/dashboard");
    return parseJsonResponse<DashboardSnapshot>(response);
  },
  async getProjects(): Promise<Project[]> {
    const response = await fetch("/api/projects");
    return parseJsonResponse<Project[]>(response);
  },
  async createProject(payload: ProjectCreateInput): Promise<Project> {
    const response = await fetch("/api/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    return parseJsonResponse<Project>(response);
  },
  async updateProjectStatus(projectId: string, status: ProjectStatus): Promise<Project> {
    const response = await fetch(`/api/projects/${projectId}/status`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status })
    });
    return parseJsonResponse<Project>(response);
  },
  async getProjectDocuments(projectId: string): Promise<ProjectDocument[]> {
    const response = await fetch(`/api/projects/${projectId}/documents`);
    return parseJsonResponse<ProjectDocument[]>(response);
  },
  async uploadProjectDocument(projectId: string, payload: { file: File; type: DocumentType; source?: DocumentSource }): Promise<ProjectDocument> {
    const form = new FormData();
    form.append("file", payload.file);
    form.append("type", payload.type);
    form.append("source", payload.source ?? "MANUAL");

    const response = await fetch(`/api/projects/${projectId}/documents/upload`, {
      method: "POST",
      body: form
    });

    return parseJsonResponse<ProjectDocument>(response);
  },
  getDocumentDownloadUrl(documentId: string) {
    return `/api/documents/${documentId}/download`;
  },
  getDocumentPreviewUrl(documentId: string) {
    return `/api/documents/${documentId}/preview`;
  },
  async importOrderAcknowledgements(payload?: {
    thresholdDays?: number;
    messages?: Array<{
      id: string;
      subject: string;
      from: string;
      receivedDateTime: string;
      bodyPreview: string;
    }>;
  }): Promise<ImportOrderAcksResponse> {
    const response = await fetch("/api/outlook/import-order-acks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload ?? {})
    });

    return parseJsonResponse<ImportOrderAcksResponse>(response);
  },
  async getAlerts(): Promise<AlertItem[]> {
    const response = await fetch("/api/alerts");
    return parseJsonResponse<AlertItem[]>(response);
  },
  async getMailDrafts(): Promise<EmailDraft[]> {
    const response = await fetch("/api/mail-drafts");
    return parseJsonResponse<EmailDraft[]>(response);
  }
};
