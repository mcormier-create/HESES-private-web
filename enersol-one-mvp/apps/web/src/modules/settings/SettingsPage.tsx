export function SettingsPage() {
  return (
    <section>
      <h2>Parametres</h2>
      <p>Configuration MVP pour l integration Microsoft Graph et les seuils d alertes.</p>
      <ul>
        <li>Tenant ID / Client ID / Client Secret</li>
        <li>Boite Outlook a surveiller</li>
        <li>Frequence de synchronisation</li>
        <li>Seuil de retard (jours)</li>
      </ul>
    </section>
  );
}
