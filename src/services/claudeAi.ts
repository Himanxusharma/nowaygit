import { storageService } from './storage';

export const claudeAiService = {
  /**
   * Auto-generate a concise, professional Git commit message using Claude API
   */
  async generateCommitMessage(filename: string, content: string, diff?: string): Promise<string> {
    const settings = await storageService.getSettings();

    // Fallback if user has not provided an Anthropic API key
    if (!settings.anthropicApiKey) {
      return `Add/update ${filename} via nowaygit`;
    }

    try {
      const prompt = `Write a concise, standard 1-line Git commit message (50 chars max, imperative mood, e.g. "Add component structure" or "Fix styling logic") for the following file:
Filename: ${filename}
${diff ? `Diff:\n${diff.slice(0, 1500)}` : `Content preview:\n${content.slice(0, 1500)}`}

Return ONLY the commit message string without quotes or preamble.`;

      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': settings.anthropicApiKey,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
          'dangerously-allow-browser': 'true'
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 100,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        })
      });

      if (!response.ok) {
        return `Add/update ${filename} via nowaygit`;
      }

      const data = await response.json();
      const rawMsg = data.content?.[0]?.text?.trim();
      return rawMsg ? rawMsg.replace(/^["']|["']$/g, '') : `Add/update ${filename} via nowaygit`;
    } catch {
      return `Add/update ${filename} via nowaygit`;
    }
  }
};
