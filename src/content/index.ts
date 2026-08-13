import { artifactExtractor } from './extractor';
import { uiInjector } from './injector';

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

function checkAndInject() {
  const artifact = artifactExtractor.extractCurrentArtifact();
  if (artifact) {
    uiInjector.injectButton(artifact);
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
