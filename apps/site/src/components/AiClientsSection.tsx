import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function AiClientsSection({ locale }: { locale: Locale }) {
  const home = siteCopy[locale].home;
  const clients = home.aiClients;

  return (
    <section className="editorial-section clients-section">
      <p className="section-label">{home.labels.aiClients}</p>
      <div className="client-list">
        {clients.map((client) => (
          <span key={client} className="client-pill">
            {client}
          </span>
        ))}
      </div>
    </section>
  );
}

export default AiClientsSection;
