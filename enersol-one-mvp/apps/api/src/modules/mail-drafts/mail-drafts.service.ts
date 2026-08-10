import type { Project } from "../projects/project.types.js";

export type EmailDraft = {
  id: string;
  projectId: string;
  to: string;
  subject: string;
  body: string;
  createdAt: string;
};

export class MailDraftsService {
  private readonly drafts: EmailDraft[] = [];

  list(): EmailDraft[] {
    return this.drafts;
  }

  buildDelayFollowUp(project: Project): EmailDraft {
    return {
      id: crypto.randomUUID(),
      projectId: project.id,
      to: project.clientEmail,
      subject: `Suivi de livraison en retard - ${project.projectNumber}`,
      body: [
        `Bonjour ${project.clientName},`,
        "",
        `Nous faisons un suivi concernant le projet ${project.projectNumber} (${project.projectName}).`,
        "La date de livraison prevue semble en retard selon le dernier accuse de reception.",
        "",
        "Merci de confirmer le nouveau calendrier de livraison.",
        "",
        "Cordialement,",
        "Equipe Enersol"
      ].join("\n"),
      createdAt: new Date().toISOString()
    };
  }

  createDelayFollowUp(project: Project): EmailDraft {
    const draft = this.buildDelayFollowUp(project);
    this.drafts.push(draft);
    return draft;
  }
}
