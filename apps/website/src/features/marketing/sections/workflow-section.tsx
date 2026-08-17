const workflow = `- name: Run visual tests
  run: pnpm playwright test
  env:
    PVC_SERVER_URL: \${{ vars.PVC_SERVER_URL }}
    PVC_TOKEN: \${{ secrets.PVC_TOKEN }}
    PVC_ENVIRONMENT: release

- name: Gate visual changes
  run: pnpm exec pvc status`;

export function WorkflowSection() {
  return (
    <section className="workflow-section">
      <div>
        <p className="eyebrow">
          <span>04</span> GitHub Actions
        </p>
        <h2>Make visual approval part of the merge contract.</h2>
        <p>
          Run tests on every pull request, upload changes in parallel, then gate the check until the
          review is complete.
        </p>
      </div>
      <pre className="code-window">
        <span className="window-label">.github/workflows/visual.yml</span>
        <code>{workflow}</code>
      </pre>
    </section>
  );
}
