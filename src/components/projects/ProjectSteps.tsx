export function ProjectSteps({ step }: { step: 1 | 2 }) {
  return (
    <ol className="project-steps" aria-label="Project creation progress">
      <li aria-current={step === 1 ? 'step' : undefined}><span aria-hidden="true">01</span><span className="sr-only">Project identity</span></li>
      <li className="step-connector" aria-hidden="true" />
      <li aria-current={step === 2 ? 'step' : undefined}><span aria-hidden="true">02</span><span className="sr-only">Project links</span></li>
    </ol>
  );
}
