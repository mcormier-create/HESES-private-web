import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

export type StoredFile = {
  absolutePath: string;
  relativePath: string;
};

const runtimeDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(runtimeDir, "../../../..");
const dataRoot = path.resolve(repoRoot, process.env.DATA_ROOT ?? "./data");

export class DocumentStorageService {
  private readonly documentsRoot = path.join(dataRoot, "documents");

  resolveAbsolutePath(relativePath: string): string {
    return path.resolve(dataRoot, relativePath);
  }

  async save(projectId: string, documentId: string, originalName: string, content: Buffer): Promise<StoredFile> {
    const safeName = originalName.replace(/[^a-zA-Z0-9._-]/g, "_");
    const projectDir = path.join(this.documentsRoot, projectId);
    await mkdir(projectDir, { recursive: true });

    const filename = `${documentId}-${safeName}`;
    const absolutePath = path.join(projectDir, filename);
    await writeFile(absolutePath, content);

    const relativePath = path.relative(dataRoot, absolutePath).replace(/\\/g, "/");
    return {
      absolutePath,
      relativePath
    };
  }
}
