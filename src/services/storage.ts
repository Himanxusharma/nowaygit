import { ExtensionSettings, GitHubUser } from '../types';

const DEFAULT_SETTINGS: ExtensionSettings = {
  githubClientId: 'Ov23liZ2Ym642n4jZ9aO', // Default Client ID placeholder or standard OAuth App client ID
  defaultPushMode: 'branch_pr'
};

export const storageService = {
  // Session storage (access tokens & transient auth data)
  async getAccessToken(): Promise<string | null> {
    try {
      const result = await chrome.storage.session.get('github_access_token');
      return result.github_access_token || null;
    } catch {
      return null;
    }
  },

  async setAccessToken(token: string): Promise<void> {
    await chrome.storage.session.set({ github_access_token: token });
  },

  async clearAccessToken(): Promise<void> {
    await chrome.storage.session.remove(['github_access_token', 'github_user']);
  },

  async getAuthUser(): Promise<GitHubUser | null> {
    try {
      const result = await chrome.storage.session.get('github_user');
      return result.github_user || null;
    } catch {
      return null;
    }
  },

  async setAuthUser(user: GitHubUser): Promise<void> {
    await chrome.storage.session.set({ github_user: user });
  },

  // Local storage (settings & preferences)
  async getSettings(): Promise<ExtensionSettings> {
    try {
      const result = await chrome.storage.local.get('nowaygit_settings');
      return { ...DEFAULT_SETTINGS, ...(result.nowaygit_settings || {}) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: Partial<ExtensionSettings>): Promise<ExtensionSettings> {
    const current = await this.getSettings();
    const updated = { ...current, ...settings };
    await chrome.storage.local.set({ nowaygit_settings: updated });
    return updated;
  }
};
