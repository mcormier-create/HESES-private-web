import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { apiClient } from "../../services/apiClient";
import type { ProjectCreateInput } from "../../types/domain";
import type { AlertItem, EmailDraft, ImportOrderAcksResponse } from "../../types/domain";

type SpeechRecognitionResultLike = {
  transcript: string;
};

type SpeechRecognitionEventLike = {
  results: ArrayLike<ArrayLike<SpeechRecognitionResultLike>>;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
};

type SpeechRecognitionConstructorLike = new () => SpeechRecognitionLike;

const mockMessages = [
  {
    id: "mock-1",
    subject: "Order Acknowledgement - Carel Order CRL-4501",
    from: "orders@carel.example",
    receivedDateTime: new Date().toISOString(),
    bodyPreview:
      "Order Acknowledgement\nCarel Order: CRL-4501\nClient PO: BC-7788\nDelivery Date: 2026-05-01\nProduct: UE025 Qty: 2"
  },
  {
    id: "mock-2",
    subject: "Accuse de reception commande",
    from: "carel-canada@example",
    receivedDateTime: new Date().toISOString(),
    bodyPreview:
      "Accuse de reception\nCarel No: CA-9981\nPO Client: PO-9981\nLivraison: 2026-09-14\nSKU: URV4 Qty: 1"
  }
];

const cardStyle: CSSProperties = {
  border: "1px solid #d6d6d6",
  borderRadius: "10px",
  padding: "12px"
};

