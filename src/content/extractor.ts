import { ArtifactData } from '../types';

export const LANGUAGE_EXTENSION_MAP: Record<string, string> = {
  react: 'tsx',
  jsx: 'jsx',
  tsx: 'tsx',
  typescript: 'ts',
  ts: 'ts',
  javascript: 'js',
  js: 'js',
  html: 'html',
  css: 'css',
  python: 'py',
  py: 'py',
  markdown: 'md',
  md: 'md',
  json: 'json',
  svg: 'svg',
  yaml: 'yml',
  yml: 'yml',
  bash: 'sh',
  shell: 'sh',
  sql: 'sql'
};

export const artifactExtractor = {
  /**
   * Infer appropriate file extension from language tag or content heuristic
   */
  inferExtension(langOrType: string): string {
    const clean = langOrType.toLowerCase().trim();
    if (LANGUAGE_EXTENSION_MAP[clean]) {
      return LANGUAGE_EXTENSION_MAP[clean];
    }
    // Generic search in string
    for (const [key, ext] of Object.entries(LANGUAGE_EXTENSION_MAP)) {
      if (clean.includes(key)) return ext;
    }
    return 'txt';
  },

  /**
   * Clean and sanitize suggested filename
   */
  sanitizeFilename(title: string, extension: string): string {
    let clean = title
      .toLowerCase()
      .replace(/[^a-z0-9._-]/gi, '_')
      .replace(/_+/g, '_')
      .replace(/^_|_$/g, '');

    if (!clean) clean = 'artifact';

    // If extension is already on title, keep it, else append
    if (!clean.endsWith(`.${extension}`)) {
      clean = `${clean}.${extension}`;
    }

    return clean;
  },

  /**
   * Extract active artifact details from claude.ai DOM
   */
  extractCurrentArtifact(): ArtifactData | null {
    // Look for claude.ai artifact drawer or code container
    // Primary selectors used across current & legacy claude.ai layouts
    const artifactPanel =
      document.querySelector('[data-testid="artifact-content"]') ||
      document.querySelector('.artifact-content') ||
      document.querySelector('div[class*="artifact-"]') ||
      document.querySelector('aside[class*="artifact"]') ||
      document.querySelector('.code-block') ||
      document.querySelector('pre');

    if (!artifactPanel) {
      return null;
    }

    // Try extracting title from header
    const titleEl =
      document.querySelector('[data-testid="artifact-header"] h1, [data-testid="artifact-header"] h2, [data-testid="artifact-header"] span') ||
      document.querySelector('.artifact-header') ||
      document.querySelector('header span') ||
      document.querySelector('div[class*="header"] span');

    const title = titleEl?.textContent?.trim() || 'claude_artifact';

    // Try extracting language tag
    const langEl =
      artifactPanel.querySelector('[data-language]') ||
      document.querySelector('.language-label') ||
      artifactPanel.querySelector('code[class*="language-"]');

    let language = 'text';
    if (langEl) {
      const attr = langEl.getAttribute('data-language');
      if (attr) {
        language = attr;
      } else {
        const match = langEl.className.match(/language-([a-z0-9_-]+)/i);
        if (match) language = match[1];
      }
    }

    // Extract raw content
    const codeEl = artifactPanel.querySelector('code') || artifactPanel.querySelector('pre') || artifactPanel;
    const content = codeEl.textContent || '';

    if (!content.trim()) {
      return null;
    }

    const extension = this.inferExtension(language);
    const inferredFilename = this.sanitizeFilename(title, extension);

    return {
      title,
      type: language,
      language,
      content,
      inferredFilename
    };
  },

  /**
   * Extract conversation ID from URL
   */
  getConversationId(): string | null {
    const match = window.location.pathname.match(/\/chat\/([a-zA-Z0-9-]+)/);
    return match ? match[1] : null;
  },

  /**
   * Extract all artifacts present in the active conversation
   */
  extractAllArtifacts(): ArtifactData[] {
    const artifacts: ArtifactData[] = [];
    const elements = document.querySelectorAll(
      '[data-testid="artifact-content"], .artifact-content, div[class*="artifact-"], aside[class*="artifact"], .code-block, pre'
    );

    const seenContents = new Set<string>();

    elements.forEach((el, index) => {
      const codeEl = el.querySelector('code') || el.querySelector('pre') || el;
      const content = codeEl.textContent || '';

      if (content.trim() && !seenContents.has(content.trim())) {
        seenContents.add(content.trim());

        const titleEl =
          el.querySelector('header span, h1, h2') ||
          document.querySelector('[data-testid="artifact-header"] span');
        const title = titleEl?.textContent?.trim() || `artifact_${index + 1}`;

        let language = 'text';
        const langEl = el.querySelector('[data-language]') || el.querySelector('code[class*="language-"]');
        if (langEl) {
          const attr = langEl.getAttribute('data-language');
          if (attr) {
            language = attr;
          } else {
            const match = langEl.className.match(/language-([a-z0-9_-]+)/i);
            if (match) language = match[1];
          }
        }

        const extension = this.inferExtension(language);
        const inferredFilename = this.sanitizeFilename(title, extension);

        artifacts.push({
          title,
          type: language,
          language,
          content,
          inferredFilename
        });
      }
    });

    return artifacts;
  }
};
