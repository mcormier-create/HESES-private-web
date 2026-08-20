import type { Project } from "./project.types.js";
import { ALLOWED_STATUS_TRANSITIONS } from "./projects.validation.js";

export class ProjectsService {
  private readonly projects: Project[] = [];

  list(): Project[] {
    return this.projects;
  }

  create(project: Project): Project {
    if (this.projects.some((p) => p.projectNumber.trim() === project.projectNumber.trim())) {
      throw new Error("PROJECT_NUMBER_ALREADY_EXISTS");
    }

    if (this.projects.some((p) => p.clientPo.trim() === project.clientPo.trim())) {
      throw new Error("CLIENT_PO_ALREADY_EXISTS");
    }

    if (this.projects.some((p) => p.carelPo.trim() === project.carelPo.trim())) {
      throw new Error("CAREL_PO_ALREADY_EXISTS");
    }

    this.projects.push(project);
    return project;
  }

  findById(projectId: string): Project | undefined {
    return this.projects.find((project) => project.id === projectId);
  }

  updateStatus(projectId: string, nextStatus: Project["status"]): Project {
    const project = this.findById(projectId);
    if (!project) {
      throw new Error("PROJECT_NOT_FOUND");
    }

    if (project.status === nextStatus) {
      return project;
    }

    const allowed = ALLOWED_STATUS_TRANSITIONS[project.status];
    if (!allowed.includes(nextStatus)) {
      throw new Error("INVALID_STATUS_TRANSITION");
    }

    project.status = nextStatus;
    return project;
  }

  findByKeys(carelPo: string, clientPo: string): Project | undefined {
    return this.projects.find(
      (p) => p.carelPo.trim() === carelPo.trim() || p.clientPo.trim() === clientPo.trim()
    );
  }
}
