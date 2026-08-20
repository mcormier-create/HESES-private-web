import type { DocumentType } from "../projects/project.types.js";

export type ProjectDocument = {
  id: string;
  projectId: string;
  type: DocumentType;
  filename: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  source: "MANUAL" | "OUTLOOK";
  createdAt: string;
};

export class DocumentsService {
  private readonly documents: ProjectDocument[] = [];

  listByProject(projectId: string): ProjectDocument[] {
    return this.documents.filter((doc) => doc.projectId === projectId);
  }

  findById(documentId: string): ProjectDocument | undefined {
    return this.documents.find((doc) => doc.id === documentId);
  }

  add(document: ProjectDocument): ProjectDocument {
    this.documents.push(document);
    return document;
  }
}
