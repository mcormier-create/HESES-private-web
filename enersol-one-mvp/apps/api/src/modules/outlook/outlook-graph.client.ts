export type GraphMessage = {
  id: string;
  subject: string;
  from: string;
  receivedDateTime: string;
  bodyPreview: string;
};

export class OutlookGraphClient {
  private readonly mailboxUser = process.env.GRAPH_MAILBOX_USER ?? "";

  async listInboxMessages(): Promise<GraphMessage[]> {
    // MVP fallback: return empty list when Graph credentials are not configured.
    if (!this.mailboxUser) {
      return [];
    }

    // Integration prep note:
    // 1) Acquire app token with client credentials.
    // 2) Call GET /users/{mailboxUser}/mailFolders/inbox/messages
    // 3) Map payload to GraphMessage shape.
    return [];
  }
}
