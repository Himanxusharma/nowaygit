import { GitHubRepo, PushOptions, MultiPushOptions, PushResult } from '../types';
import { storageService } from './storage';

export const gitlabService = {
  async getHeaders(): Promise<{ 'Private-Token': string }> {
    const settings = await storageService.getSettings();
    if (!settings.gitlabToken) {
      throw new Error('GitLab token not configured in settings.');
    }
    return { 'Private-Token': settings.gitlabToken };
  },

  async getBaseUrl(): Promise<string> {
    const settings = await storageService.getSettings();
    const host = settings.gitlabHost?.trim() || 'https://gitlab.com';
    return `${host.replace(/\/$/, '')}/api/v4`;
  },

  async getProjects(): Promise<GitHubRepo[]> {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();

    const response = await fetch(`${baseUrl}/projects?membership=true&simple=true&per_page=100&sort=desc&order_by=last_activity_at`, {
      headers
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GitLab projects (${response.status})`);
    }

    const data = await response.json();
    return data.map((p: any) => ({
      id: p.id,
      name: p.name,
      full_name: p.path_with_namespace,
      private: p.visibility === 'private',
      default_branch: p.default_branch || 'main',
      html_url: p.web_url,
      owner: {
        login: p.namespace?.path || ''
      }
    }));
  },

  async createProject(name: string, description?: string, isPrivate = false): Promise<GitHubRepo> {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();

    const response = await fetch(`${baseUrl}/projects`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description,
        visibility: isPrivate ? 'private' : 'public',
        initialize_with_readme: true
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.message || `Failed to create GitLab project (${response.status})`);
    }

    const p = await response.json();
    return {
      id: p.id,
      name: p.name,
      full_name: p.path_with_namespace,
      private: p.visibility === 'private',
      default_branch: p.default_branch || 'main',
      html_url: p.web_url,
      owner: {
        login: p.namespace?.path || ''
      }
    };
  },

  async getFileContents(projectId: number | string, path: string, ref?: string) {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const encodedPath = encodeURIComponent(cleanPath);
    const branchRef = ref || 'main';
    const encodedProjectId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;

    const response = await fetch(`${baseUrl}/projects/${encodedProjectId}/repository/files/${encodedPath}?ref=${encodeURIComponent(branchRef)}`, {
      headers
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to check file existence in GitLab (${response.status})`);
    }

    const data = await response.json();
    let content = '';
    if (data.content && data.encoding === 'base64') {
      try {
        content = decodeURIComponent(escape(atob(data.content.replace(/\s/g, ''))));
      } catch {
        content = atob(data.content.replace(/\s/g, ''));
      }
    }

    return {
      sha: data.blob_id,
      content,
      size: data.size
    };
  },

  async getFileTree(projectId: number | string, ref?: string): Promise<string[]> {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();
    const branchRef = ref || 'main';
    const encodedProjectId = typeof projectId === 'string' ? encodeURIComponent(projectId) : projectId;

    const response = await fetch(`${baseUrl}/projects/${encodedProjectId}/repository/tree?recursive=true&per_page=100&ref=${encodeURIComponent(branchRef)}`, {
      headers
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    return data.filter((item: any) => item.type === 'blob').map((item: any) => item.path);
  },

  async pushArtifact(options: PushOptions): Promise<PushResult> {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();
    const { owner, repo, filePath, commitMessage, pushMode, content } = options;

    // Use full_name or project ID from storage
    const projectId = encodeURIComponent(`${owner}/${repo}`);
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // 1. Get Project default branch
    const projectRes = await fetch(`${baseUrl}/projects/${projectId}`, { headers });
    if (!projectRes.ok) {
      throw new Error(`GitLab project "${owner}/${repo}" not found or token has insufficient permissions.`);
    }
    const projectData = await projectRes.json();
    const defaultBranch = projectData.default_branch || 'main';

    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    // 2. Handle branch creation if branch_pr
    if (pushMode === 'branch_pr') {
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-${cleanPath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase()}-${timestamp}`;
      targetBranch = createdBranchName;

      const createBranchRes = await fetch(`${baseUrl}/projects/${projectId}/repository/branches`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: createdBranchName,
          ref: defaultBranch
        })
      });

      if (!createBranchRes.ok) {
        const err = await createBranchRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create GitLab branch "${createdBranchName}".`);
      }
    }

    // 3. Determine if file already exists on target branch
    const existingFile = await this.getFileContents(owner + '/' + repo, cleanPath, targetBranch);
    const action = existingFile ? 'update' : 'create';

    // 4. Commit file change
    const base64Content = btoa(unescape(encodeURIComponent(content)));
    const commitRes = await fetch(`${baseUrl}/projects/${projectId}/repository/commits`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: targetBranch,
        commit_message: commitMessage || `Push ${cleanPath} via nowaygit`,
        actions: [
          {
            action,
            file_path: cleanPath,
            content: base64Content,
            encoding: 'base64'
          }
        ]
      })
    });

    if (!commitRes.ok) {
      const err = await commitRes.json().catch(() => ({}));
      throw new Error(err.message || `Failed to commit files to GitLab (${commitRes.status})`);
    }

    const commitData = await commitRes.json();
    const commitUrl = `${projectData.web_url}/-/commit/${commitData.id}`;

    // 5. Open Merge Request (equivalent to PR)
    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const mrRes = await fetch(`${baseUrl}/projects/${projectId}/merge_requests`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_branch: createdBranchName,
          target_branch: defaultBranch,
          title: options.prTitle || commitMessage || `Merge updates to ${cleanPath}`,
          description: options.prBody || `Automated Merge Request generated by **nowaygit** from claude.ai.`
        })
      });

      if (mrRes.ok) {
        const mrData = await mrRes.json();
        prUrl = mrData.web_url;
      }
    }

    return {
      success: true,
      commitUrl,
      prUrl,
      branchName: createdBranchName
    };
  },

  async pushMultipleArtifacts(options: MultiPushOptions): Promise<PushResult> {
    const headers = await this.getHeaders();
    const baseUrl = await this.getBaseUrl();
    const { owner, repo, commitMessage, pushMode, files } = options;

    const projectId = encodeURIComponent(`${owner}/${repo}`);

    const projectRes = await fetch(`${baseUrl}/projects/${projectId}`, { headers });
    if (!projectRes.ok) {
      throw new Error(`GitLab project "${owner}/${repo}" not found.`);
    }
    const projectData = await projectRes.json();
    const defaultBranch = projectData.default_branch || 'main';

    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    if (pushMode === 'branch_pr') {
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-batch-${timestamp}`;
      targetBranch = createdBranchName;

      const createBranchRes = await fetch(`${baseUrl}/projects/${projectId}/repository/branches`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          branch: createdBranchName,
          ref: defaultBranch
        })
      });

      if (!createBranchRes.ok) {
        const err = await createBranchRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create GitLab branch.`);
      }
    }

    // Prepare commits actions array
    const actions = [];
    for (const f of files) {
      const cleanPath = f.filePath.startsWith('/') ? f.filePath.slice(1) : f.filePath;
      const existing = await this.getFileContents(owner + '/' + repo, cleanPath, targetBranch);
      const base64Content = btoa(unescape(encodeURIComponent(f.content)));

      actions.push({
        action: existing ? 'update' : 'create',
        file_path: cleanPath,
        content: base64Content,
        encoding: 'base64'
      });
    }

    const commitRes = await fetch(`${baseUrl}/projects/${projectId}/repository/commits`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        branch: targetBranch,
        commit_message: commitMessage || `Batch push ${files.length} files via nowaygit`,
        actions
      })
    });

    if (!commitRes.ok) {
      throw new Error(`Failed to commit batch updates to GitLab.`);
    }

    const commitData = await commitRes.json();
    const commitUrl = `${projectData.web_url}/-/commit/${commitData.id}`;

    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const mrRes = await fetch(`${baseUrl}/projects/${projectId}/merge_requests`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          source_branch: createdBranchName,
          target_branch: defaultBranch,
          title: options.prTitle || commitMessage || `Merge batch updates (${files.length} files)`,
          description: options.prBody || `Automated Merge Request generated by **nowaygit** from claude.ai.`
        })
      });

      if (mrRes.ok) {
        const mrData = await mrRes.json();
        prUrl = mrData.web_url;
      }
    }

    return {
      success: true,
      commitUrl,
      prUrl,
      branchName: createdBranchName
    };
  }
};