export function InboxSyncPage() {
  const [isLoading, setIsLoading] = useState(false);
  const [isAssistantActive, setIsAssistantActive] = useState(true);
  const [autoIntervalSec, setAutoIntervalSec] = useState(90);
  const [thresholdDays, setThresholdDays] = useState(14);
  const [importResult, setImportResult] = useState<ImportOrderAcksResponse | null>(null);
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [drafts, setDrafts] = useState<EmailDraft[]>([]);
  const [lastRunAt, setLastRunAt] = useState<string>("");
  const [lastRunMode, setLastRunMode] = useState<"MAILBOX" | "DEMO" | "AUTO" | "">("");
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastVoiceCommand, setLastVoiceCommand] = useState("");
  const [voiceCommandHistory, setVoiceCommandHistory] = useState<string[]>([]);
  const [voiceReply, setVoiceReply] = useState("");
  const [typedVoiceCommand, setTypedVoiceCommand] = useState("");
  const [voiceNetworkRetryCount, setVoiceNetworkRetryCount] = useState(0);
  const [voiceWarning, setVoiceWarning] = useState("");
  const [isSpeechSynthesisEnabled, setIsSpeechSynthesisEnabled] = useState(true);
  const [error, setError] = useState<string>("");
  const isRunningRef = useRef(false);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const shouldAutoResumeVoiceRef = useRef(false);
  const voiceRetryCountRef = useRef(0);

  const importedRows = useMemo(() => {
    return (importResult?.results ?? []).filter((item) => item.status === "IMPORTED");
  }, [importResult]);

  async function ensureDemoProjects(): Promise<void> {
    const demoProjects: ProjectCreateInput[] = [
      {
        projectNumber: "DEMO-1001",
        projectName: "Demo OA Carel CRL-4501",
        clientName: "Client Demo A",
        clientEmail: "client.a@example.com",
        engineer: "Ingenieur Demo",
        contractor: "Entrepreneur Demo",
        salesRep: "Representant Demo",
        owner: "Responsable Demo",
        clientPo: "BC-7788",
        carelPo: "CRL-4501",
        status: "ORDER_SENT_TO_CAREL",
        priority: "MEDIUM",
        expectedDeliveryDate: "2026-05-01",
        notes: "Projet de demonstration pour import OA"
      },
      {
        projectNumber: "DEMO-1002",
        projectName: "Demo OA Carel CA-9981",
        clientName: "Client Demo B",
        clientEmail: "client.b@example.com",
        engineer: "Ingenieur Demo",
        contractor: "Entrepreneur Demo",
        salesRep: "Representant Demo",
        owner: "Responsable Demo",
        clientPo: "PO-9981",
        carelPo: "CA-9981",
        status: "ORDER_SENT_TO_CAREL",
        priority: "HIGH",
        expectedDeliveryDate: "2026-09-14",
        notes: "Projet de demonstration pour import OA"
      }
    ];

    const results = await Promise.allSettled(demoProjects.map((project) => apiClient.createProject(project)));
    for (const item of results) {
      if (item.status === "rejected") {
        const message = item.reason instanceof Error ? item.reason.message : "";
        // Conflicts are expected when demo projects already exist.
        if (!["PROJECT_NUMBER_ALREADY_EXISTS", "CLIENT_PO_ALREADY_EXISTS", "CAREL_PO_ALREADY_EXISTS"].includes(message)) {
          throw item.reason;
        }
      }
    }
  }

  async function refreshSideData() {
    const [nextAlerts, nextDrafts] = await Promise.all([apiClient.getAlerts(), apiClient.getMailDrafts()]);
    setAlerts(nextAlerts);
    setDrafts(nextDrafts);
  }

  function speak(message: string) {
    setVoiceReply(message);
    if (!isSpeechSynthesisEnabled) return;
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    const utterance = new SpeechSynthesisUtterance(message);
    utterance.lang = "fr-CA";
    utterance.rate = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  }

  function pushVoiceCommand(command: string) {
    setVoiceCommandHistory((prev) => [command, ...prev].slice(0, 8));
  }

  function navigateByVoice(targetTab: "Tableau de bord" | "Projets" | "Documents" | "Assistant IA" | "Parametres") {
    window.dispatchEvent(new CustomEvent("enersol:navigate", { detail: targetTab }));
  }

  async function executeVoiceCommand(transcript: string) {
    const normalized = transcript.toLowerCase().trim();
    setLastVoiceCommand(transcript);
    pushVoiceCommand(transcript);

    if (normalized.includes("ouvre") && (normalized.includes("dashboard") || normalized.includes("tableau"))) {
      navigateByVoice("Tableau de bord");
      speak("Ouverture du tableau de bord.");
      return;
    }

    if (normalized.includes("ouvre") && normalized.includes("projet")) {
      navigateByVoice("Projets");
      speak("Ouverture des projets.");
      return;
    }

    if (normalized.includes("ouvre") && normalized.includes("document")) {
      navigateByVoice("Documents");
      speak("Ouverture des documents.");
      return;
    }

    if (normalized.includes("ouvre") && normalized.includes("assistant")) {
      navigateByVoice("Assistant IA");
      speak("Ouverture de l assistant IA.");
      return;
    }

    if (normalized.includes("import") && normalized.includes("demo")) {
      await runImport(true, "DEMO");
      speak("Import de demonstration lance.");
      return;
    }

    if (normalized.includes("import") && (normalized.includes("boite") || normalized.includes("boîte"))) {
      await runImport(false, "MAILBOX");
      speak("Import depuis la boite lance.");
      return;
    }

    if (normalized.includes("activer") && normalized.includes("assistant")) {
      setIsAssistantActive(true);
      speak("Assistant automatique active.");
      return;
    }

    if (normalized.includes("desactiver") && normalized.includes("assistant")) {
      setIsAssistantActive(false);
      speak("Assistant automatique desactive.");
      return;
    }

    if (normalized.includes("rafraich") || normalized.includes("actualis")) {
      await refreshSideData();
      speak("Alertes et brouillons rafraichis.");
      return;
    }

    const thresholdMatch = normalized.match(/seuil\s*(\d{1,3})/);
    if (thresholdMatch) {
      const nextThreshold = Number(thresholdMatch[1]);
      if (Number.isFinite(nextThreshold) && nextThreshold > 0) {
        setThresholdDays(nextThreshold);
        speak(`Seuil de retard regle a ${nextThreshold} jours.`);
        return;
      }
    }

    speak("Commande non reconnue. Dites import demo, import boite, activer assistant, desactiver assistant ou seuil dix.");
  }

  function testVoiceAssistant() {
    if (!voiceSupported) {
      setError("Reconnaissance vocale non disponible sur ce navigateur.");
      return;
    }
    setError("");
    setVoiceWarning("");
    if (!isSpeechSynthesisEnabled) {
      setVoiceReply("Test vocal reussi en mode silencieux. Le micro est pret.");
      return;
    }
    speak("Test vocal reussi. Le micro et la synthese vocale sont prets.");
  }

  function formatVoiceError(errorCode?: string): string {
    if (!errorCode) return "Erreur vocale inconnue.";
    if (errorCode === "network") {
      return "Service vocal indisponible (reseau). Passe en mode commande texte de secours.";
    }
    if (errorCode === "not-allowed" || errorCode === "service-not-allowed") {
      return "Erreur vocale: acces micro refuse. Autorise le micro dans le navigateur.";
    }
    if (errorCode === "no-speech") {
      return "Aucune voix detectee. Reessaie en parlant plus pres du micro.";
    }
    if (errorCode === "aborted") {
      return "Ecoute vocale interrompue.";
    }
    return `Erreur vocale: ${errorCode}`;
  }

  function maybeRetryVoiceAfterNetworkError() {
    if (!shouldAutoResumeVoiceRef.current) return;
    if (voiceRetryCountRef.current >= 2) return;

    const nextRetry = voiceRetryCountRef.current + 1;
    voiceRetryCountRef.current = nextRetry;
    setVoiceNetworkRetryCount(nextRetry);
    setTimeout(() => {
      if (!shouldAutoResumeVoiceRef.current) return;
      startVoiceAssistant({ announce: false, isRetry: true });
    }, 1800);
  }

  async function runTypedVoiceCommand() {
    const command = typedVoiceCommand.trim();
    if (!command) return;
    await executeVoiceCommand(command);
    setTypedVoiceCommand("");
  }

  function stopVoiceAssistant() {
    shouldAutoResumeVoiceRef.current = false;
    voiceRetryCountRef.current = 0;
    setVoiceNetworkRetryCount(0);
    recognitionRef.current?.stop();
    setIsListening(false);
  }

  function startVoiceAssistant(options?: { announce?: boolean; isRetry?: boolean }) {
    const announce = options?.announce ?? true;
    const isRetry = options?.isRetry ?? false;

    if (!voiceSupported || typeof window === "undefined") {
      setError("Reconnaissance vocale non disponible sur ce navigateur.");
      return;
    }

    const withSpeech = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
      SpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    const RecognitionCtor = withSpeech.SpeechRecognition ?? withSpeech.webkitSpeechRecognition;
    if (!RecognitionCtor) {
      setError("Reconnaissance vocale non disponible sur ce navigateur.");
      return;
    }

    setError("");
    setVoiceWarning("");
    const recognition = new RecognitionCtor();
    recognition.lang = "fr-CA";
    recognition.continuous = true;
    recognition.interimResults = false;
    recognition.onresult = (event) => {
      const lastResult = event.results[event.results.length - 1];
      const transcript = lastResult?.[0]?.transcript?.trim();
      if (!transcript) return;
      void executeVoiceCommand(transcript);
    };
    recognition.onerror = (event) => {
      const message = formatVoiceError(event.error);
      if (event.error === "network") {
        setVoiceWarning(message);
      } else {
        setError(message);
      }
      if (event.error === "network") {
        maybeRetryVoiceAfterNetworkError();
      }
      setIsListening(false);
    };
    recognition.onend = () => {
      setIsListening(false);
    };

    recognitionRef.current = recognition;
    shouldAutoResumeVoiceRef.current = true;
    recognition.start();
    setIsListening(true);
    if (!isRetry) {
      voiceRetryCountRef.current = 0;
      setVoiceNetworkRetryCount(0);
    }
    setVoiceWarning("");
    if (announce) {
      speak("Assistant vocal actif. J ecoute vos commandes.");
    }
  }

  async function runImport(useMockData: boolean, mode: "MAILBOX" | "DEMO" | "AUTO" = "MAILBOX") {
    if (isRunningRef.current) return;
    isRunningRef.current = true;
    setIsLoading(true);
    setError("");
    try {
      if (useMockData) {
        await ensureDemoProjects();
      }

      const response = await apiClient.importOrderAcknowledgements({
        thresholdDays,
        messages: useMockData ? mockMessages : undefined
      });

      const isAutoEmptyRun =
        mode === "AUTO" &&
        response.importedCount === 0 &&
        response.unmatchedCount === 0 &&
        response.skippedCount === 0 &&
        response.errorCount === 0;

      if (!isAutoEmptyRun) {
        setImportResult(response);
      }

      setLastRunAt(new Date().toISOString());
      setLastRunMode(mode);
      await refreshSideData();
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : "Import failed");
    } finally {
      isRunningRef.current = false;
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void refreshSideData();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const withSpeech = window as Window & {
      webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
      SpeechRecognition?: SpeechRecognitionConstructorLike;
    };
    setVoiceSupported(Boolean(withSpeech.SpeechRecognition || withSpeech.webkitSpeechRecognition));
  }, []);

  useEffect(() => {
    if (!isAssistantActive) return;

    void runImport(false, "AUTO");
    const timer = setInterval(() => {
      void runImport(false, "AUTO");
    }, Math.max(30, autoIntervalSec) * 1000);

    return () => clearInterval(timer);
  }, [autoIntervalSec, isAssistantActive, thresholdDays]);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  return (
    <section>
      <h2>Assistant IA - Import Outlook</h2>
      <p>Detection OA, extraction, association projet, alertes delai et brouillons de relance.</p>

      <div style={{ ...cardStyle, marginBottom: "12px" }}>
        <strong>Assistant vocal IA: {voiceSupported ? "DISPONIBLE" : "INDISPONIBLE"}</strong>
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button type="button" disabled={!voiceSupported || isListening} onClick={startVoiceAssistant}>
            Activer le micro
          </button>
          <button type="button" disabled={!isListening} onClick={stopVoiceAssistant}>
            Arreter le micro
          </button>
          <button type="button" disabled={!voiceSupported} onClick={testVoiceAssistant}>
            Tester la voix
          </button>
          <button
            type="button"
            onClick={() => {
              setIsSpeechSynthesisEnabled((prev) => {
                const next = !prev;
                if (!next && typeof window !== "undefined" && window.speechSynthesis) {
                  window.speechSynthesis.cancel();
                }
                return next;
              });
            }}
          >
            {isSpeechSynthesisEnabled ? "Mode silencieux" : "Activer la voix"}
          </button>
          <span style={{ alignSelf: "center", color: "#374151" }}>
            Etat micro: {isListening ? "Ecoute en cours" : "Inactif"}
          </span>
          <span style={{ alignSelf: "center", color: "#374151" }}>
            Synthese: {isSpeechSynthesisEnabled ? "Active" : "Silencieuse"}
          </span>
        </div>
        {voiceWarning ? <p style={{ margin: "8px 0 0", color: "#7c3f00" }}>{voiceWarning}</p> : null}
        <p style={{ marginBottom: 0, marginTop: "8px", fontSize: "13px", color: "#4b5563" }}>
          Commandes: import demo, import boite, activer assistant, desactiver assistant, rafraichir, seuil 10, ouvre projets, ouvre documents, ouvre dashboard.
        </p>
        <div style={{ marginTop: "8px", display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <input
            type="text"
            value={typedVoiceCommand}
            onChange={(event) => setTypedVoiceCommand(event.target.value)}
            placeholder="Commande de secours (ex: import demo)"
            style={{ minWidth: "260px" }}
          />
          <button type="button" onClick={() => void runTypedVoiceCommand()}>
            Executer commande
          </button>
        </div>
        {voiceNetworkRetryCount > 0 ? (
          <p style={{ margin: "8px 0 0", color: "#7c3f00" }}>
            Reconnexion vocale en cours (tentative {voiceNetworkRetryCount}/2)...
          </p>
        ) : null}
        {lastVoiceCommand ? <p style={{ margin: "8px 0 0" }}>Derniere commande: {lastVoiceCommand}</p> : null}
        {voiceReply ? <p style={{ margin: "6px 0 0", color: "#0f766e" }}>Reponse vocale: {voiceReply}</p> : null}
        {voiceCommandHistory.length > 0 ? (
          <div style={{ marginTop: "10px" }}>
            <strong>Journal vocal</strong>
            <ul style={{ margin: "6px 0 0", paddingLeft: "20px" }}>
              {voiceCommandHistory.map((item, idx) => (
                <li key={`${item}-${idx}`}>{item}</li>
              ))}
            </ul>
          </div>
        ) : null}
      </div>

      <div style={{ ...cardStyle, marginBottom: "12px" }}>
        <strong>Etat Assistant IA: {isAssistantActive ? "ACTIF" : "INACTIF"}</strong>
        <div style={{ marginTop: "8px" }}>
          <label htmlFor="assistant-interval">Intervalle auto (sec): </label>
          <input
            id="assistant-interval"
            type="number"
            min={30}
            value={autoIntervalSec}
            onChange={(event) => setAutoIntervalSec(Number(event.target.value))}
            style={{ width: "90px", marginRight: "12px" }}
          />
          <button type="button" onClick={() => setIsAssistantActive((prev) => !prev)}>
            {isAssistantActive ? "Desactiver Assistant IA" : "Activer Assistant IA"}
          </button>
        </div>
        <div style={{ marginTop: "8px", fontSize: "13px", color: "#444" }}>
          Derniere execution: {lastRunAt ? new Date(lastRunAt).toLocaleString() : "Aucune"}
          {lastRunMode ? ` (${lastRunMode})` : ""}
        </div>
      </div>

      <div style={{ ...cardStyle, marginBottom: "12px" }}>
        <label htmlFor="delay-threshold">Seuil retard (jours): </label>
        <input
          id="delay-threshold"
          type="number"
          min={1}
          value={thresholdDays}
          onChange={(event) => setThresholdDays(Number(event.target.value))}
          style={{ width: "80px", marginRight: "12px" }}
        />

        <button type="button" onClick={() => void runImport(false, "MAILBOX")} disabled={isLoading}>
          Importer depuis la boite
        </button>
        <button type="button" onClick={() => void runImport(true, "DEMO")} disabled={isLoading} style={{ marginLeft: "8px" }}>
          Import de demo
        </button>
      </div>

      {error ? (
        <p style={{ color: "#b00020", marginTop: 0 }}>Erreur: {error}</p>
      ) : null}

      {importResult ? (
        <div style={{ display: "grid", gap: "10px", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>
          <div style={cardStyle}>Importes: {importResult.importedCount}</div>
          <div style={cardStyle}>Non associes: {importResult.unmatchedCount}</div>
          <div style={cardStyle}>Ignorer: {importResult.skippedCount}</div>
          <div style={cardStyle}>Erreurs: {importResult.errorCount}</div>
        </div>
      ) : null}

      <div style={{ marginTop: "12px", ...cardStyle }}>
        <h3 style={{ marginTop: 0 }}>Resultats importes</h3>
        {importedRows.length === 0 ? (
          <p>Aucun resultat importe pour le moment.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={{ textAlign: "left" }}>Message</th>
                <th style={{ textAlign: "left" }}>Projet</th>
                <th style={{ textAlign: "left" }}>No Carel</th>
                <th style={{ textAlign: "left" }}>BC client</th>
                <th style={{ textAlign: "left" }}>Livraison</th>
                <th style={{ textAlign: "left" }}>Alerte</th>
              </tr>
            </thead>
            <tbody>
              {importedRows.map((item) => (
                <tr key={item.messageId}>
                  <td>{item.subject}</td>
                  <td>{item.projectId ?? "-"}</td>
                  <td>{item.carelOrderNumber ?? "-"}</td>
                  <td>{item.clientPurchaseOrder ?? "-"}</td>
                  <td>{item.expectedDeliveryDate || "-"}</td>
                  <td>{item.alertCreated ? "Oui" : "Non"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div style={{ display: "grid", gap: "12px", marginTop: "12px", gridTemplateColumns: "1fr 1fr" }}>
        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Alertes IA</h3>
          {alerts.length === 0 ? (
            <p>Aucune alerte.</p>
          ) : (
            <ul>
              {alerts.map((alert) => (
                <li key={alert.id}>
                  {alert.level} - {alert.message} (Projet: {alert.projectId})
                </li>
              ))}
            </ul>
          )}
        </div>

        <div style={cardStyle}>
          <h3 style={{ marginTop: 0 }}>Brouillons e-mail</h3>
          {drafts.length === 0 ? (
            <p>Aucun brouillon.</p>
          ) : (
            <ul>
              {drafts.map((draft) => (
                <li key={draft.id}>
                  {draft.subject} - {draft.to}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </section>
  );
}
