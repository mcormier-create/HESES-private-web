import { useEffect, useState } from "react";
import { DashboardPage } from "./modules/dashboard/DashboardPage";
import { DocumentsPage } from "./modules/documents/DocumentsPage";
import { InboxSyncPage } from "./modules/inbox/InboxSyncPage";
import { ProjectsPage } from "./modules/projects/ProjectsPage";
import { SettingsPage } from "./modules/settings/SettingsPage";

const tabs = ["Tableau de bord", "Projets", "Documents", "Assistant IA", "Parametres"];

export function App() {
  const [activeTab, setActiveTab] = useState<(typeof tabs)[number]>("Tableau de bord");

  useEffect(() => {
    function handleNavigate(event: Event) {
      const customEvent = event as CustomEvent<string>;
      const target = (customEvent.detail ?? "").toLowerCase();
      if (target === "tableau de bord" || target === "dashboard") setActiveTab("Tableau de bord");
      if (target === "projets") setActiveTab("Projets");
      if (target === "documents") setActiveTab("Documents");
      if (target === "assistant ia" || target === "assistant") setActiveTab("Assistant IA");
      if (target === "parametres" || target === "paramètres") setActiveTab("Parametres");
    }

    window.addEventListener("enersol:navigate", handleNavigate);
    return () => window.removeEventListener("enersol:navigate", handleNavigate);
  }, []);

  function renderActiveTab() {
    if (activeTab === "Tableau de bord") return <DashboardPage />;
    if (activeTab === "Projets") return <ProjectsPage />;
    if (activeTab === "Documents") return <DocumentsPage />;
    if (activeTab === "Assistant IA") return <InboxSyncPage />;
    return <SettingsPage />;
  }

  return (
    <main className="app-shell">
      <h1 className="app-title">Enersol One - MVP</h1>
      <nav>
        <ul className="tab-list">
          {tabs.map((tab) => (
            <li key={tab}>
              <button
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`tab-button${activeTab === tab ? " active" : ""}`}
              >
                {tab}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="panel">{renderActiveTab()}</div>
    </main>
  );
}
