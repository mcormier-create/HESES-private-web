import { useEffect, useMemo, useState, type FormEvent } from "react";
import { apiClient } from "../../services/apiClient";
import {
  PROJECT_PRIORITIES,
  PROJECT_STATUSES,
  type Project,
  type ProjectCreateInput,
  type ProjectStatus
} from "../../types/domain";

const initialForm: ProjectCreateInput = {
  projectNumber: "",
  projectName: "",
  clientName: "",
  clientEmail: "",
  engineer: "",
  contractor: "",
  salesRep: "",
  owner: "",
  clientPo: "",
  carelPo: "",
  status: "QUOTATION",
  priority: "MEDIUM",
  expectedDeliveryDate: new Date().toISOString().slice(0, 10),
  notes: ""
};

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [statusDrafts, setStatusDrafts] = useState<Record<string, ProjectStatus>>({});
  const [form, setForm] = useState<ProjectCreateInput>(initialForm);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"ALL" | ProjectStatus>("ALL");
  const [priorityFilter, setPriorityFilter] = useState<"ALL" | ProjectCreateInput["priority"]>("ALL");
  const [sortBy, setSortBy] = useState<"projectNumber" | "expectedDeliveryDate" | "clientName" | "priority">("expectedDeliveryDate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const visibleProjects = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase();
    const priorityRank: Record<ProjectCreateInput["priority"], number> = {
      LOW: 1,
      MEDIUM: 2,
      HIGH: 3,
      URGENT: 4
    };

    const filtered = projects.filter((project) => {
      if (statusFilter !== "ALL" && project.status !== statusFilter) {
        return false;
      }

      if (priorityFilter !== "ALL" && project.priority !== priorityFilter) {
        return false;
      }

      if (!normalizedSearch) {
        return true;
      }

      const haystack = [
        project.projectNumber,
        project.projectName,
        project.clientName,
        project.clientEmail,
        project.carelPo,
        project.clientPo
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(normalizedSearch);
    });

    filtered.sort((a, b) => {
      let comparison = 0;
      if (sortBy === "expectedDeliveryDate") {
        comparison = a.expectedDeliveryDate.localeCompare(b.expectedDeliveryDate);
      } else if (sortBy === "projectNumber") {
        comparison = a.projectNumber.localeCompare(b.projectNumber);
      } else if (sortBy === "clientName") {
        comparison = a.clientName.localeCompare(b.clientName);
      } else {
        comparison = priorityRank[a.priority] - priorityRank[b.priority];
      }

      return sortOrder === "asc" ? comparison : -comparison;
    });

    return filtered;
  }, [projects, priorityFilter, searchTerm, sortBy, sortOrder, statusFilter]);

  const totalPages = useMemo(() => {
    return Math.max(1, Math.ceil(visibleProjects.length / pageSize));
  }, [pageSize, visibleProjects.length]);

  const pagedProjects = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return visibleProjects.slice(start, start + pageSize);
  }, [currentPage, pageSize, visibleProjects]);

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, statusFilter, priorityFilter, sortBy, sortOrder, pageSize]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  function escapeCsvCell(value: string): string {
    const escaped = value.replace(/"/g, '""');
    return `"${escaped}"`;
  }

  function handleExportCsv() {
    if (visibleProjects.length === 0) {
      setError("Aucun projet a exporter.");
      return;
    }

    setError("");
    const headers = [
      "projectNumber",
      "projectName",
      "clientName",
      "clientEmail",
      "engineer",
      "contractor",
      "salesRep",
      "owner",
      "clientPo",
      "carelPo",
      "status",
      "priority",
      "expectedDeliveryDate",
      "notes"
    ];

    const rows = visibleProjects.map((project) =>
      [
        project.projectNumber,
        project.projectName,
        project.clientName,
        project.clientEmail,
        project.engineer,
        project.contractor,
        project.salesRep,
        project.owner,
        project.clientPo,
        project.carelPo,
        project.status,
        project.priority,
        project.expectedDeliveryDate,
        project.notes
      ]
        .map((value) => escapeCsvCell(String(value ?? "")))
        .join(",")
    );

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `enersol-projects-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  async function loadProjects() {
    setIsLoading(true);
    setError("");
    try {
      const items = await apiClient.getProjects();
      setProjects(items);
      const nextDrafts: Record<string, ProjectStatus> = {};
      for (const project of items) {
        nextDrafts[project.id] = project.status;
      }
      setStatusDrafts(nextDrafts);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "PROJECTS_LOAD_FAILED");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  async function handleCreateProject(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setError("");
    setSuccess("");
    try {
      await apiClient.createProject(form);
      setForm(initialForm);
      setSuccess("Projet cree.");
      await loadProjects();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "PROJECT_CREATE_FAILED");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleUpdateStatus(projectId: string) {
    const nextStatus = statusDrafts[projectId];
    if (!nextStatus) return;

    setError("");
    setSuccess("");
    try {
      await apiClient.updateProjectStatus(projectId, nextStatus);
      setSuccess("Statut mis a jour.");
      await loadProjects();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "PROJECT_STATUS_UPDATE_FAILED");
    }
  }

  return (
    <section>
      <h2>Projets</h2>
      <p>Creation complete, consultation live et changement de statut.</p>

      {error ? <p style={{ color: "#b00020" }}>Erreur: {error}</p> : null}
      {success ? <p style={{ color: "#0a6b2d" }}>{success}</p> : null}

      <form onSubmit={handleCreateProject} style={{ border: "1px solid #d8d8d8", borderRadius: "10px", padding: "12px" }}>
        <h3 style={{ marginTop: 0 }}>Nouveau projet</h3>
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(2, minmax(240px, 1fr))" }}>
          <label>
            Numero
            <input value={form.projectNumber} onChange={(e) => setForm({ ...form, projectNumber: e.target.value })} required />
          </label>
          <label>
            Nom
            <input value={form.projectName} onChange={(e) => setForm({ ...form, projectName: e.target.value })} required />
          </label>
          <label>
            Client
            <input value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} required />
          </label>
          <label>
            Email client
            <input type="email" value={form.clientEmail} onChange={(e) => setForm({ ...form, clientEmail: e.target.value })} required />
          </label>
          <label>
            Ingenieur
            <input value={form.engineer} onChange={(e) => setForm({ ...form, engineer: e.target.value })} required />
          </label>
          <label>
            Entrepreneur
            <input value={form.contractor} onChange={(e) => setForm({ ...form, contractor: e.target.value })} required />
          </label>
          <label>
            Representant
            <input value={form.salesRep} onChange={(e) => setForm({ ...form, salesRep: e.target.value })} required />
          </label>
          <label>
            Responsable
            <input value={form.owner} onChange={(e) => setForm({ ...form, owner: e.target.value })} required />
          </label>
          <label>
            BC client
            <input value={form.clientPo} onChange={(e) => setForm({ ...form, clientPo: e.target.value })} required />
          </label>
          <label>
            BC Carel
            <input value={form.carelPo} onChange={(e) => setForm({ ...form, carelPo: e.target.value })} required />
          </label>
          <label>
            Statut
            <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value as ProjectStatus })}>
              {PROJECT_STATUSES.map((status) => (
                <option value={status} key={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>
          <label>
            Priorite
            <select value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value as ProjectCreateInput["priority"] })}>
              {PROJECT_PRIORITIES.map((priority) => (
                <option value={priority} key={priority}>
                  {priority}
                </option>
              ))}
            </select>
          </label>
          <label>
            Livraison prevue
            <input
              type="date"
              value={form.expectedDeliveryDate}
              onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
              required
            />
          </label>
          <label>
            Notes
            <input value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
          </label>
        </div>
        <div style={{ marginTop: "10px" }}>
          <button type="submit" disabled={isSaving}>
            {isSaving ? "Creation..." : "Creer projet"}
          </button>
        </div>
      </form>

      <div style={{ marginTop: "12px" }}>
        <button type="button" onClick={() => void loadProjects()} disabled={isLoading}>
          {isLoading ? "Chargement..." : "Rafraichir la liste"}
        </button>
        <button type="button" onClick={handleExportCsv} style={{ marginLeft: "8px" }}>
          Export CSV (filtre)
        </button>
      </div>

      <div
        style={{
          marginTop: "10px",
          border: "1px solid #d8d8d8",
          borderRadius: "10px",
          padding: "12px",
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "10px"
        }}
      >
        <label>
          Recherche
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="Numero, client, BC..."
          />
        </label>
        <label>
          Filtre statut
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value as "ALL" | ProjectStatus)}>
            <option value="ALL">Tous</option>
            {PROJECT_STATUSES.map((status) => (
              <option value={status} key={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          Filtre priorite
          <select
            value={priorityFilter}
            onChange={(event) => setPriorityFilter(event.target.value as "ALL" | ProjectCreateInput["priority"])}
          >
            <option value="ALL">Toutes</option>
            {PROJECT_PRIORITIES.map((priority) => (
              <option value={priority} key={priority}>
                {priority}
              </option>
            ))}
          </select>
        </label>
        <label>
          Trier par
          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value as "projectNumber" | "expectedDeliveryDate" | "clientName" | "priority")
            }
          >
            <option value="expectedDeliveryDate">Livraison prevue</option>
            <option value="projectNumber">Numero projet</option>
            <option value="clientName">Client</option>
            <option value="priority">Priorite</option>
          </select>
        </label>
        <label>
          Ordre
          <select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as "asc" | "desc") }>
            <option value="asc">Croissant</option>
            <option value="desc">Decroissant</option>
          </select>
        </label>
      </div>

      <div style={{ marginTop: "10px", overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={{ textAlign: "left" }}>Numero</th>
              <th style={{ textAlign: "left" }}>Nom</th>
              <th style={{ textAlign: "left" }}>Client</th>
              <th style={{ textAlign: "left" }}>Statut actuel</th>
              <th style={{ textAlign: "left" }}>Priorite</th>
              <th style={{ textAlign: "left" }}>Livraison</th>
              <th style={{ textAlign: "left" }}>Changer statut</th>
            </tr>
          </thead>
          <tbody>
            {pagedProjects.length === 0 ? (
              <tr>
                <td colSpan={7}>Aucun projet.</td>
              </tr>
            ) : (
              pagedProjects.map((project) => (
                <tr key={project.id}>
                  <td>{project.projectNumber}</td>
                  <td>{project.projectName}</td>
                  <td>{project.clientName}</td>
                  <td>{project.status}</td>
                  <td>{project.priority}</td>
                  <td>{project.expectedDeliveryDate}</td>
                  <td>
                    <select
                      value={statusDrafts[project.id] ?? project.status}
                      onChange={(event) =>
                        setStatusDrafts((prev) => ({
                          ...prev,
                          [project.id]: event.target.value as ProjectStatus
                        }))
                      }
                    >
                      {PROJECT_STATUSES.map((status) => (
                        <option value={status} key={status}>
                          {status}
                        </option>
                      ))}
                    </select>
                    <button type="button" onClick={() => void handleUpdateStatus(project.id)} style={{ marginLeft: "8px" }}>
                      Appliquer
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
        <span>
          Resultats: {visibleProjects.length} | Page {currentPage}/{totalPages}
        </span>
        <label>
          Par page
          <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))} style={{ marginLeft: "6px" }}>
            <option value={5}>5</option>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button type="button" onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))} disabled={currentPage <= 1}>
          Precedent
        </button>
        <button
          type="button"
          onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
          disabled={currentPage >= totalPages}
        >
          Suivant
        </button>
      </div>
    </section>
  );
}
