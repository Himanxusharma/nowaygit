import {
  GitHubDeviceCodeResponse,
  GitHubRepo,
  GitHubUser,
  PushOptions,
  PushResult,
  MultiPushOptions
} from '../types';
import { storageService } from './storage';

export const githubService = {
  /**
   * Initiate OAuth Device Flow
   */
  async initiateDeviceFlow(clientId: string): Promise<GitHubDeviceCodeResponse> {
    const response = await fetch('https://github.com/login/device/code', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        scope: 'repo user'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to initiate Device Flow: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Poll for access token during Device Flow
   */
  async pollAccessToken(
    clientId: string,
    deviceCode: string
  ): Promise<{ access_token?: string; error?: string }> {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        client_id: clientId,
        device_code: deviceCode,
        grant_type: 'urn:ietf:params:oauth:grant-type:device_code'
      })
    });

    if (!response.ok) {
      throw new Error(`Failed to poll access token: ${response.statusText}`);
    }

    return await response.json();
  },

  /**
   * Fetch authenticated GitHub user details
   */
  async fetchUser(token: string): Promise<GitHubUser> {
    const response = await fetch('https://api.github.com/user', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch GitHub user profile (${response.status})`);
    }

    const data = await response.json();
    return {
      login: data.login,
      name: data.name || data.login,
      avatar_url: data.avatar_url,
      html_url: data.html_url
    };
  },

  /**
   * List accessible user repositories
   */
  async getRepositories(): Promise<GitHubRepo[]> {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');

    const response = await fetch('https://api.github.com/user/repos?sort=updated&per_page=100', {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch repositories (${response.status})`);
    }

    return await response.json();
  },

  /**
   * Create a new repository
   */
  async createRepository(name: string, description?: string, isPrivate = false): Promise<GitHubRepo> {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');

    const response = await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description,
        private: isPrivate,
        auto_init: true // Ensure repo is initialized with a default commit & branch
      })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      throw new Error(errData.message || `Failed to create repository (${response.status})`);
    }

    return await response.json();
  },

  /**
   * Get existing file info (SHA & Content) at specified path
   */
  async getFileContents(owner: string, repo: string, path: string, ref?: string) {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');

    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    let url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(cleanPath)}`;
    if (ref) {
      url += `?ref=${encodeURIComponent(ref)}`;
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (response.status === 404) {
      return null; // File does not exist yet
    }

    if (!response.ok) {
      throw new Error(`Failed to check file existence (${response.status})`);
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
      sha: data.sha,
      content,
      size: data.size
    };
  },

  /**
   * Get recursive repository file tree using Git Data Trees API
   */
  async getFileTree(owner: string, repo: string, ref?: string): Promise<string[]> {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');
    const branchRef = ref || 'main';

    const url = `https://api.github.com/repos/${owner}/${repo}/git/trees/${encodeURIComponent(branchRef)}?recursive=1`;
    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const tree = data.tree || [];
    return tree
      .filter((item: any) => item.type === 'blob')
      .map((item: any) => item.path);
  },

  /**
   * Push artifact file to GitHub (supporting direct commit or branch + PR)
   */
  async pushArtifact(options: PushOptions): Promise<PushResult> {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');

    const { owner, repo, filePath, commitMessage, pushMode, content, existingSha } = options;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // 1. Fetch repo details to get default branch name
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!repoRes.ok) {
      throw new Error(`Target repository "${owner}/${repo}" not found or inaccessible.`);
    }

    const repoData = await repoRes.json();
    const defaultBranch: string = repoData.default_branch || 'main';

    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    // 2. If Branch + PR mode, create a new branch from default branch
    if (pushMode === 'branch_pr') {
      const refRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json'
          }
        }
      );

      if (!refRes.ok) {
        throw new Error(`Could not fetch default branch "${defaultBranch}" ref.`);
      }

      const refData = await refRes.json();
      const parentSha: string = refData.object.sha;

      // Generate a unique branch name
      const sanitizeName = cleanPath.replace(/[^a-zA-Z0-9]/g, '-').toLowerCase();
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-${sanitizeName}-${timestamp}`;
      targetBranch = createdBranchName;

      // Create branch ref
      const createBranchRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ref: `refs/heads/${createdBranchName}`,
            sha: parentSha
          })
        }
      );

      if (!createBranchRes.ok) {
        const err = await createBranchRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create branch "${createdBranchName}".`);
      }
    }

    // 3. Encode content to Base64 (handling UTF-8)
    const base64Content = btoa(unescape(encodeURIComponent(content)));

    // 4. Check for existing file SHA on target branch if not supplied
    let fileSha = existingSha;
    if (!fileSha) {
      const existingFile = await this.getFileContents(owner, repo, cleanPath, targetBranch);
      if (existingFile) {
        fileSha = existingFile.sha;
      }
    }

    // 5. Write file via Contents API (PUT)
    const putRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(cleanPath)}`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message: commitMessage || `Update ${cleanPath} via nowaygit`,
          content: base64Content,
          branch: targetBranch,
          sha: fileSha || undefined
        })
      }
    );

    if (!putRes.ok) {
      const err = await putRes.json().catch(() => ({}));
      throw new Error(err.message || `Failed to commit file to GitHub (${putRes.status})`);
    }

    const putData = await putRes.json();
    const commitUrl = putData.commit?.html_url;

    // 6. If Branch + PR mode, open Pull Request
    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: options.prTitle || commitMessage || `Add ${cleanPath} via nowaygit`,
          body:
            options.prBody ||
            `Automated Pull Request generated by **nowaygit** from claude.ai.\n\nFile: \`${cleanPath}\``,
          head: createdBranchName,
          base: defaultBranch
        })
      });

      if (prRes.ok) {
        const prData = await prRes.json();
        prUrl = prData.html_url;
      }
    }

    // Save last used repo & path to preferences
    await storageService.saveSettings({
      lastUsedRepo: {
        owner,
        repo,
        filePath: cleanPath
      }
    });

    return {
      success: true,
      commitUrl,
      prUrl,
      branchName: createdBranchName
    };
  },

  /**
   * Push multiple files atomically using GitHub Git Data API (Blobs -> Tree -> Commit -> Ref)
   */
  async pushMultipleArtifacts(options: MultiPushOptions): Promise<PushResult> {
    const token = await storageService.getAccessToken();
    if (!token) throw new Error('Not authenticated with GitHub');

    const { owner, repo, commitMessage, pushMode, files } = options;
    if (!files || files.length === 0) {
      throw new Error('No files provided for batch push');
    }

    // 1. Fetch repo details to get default branch name
    const repoRes = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json'
      }
    });

    if (!repoRes.ok) {
      throw new Error(`Target repository "${owner}/${repo}" not found or inaccessible.`);
    }

    const repoData = await repoRes.json();
    const defaultBranch: string = repoData.default_branch || 'main';

    // 2. Fetch latest commit SHA on default branch
    const refRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/ref/heads/${defaultBranch}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );

    if (!refRes.ok) {
      throw new Error(`Could not fetch default branch "${defaultBranch}" ref.`);
    }

    const refData = await refRes.json();
    const parentSha: string = refData.object.sha;

    // 3. Setup target branch name
    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    if (pushMode === 'branch_pr') {
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-batch-${timestamp}`;
      targetBranch = createdBranchName || defaultBranch;

      // Create branch ref
      const createBranchRes = await fetch(
        `https://api.github.com/repos/${owner}/${repo}/git/refs`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github.v3+json',
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            ref: `refs/heads/${createdBranchName}`,
            sha: parentSha
          })
        }
      );

      if (!createBranchRes.ok) {
        const err = await createBranchRes.json().catch(() => ({}));
        throw new Error(err.message || `Failed to create branch "${createdBranchName}".`);
      }
    }

    // 4. Fetch base tree SHA from parent commit
    const commitRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/commits/${parentSha}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json'
        }
      }
    );
    const commitData = await commitRes.json();
    const baseTreeSha: string = commitData.tree.sha;

    // 5. Create Blobs for each file & construct Tree entries
    const treeItems = [];
    for (const f of files) {
      const cleanPath = f.filePath.startsWith('/') ? f.filePath.slice(1) : f.filePath;
      const base64Content = btoa(unescape(encodeURIComponent(f.content)));

      const blobRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/blobs`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          content: base64Content,
          encoding: 'base64'
        })
      });

      if (!blobRes.ok) {
        throw new Error(`Failed to create blob for file "${cleanPath}".`);
      }

      const blobData = await blobRes.json();
      treeItems.push({
        path: cleanPath,
        mode: '100644',
        type: 'blob',
        sha: blobData.sha
      });
    }

    // 6. Create Git Tree
    const treeRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/trees`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        base_tree: baseTreeSha,
        tree: treeItems
      })
    });

    if (!treeRes.ok) {
      throw new Error(`Failed to create Git tree for batch push.`);
    }

    const treeData = await treeRes.json();
    const treeSha: string = treeData.sha;

    // 7. Create Git Commit
    const newCommitRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/git/commits`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github.v3+json',
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        message: commitMessage || `Batch push ${files.length} files via nowaygit`,
        tree: treeSha,
        parents: [parentSha]
      })
    });

    if (!newCommitRes.ok) {
      throw new Error(`Failed to create batch commit.`);
    }

    const newCommitData = await newCommitRes.json();
    const commitSha: string = newCommitData.sha;
    const commitUrl = newCommitData.html_url;

    // 8. Update Target Branch Ref
    const updateRefRes = await fetch(
      `https://api.github.com/repos/${owner}/${repo}/git/refs/heads/${targetBranch}`,
      {
        method: 'PATCH',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sha: commitSha,
          force: true
        })
      }
    );

    if (!updateRefRes.ok) {
      throw new Error(`Failed to update branch ref "${targetBranch}".`);
    }

    // 9. Open Pull Request if branch_pr mode
    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const prRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: options.prTitle || commitMessage || `Batch update ${files.length} files via nowaygit`,
          body:
            options.prBody ||
            `Automated Batch Pull Request generated by **nowaygit** from claude.ai.\n\nIncluded files (${files.length}):\n${files.map((f: { filePath: string }) => `- \`${f.filePath}\``).join('\n')}`,
          head: createdBranchName,
          base: defaultBranch
        })
      });

      if (prRes.ok) {
        const prData = await prRes.json();
        prUrl = prData.html_url;
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
