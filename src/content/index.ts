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
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initContentScript);
} else {
  initContentScript();
}
