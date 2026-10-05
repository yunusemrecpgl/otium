import { dataRepository } from './storage';

function downloadJson(value: unknown, prefix: string) {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${prefix}-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(anchor);
    try { anchor.click(); } finally { anchor.remove(); }
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
}

export async function exportWorkspace() {
  downloadJson(await dataRepository.exportWorkspace(), 'otium-workspace');
}

export async function exportRecoveryData() {
  // Bypasses all workspace parsers, including for future/unsupported schemas.
  downloadJson(await dataRepository.exportRecoveryData(), 'otium-recovery');
}
