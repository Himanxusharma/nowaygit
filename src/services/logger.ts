export interface DiagnosticLog {
  timestamp: string;
  source: string;
  message: string;
  details?: string;
}

const MAX_LOGS = 20;

export const logger = {
  async getLogs(): Promise<DiagnosticLog[]> {
    try {
      const res = await chrome.storage.local.get('nowaygit_diagnostics');
      return res.nowaygit_diagnostics || [];
    } catch {
      return [];
    }
  },

  async logError(source: string, error: any, details?: string): Promise<void> {
    try {
      const logs = await this.getLogs();
      const message = typeof error === 'string' ? error : error?.message || String(error);
      const newEntry: DiagnosticLog = {
        timestamp: new Date().toISOString(),
        source,
        message,
        details
      };

      const updated = [newEntry, ...logs].slice(0, MAX_LOGS);
      await chrome.storage.local.set({ nowaygit_diagnostics: updated });
    } catch {
      // Ignore storage errors in logger
    }
  },

  async clearLogs(): Promise<void> {
    await chrome.storage.local.remove('nowaygit_diagnostics');
  }
};
