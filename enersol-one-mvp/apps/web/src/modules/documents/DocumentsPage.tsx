import { useEffect, useState, type FormEvent } from "react";
import { apiClient } from "../../services/apiClient";
import { DOCUMENT_TYPES, type DocumentSource, type DocumentType, type Project, type ProjectDocument } from "../../types/domain";

export function DocumentsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [documents, setDocuments] = useState<ProjectDocument[]>([]);
  const [previewDocumentId, setPreviewDocumentId] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [documentType, setDocumentType] = useState<DocumentType>("QUOTATION");
  const [documentSource, setDocumentSource] = useState<DocumentSource>("MANUAL");
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isLoadingDocuments, setIsLoadingDocuments] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const selectedPreviewDocument = documents.find((doc) => doc.id === previewDocumentId) ?? null;
  const previewUrl = selectedPreviewDocument ? apiClient.getDocumentPreviewUrl(selectedPreviewDocument.id) : "";
  const isImagePreview = Boolean(selectedPreviewDocument?.mimeType?.startsWith("image/"));
  const isPdfPreview = selectedPreviewDocument?.mimeType === "application/pdf";

  useEffect(() => {
    async function loadProjects() {
      setIsLoadingProjects(true);
      setError("");
      try {
        const items = await apiClient.getProjects();
        setProjects(items);
        if (items.length > 0) {
          setSelectedProjectId(items[0].id);
        }
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "PROJECTS_LOAD_FAILED");
      } finally {
        setIsLoadingProjects(false);
      }
    }

    void loadProjects();
  }, []);

  useEffect(() => {
    async function loadDocuments(projectId: string) {
      if (!projectId) {
        setDocuments([]);
        return;
      }

      setIsLoadingDocuments(true);
      setError("");
      try {
        const items = await apiClient.getProjectDocuments(projectId);
        setDocuments(items);
      } catch (caughtError) {
        setError(caughtError instanceof Error ? caughtError.message : "DOCUMENTS_LOAD_FAILED");
      } finally {
        setIsLoadingDocuments(false);
      }
    }

    void loadDocuments(selectedProjectId);
  }, [selectedProjectId]);

  useEffect(() => {
    if (documents.length === 0) {
      setPreviewDocumentId("");
      return;
    }

    const exists = documents.some((doc) => doc.id === previewDocumentId);
    if (!exists) {
      setPreviewDocumentId(documents[0].id);
    }
  }, [documents, previewDocumentId]);

  async function handleUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!selectedProjectId) {
      setError("Selectionne un projet.");
      return;
    }
    if (!selectedFile) {
      setError("Selectionne un fichier.");
      return;
    }

    setIsUploading(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.uploadProjectDocument(selectedProjectId, {
        file: selectedFile,
        type: documentType,
        source: documentSource
      });
      const nextDocs = await apiClient.getProjectDocuments(selectedProjectId);
      setDocuments(nextDocs);
      setSelectedFile(null);
      setSuccess("Document televerse.");
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "DOCUMENT_UPLOAD_FAILED");
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section>
      <h2>Documents</h2>
      <p>Upload, listing et telechargement des documents par projet.</p>

      {error ? <p style={{ color: "#b00020" }}>Erreur: {error}</p> : null}
      {success ? <p style={{ color: "#0a6b2d" }}>{success}</p> : null}

      <div style={{ border: "1px solid #d8d8d8", borderRadius: "10px", padding: "12px" }}>
        <label>
          Projet
          <select
            value={selectedProjectId}
            onChange={(event) => setSelectedProjectId(event.target.value)}
            disabled={isLoadingProjects || projects.length === 0}
            style={{ marginLeft: "8px" }}
          >
            {projects.length === 0 ? <option value="">Aucun projet</option> : null}
            {projects.map((project) => (
              <option value={project.id} key={project.id}>
                {project.projectNumber} - {project.projectName}
              </option>
            ))}
          </select>
        </label>
      </div>

      <form onSubmit={handleUpload} style={{ marginTop: "10px", border: "1px solid #d8d8d8", borderRadius: "10px", padding: "12px" }}>
        <h3 style={{ marginTop: 0 }}>Televerser un document</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
          <label>
            Type
            <select value={documentType} onChange={(event) => setDocumentType(event.target.value as DocumentType)}>
              {DOCUMENT_TYPES.map((type) => (
                <option value={type} key={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>
          <label>
            Source
            <select value={documentSource} onChange={(event) => setDocumentSource(event.target.value as DocumentSource)}>
              <option value="MANUAL">MANUAL</option>
              <option value="OUTLOOK">OUTLOOK</option>
            </select>
          </label>
          <label>
            Fichier
            <input
              type="file"
              onChange={(event) => setSelectedFile(event.target.files && event.target.files[0] ? event.target.files[0] : null)}
            />
          </label>
        </div>
        <div style={{ marginTop: "10px" }}>
          <button type="submit" disabled={isUploading || !selectedProjectId}>
            {isUploading ? "Televersement..." : "Televerser"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: "12px" }}>
        <h3>Documents du projet</h3>
        {isLoadingDocuments ? <p>Chargement...</p> : null}
        {!isLoadingDocuments && documents.length === 0 ? <p>Aucun document.</p> : null}
        {!isLoadingDocuments && documents.length > 0 ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={{ textAlign: "left" }}>Nom</th>
                  <th style={{ textAlign: "left" }}>Type</th>
                  <th style={{ textAlign: "left" }}>Source</th>
                  <th style={{ textAlign: "left" }}>Taille</th>
                  <th style={{ textAlign: "left" }}>Cree le</th>
                  <th style={{ textAlign: "left" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td>{doc.filename}</td>
                    <td>{doc.type}</td>
                    <td>{doc.source}</td>
                    <td>{Math.max(1, Math.round(doc.sizeBytes / 1024))} KB</td>
                    <td>{new Date(doc.createdAt).toLocaleString()}</td>
                    <td>
                      <button type="button" onClick={() => setPreviewDocumentId(doc.id)}>
                        Previsualiser
                      </button>
                      <span> </span>
                      <a href={apiClient.getDocumentDownloadUrl(doc.id)}>Telecharger</a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selectedPreviewDocument ? (
        <div style={{ marginTop: "12px", border: "1px solid #d8d8d8", borderRadius: "10px", padding: "12px" }}>
          <h3 style={{ marginTop: 0 }}>Previsualisation</h3>
          <p style={{ marginTop: 0 }}>
            Fichier: {selectedPreviewDocument.filename} ({selectedPreviewDocument.mimeType || "type inconnu"})
          </p>
          {isImagePreview ? (
            <img
              src={previewUrl}
              alt={selectedPreviewDocument.filename}
              style={{ maxWidth: "100%", maxHeight: "620px", border: "1px solid #ccc", borderRadius: "8px" }}
            />
          ) : null}
          {isPdfPreview ? (
            <iframe
              title="Apercu document PDF"
              src={previewUrl}
              style={{ width: "100%", minHeight: "620px", border: "1px solid #ccc", borderRadius: "8px" }}
            />
          ) : null}
          {!isImagePreview && !isPdfPreview ? (
            <div style={{ border: "1px dashed #bbb", borderRadius: "8px", padding: "14px" }}>
              <p style={{ marginTop: 0 }}>
                Ce type de document ne dispose pas d une previsualisation native dans cette vue.
              </p>
              <a href={apiClient.getDocumentDownloadUrl(selectedPreviewDocument.id)}>Telecharger le document</a>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
