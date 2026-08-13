import { artifactExtractor } from './extractor';
import { uiInjector } from './injector';
import { importUiInjector } from './importModal';

let lastWatchPushedContentMap: Record<string, string> = {};
let isWatchPushing = false;

function initContentScript() {
  // Initial check
  checkAndInject();

  // Set up MutationObserver to re-detect when user switches artifacts/versions
  const observer = new MutationObserver(() => {
    checkAndInject();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

async function checkAndInject() {
  // 1. Inject Import Git File button near chat input
  importUiInjector.injectImportButton();

  const artifact = artifactExtractor.extractCurrentArtifact();
  if (artifact) {
    uiInjector.injectButton(artifact);

    // 2. Watch Mode Check
    const conversationId = artifactExtractor.getConversationId();
    if (conversationId && !isWatchPushing) {
      try {
        const settingsRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
        const settings = settingsRes?.data || {};
        const watchConfig = settings.watchConfigs?.[conversationId];

        if (watchConfig) {
          const currentContent = artifact.content.trim();
          const lastContent = lastWatchPushedContentMap[conversationId];

          if (currentContent && currentContent !== lastContent) {
            // Content changed! Trigger auto-push.
            isWatchPushing = true;
            lastWatchPushedContentMap[conversationId] = currentContent;

            const pushRes = await chrome.runtime.sendMessage({
              type: 'PUSH_ARTIFACT_BY_PROVIDER',
              provider: watchConfig.provider,
              options: {
                owner: watchConfig.owner,
                repo: watchConfig.repo,
                filePath: watchConfig.filePath,
                commitMessage: `Auto-sync: update ${watchConfig.filePath} [watch mode]`,
                pushMode: watchConfig.pushMode,
                content: artifact.content
              }
            });

            if (pushRes?.success) {
              console.log('[nowaygit] Watch Mode auto-pushed successfully.');
            }
            isWatchPushing = false;
          }
        }
      } catch (err) {
        isWatchPushing = false;
      }
    }
  }

  const allArtifacts = artifactExtractor.extractAllArtifacts();
  if (allArtifacts.length > 1) {
    // If multiple artifacts exist, we can enable batch push
    const headerEl = document.querySelector('header') || document.querySelector('.conversation-header');
    if (headerEl && !document.getElementById('nowaygit-push-all-btn')) {
      const btn = document.createElement('button');
      btn.id = 'nowaygit-push-all-btn';
      btn.innerHTML = `<span>Push All (${allArtifacts.length}) to GitHub</span>`;
      Object.assign(btn.style, {
        marginLeft: '12px',
        padding: '5px 10px',
        fontSize: '12px',
        fontWeight: '600',
        color: '#fff',
        background: 'linear-gradient(135deg, #a855f7 0%, #6366f1 100%)',
        border: 'none',
        borderRadius: '6px',
        cursor: 'pointer'
      });
      btn.onclick = () => {
        const latestAll = artifactExtractor.extractAllArtifacts();
        uiInjector.openMultiPushModal(latestAll);
      };
      headerEl.appendChild(btn);
    }
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
