export interface ArtifactData {
  id?: string;
  title: string;
  type: string; // e.g. 'application/vnd.ant.react', 'html', 'python', 'markdown'
  language: string; // e.g. 'tsx', 'javascript', 'html', 'python', 'markdown', 'json'
  content: string;
  inferredFilename: string;
}

export interface GitHubDeviceCodeResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  expires_in: number;
  interval: number;
}

export interface GitHubRepo {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  default_branch: string;
  html_url: string;
  owner: {
    login: string;
    avatar_url?: string;
  };
}

export interface GitHubBranch {
  name: string;
  commit: {
    sha: string;
  };
}

export interface PushOptions {
  owner: string;
  repo: string;
  isNewRepo: boolean;
  isPrivateRepo?: boolean;
  repoDescription?: string;
  filePath: string;
  commitMessage: string;
  pushMode: 'branch_pr' | 'direct';
  targetBranch?: string; // custom branch name if branch_pr
  prTitle?: string;
  prBody?: string;
  content: string;
  existingSha?: string;
}

export interface PushResult {
  success: boolean;
  commitUrl?: string;
  prUrl?: string;
  branchName?: string;
  error?: string;
}

export interface MultiPushOptions {
  owner: string;
  repo: string;
  isNewRepo: boolean;
  isPrivateRepo?: boolean;
  repoDescription?: string;
  commitMessage: string;
  pushMode: 'branch_pr' | 'direct';
  targetBranch?: string;
  prTitle?: string;
  prBody?: string;
  files: Array<{
    filePath: string;
    content: string;
  }>;
  generateReadme?: boolean;
}

export interface DiffLine {
  type: 'same' | 'add' | 'delete';
  oldLineNumber?: number;
  newLineNumber?: number;
  text: string;
}

export interface ExtensionSettings {
  githubClientId: string;
  anthropicApiKey?: string;
  defaultPushMode: 'branch_pr' | 'direct';
  lastUsedRepo?: {
    owner: string;
    repo: string;
    filePath: string;
  };
  conversationRepos?: Record<string, { owner: string; repo: string; folderPath: string }>;
}

export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
}

// Runtime messaging protocols
export type MessageType =
  | 'INITIATE_AUTH'
  | 'POLL_AUTH'
  | 'CHECK_AUTH_STATUS'
  | 'LOGOUT'
  | 'GET_REPOS'
  | 'CREATE_REPO'
  | 'GET_FILE_CONTENTS'
  | 'PUSH_ARTIFACT'
  | 'PUSH_MULTI_ARTIFACTS'
  | 'GENERATE_COMMIT_MESSAGE'
  | 'GENERATE_README'
  | 'GET_SETTINGS'
  | 'SAVE_SETTINGS'
  | 'GET_CONVERSATION_SETTINGS'
  | 'SAVE_CONVERSATION_SETTINGS';

export interface BaseMessage {
  type: MessageType;
}

export interface InitiateAuthMessage extends BaseMessage {
  type: 'INITIATE_AUTH';
}

export interface PollAuthMessage extends BaseMessage {
  type: 'POLL_AUTH';
}

export interface CheckAuthStatusMessage extends BaseMessage {
  type: 'CHECK_AUTH_STATUS';
}

export interface LogoutMessage extends BaseMessage {
  type: 'LOGOUT';
}

export interface GetReposMessage extends BaseMessage {
  type: 'GET_REPOS';
}

export interface CreateRepoMessage extends BaseMessage {
  type: 'CREATE_REPO';
  name: string;
  description?: string;
  isPrivate: boolean;
}

export interface GetFileContentsMessage extends BaseMessage {
  type: 'GET_FILE_CONTENTS';
  owner: string;
  repo: string;
  path: string;
  ref?: string;
}

export interface PushArtifactMessage extends BaseMessage {
  type: 'PUSH_ARTIFACT';
  options: PushOptions;
}

export interface PushMultiArtifactsMessage extends BaseMessage {
  type: 'PUSH_MULTI_ARTIFACTS';
  options: MultiPushOptions;
}

export interface GenerateCommitMessageMessage extends BaseMessage {
  type: 'GENERATE_COMMIT_MESSAGE';
  filename: string;
  content: string;
  diff?: string;
}

export interface GenerateReadmeMessage extends BaseMessage {
  type: 'GENERATE_README';
  projectName: string;
  files: Array<{ filename: string; content: string }>;
}

export interface GetSettingsMessage extends BaseMessage {
  type: 'GET_SETTINGS';
}

export interface SaveSettingsMessage extends BaseMessage {
  type: 'SAVE_SETTINGS';
  settings: Partial<ExtensionSettings>;
}

export interface GetConversationSettingsMessage extends BaseMessage {
  type: 'GET_CONVERSATION_SETTINGS';
  conversationId: string;
}

export interface SaveConversationSettingsMessage extends BaseMessage {
  type: 'SAVE_CONVERSATION_SETTINGS';
  conversationId: string;
  repo: { owner: string; repo: string; folderPath: string };
}

export type ExtensionMessage =
  | InitiateAuthMessage
  | PollAuthMessage
  | CheckAuthStatusMessage
  | LogoutMessage
  | GetReposMessage
  | CreateRepoMessage
  | GetFileContentsMessage
  | PushArtifactMessage
  | PushMultiArtifactsMessage
  | GenerateCommitMessageMessage
  | GenerateReadmeMessage
  | GetSettingsMessage
  | SaveSettingsMessage
  | GetConversationSettingsMessage
  | SaveConversationSettingsMessage;
