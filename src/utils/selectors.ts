/**
 * Isolated DOM Selector Configuration for claude.ai
 * TRD Section 3 Requirement: Isolate all DOM selectors in one module so UI changes on Anthropic's side require a one-file patch.
 */

export const SELECTORS = {
  // Primary container selectors for active artifact drawer/panel
  ARTIFACT_CONTAINERS: [
    '[data-testid="artifact-content"]',
    '.artifact-content',
    'div[class*="artifact-"]',
    'aside[class*="artifact"]',
    '.code-block',
    'pre'
  ],

  // Selectors for artifact title/header
  ARTIFACT_HEADER_TITLE: [
    '[data-testid="artifact-header"] h1',
    '[data-testid="artifact-header"] h2',
    '[data-testid="artifact-header"] span',
    '.artifact-header',
    'header span',
    'div[class*="header"] span'
  ],

  // Selectors for language indicators
  LANGUAGE_LABEL: [
    '[data-language]',
    '.language-label',
    'code[class*="language-"]'
  ],

  // Selectors for code text content
  CODE_CONTAINER: [
    'code',
    'pre'
  ],

  // Header toolbar target where nowaygit injects the "Push to GitHub" button
  TOOLBAR_TARGET: [
    '[data-testid="artifact-header"]',
    'header',
    '.artifact-header'
  ],

  // Top-level conversation header target for "Push All" button
  CONVERSATION_HEADER_TARGET: [
    'header',
    '.conversation-header'
  ],

  // Chat input field/container targets for "Import from Git" button injection
  CHAT_INPUT_CONTAINERS: [
    'div.flex.components-chat-input-textarea',
    'fieldset div.flex.flex-col',
    '[data-testid="chat-input"]',
    'textarea[placeholder*="Ask Claude"]',
    '.chat-input-container'
  ]
};
