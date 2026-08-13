import { ExtensionMessage } from '../types';
import { githubService } from '../services/github';
import { storageService } from '../services/storage';
import { claudeAiService } from '../services/claudeAi';
import { logger } from '../services/logger';

// Active polling timers
let activePollTimer: number | null = null;

chrome.runtime.onMessage.addListener(
  (message: ExtensionMessage, _sender, sendResponse: (response: any) => void) => {
    handleMessage(message)
      .then((res) => sendResponse({ success: true, data: res }))
      .catch((err) => {
        logger.logError('BACKGROUND', err, `Action: ${message.type}`);
        sendResponse({ success: false, error: err.message || String(err) });
      });

    return true; // Keep channel open for async response
  }
);

async function handleMessage(message: ExtensionMessage): Promise<any> {
  switch (message.type) {
    case 'INITIATE_AUTH': {
      const settings = await storageService.getSettings();
      const deviceCodeData = await githubService.initiateDeviceFlow(settings.githubClientId);
      return deviceCodeData;
    }

    case 'POLL_AUTH': {
      // Background helper call or UI polling trigger
      return { status: 'polling' };
    }

    case 'CHECK_AUTH_STATUS': {
      const token = await storageService.getAccessToken();
      if (!token) {
        return { authenticated: false, user: null };
      }
      try {
        let user = await storageService.getAuthUser();
        if (!user) {
          user = await githubService.fetchUser(token);
          await storageService.setAuthUser(user);
        }
        return { authenticated: true, user };
      } catch {
        await storageService.clearAccessToken();
        return { authenticated: false, user: null };
      }
    }

    case 'LOGOUT': {
      if (activePollTimer) clearInterval(activePollTimer);
      await storageService.clearAccessToken();
      return { authenticated: false };
    }

    case 'GET_REPOS': {
      return await githubService.getRepositories();
    }

    case 'CREATE_REPO': {
      return await githubService.createRepository(message.name, message.description, message.isPrivate);
    }

    case 'GET_FILE_CONTENTS': {
      return await githubService.getFileContents(
        message.owner,
        message.repo,
        message.path,
        message.ref
      );
    }

    case 'PUSH_ARTIFACT': {
      return await githubService.pushArtifact(message.options);
    }

    case 'PUSH_MULTI_ARTIFACTS': {
      return await githubService.pushMultipleArtifacts(message.options);
    }

    case 'GENERATE_COMMIT_MESSAGE': {
      return await claudeAiService.generateCommitMessage(
        message.filename,
        message.content,
        message.diff
      );
    }

    case 'GENERATE_README': {
      return await claudeAiService.generateReadme(message.projectName, message.files);
    }

    case 'GET_SETTINGS': {
      return await storageService.getSettings();
    }

    case 'SAVE_SETTINGS': {
      return await storageService.saveSettings(message.settings);
    }

    case 'GET_CONVERSATION_SETTINGS': {
      return await storageService.getConversationRepo(message.conversationId);
    }

    case 'SAVE_CONVERSATION_SETTINGS': {
      await storageService.saveConversationRepo(message.conversationId, message.repo);
      return { success: true };
    }

    case 'GET_DIAGNOSTICS': {
      return await logger.getLogs();
    }

    case 'CLEAR_DIAGNOSTICS': {
      await logger.clearLogs();
      return { success: true };
    }

    default:
      throw new Error(`Unknown message type: ${(message as any).type}`);
  }
}
