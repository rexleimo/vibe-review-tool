import { siteCopy } from "../content/siteCopy";
import type { Locale } from "../lib/locale";

function WorkflowStrip({ locale }: { locale: Locale }) {
  const section = siteCopy[locale].home;
  const workflow = section.workflow;

  return (
    <section className="workflow-strip" id="workflow">
      <p className="section-label">{section.labels.workflow}</p>
      <h2>{workflow.title}</h2>
      <ol className="workflow-steps">
        {workflow.steps.map((step) => (
          <li key={step}>{step}</li>
        ))}
      </ol>
    </section>
  );
}

export default WorkflowStrip;
