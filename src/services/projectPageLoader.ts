let projectPage: Promise<typeof import('../views/ProjectPage')> | undefined;

export function loadProjectPage() {
  return projectPage ??= import('../views/ProjectPage').catch(cause => {
    projectPage = undefined;
    throw cause;
  });
}

export function preloadProjectPage() {
  // Pointer/focus intent loads the core page, never the lazy widget renderers.
  void loadProjectPage().catch(() => {});
}
