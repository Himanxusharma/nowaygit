import { GitHubRepo, PushOptions, MultiPushOptions, PushResult } from '../types';
import { storageService } from './storage';

export const bitbucketService = {
  async getAuthHeader(): Promise<{ Authorization: string }> {
    const settings = await storageService.getSettings();
    if (!settings.bitbucketToken || !settings.bitbucketUsername) {
      throw new Error('Bitbucket username and App Password not configured in settings.');
    }
    const credentials = btoa(`${settings.bitbucketUsername}:${settings.bitbucketToken}`);
    return { Authorization: `Basic ${credentials}` };
  },

  async getBaseUrl(): Promise<string> {
    return 'https://api.bitbucket.org/2.0';
  },

  async getRepositories(): Promise<GitHubRepo[]> {
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();

    // Get workspaces first to list repos
    const wsRes = await fetch(`${baseUrl}/workspaces?role=member`, { headers });
    if (!wsRes.ok) {
      throw new Error('Failed to fetch Bitbucket workspaces.');
    }
    const wsData = await wsRes.json();
    const workspaces = wsData.values || [];

    const repos: GitHubRepo[] = [];
    for (const ws of workspaces) {
      const slug = ws.slug;
      const reposRes = await fetch(`${baseUrl}/repositories/${slug}?role=member`, { headers });
      if (reposRes.ok) {
        const reposData = await reposRes.json();
        const wsRepos = reposData.values || [];
        for (const r of wsRepos) {
          repos.push({
            id: r.uuid,
            name: r.name,
            full_name: r.full_name,
            private: r.is_private,
            default_branch: r.mainbranch?.name || 'main',
            html_url: r.links?.html?.href || '',
            owner: {
              login: slug
            }
          });
        }
      }
    }

    return repos;
  },

  async createRepository(name: string, description?: string, isPrivate = false): Promise<GitHubRepo> {
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();

    // Retrieve user workspace first
    const wsRes = await fetch(`${baseUrl}/workspaces?role=member`, { headers });
    if (!wsRes.ok) {
      throw new Error('Failed to retrieve Bitbucket workspace.');
    }
    const wsData = await wsRes.json();
    const workspaces = wsData.values || [];
    if (workspaces.length === 0) {
      throw new Error('No Bitbucket workspaces found to create repository.');
    }
    const workspaceSlug = workspaces[0].slug;
    const repoSlug = name.trim().toLowerCase().replace(/[^a-z0-9._-]/g, '-');

    const response = await fetch(`${baseUrl}/repositories/${workspaceSlug}/${repoSlug}`, {
      method: 'POST',
      headers: {
        ...headers,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        name,
        description,
        is_private: isPrivate,
        scm: 'git',
        project: {
          key: workspaceSlug.slice(0, 4).toUpperCase() // Bitbucket project placeholder
        }
      })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error?.message || `Failed to create Bitbucket repository (${response.status})`);
    }

    const r = await response.json();
    return {
      id: r.uuid,
      name: r.name,
      full_name: r.full_name,
      private: r.is_private,
      default_branch: r.mainbranch?.name || 'main',
      html_url: r.links?.html?.href || '',
      owner: {
        login: workspaceSlug
      }
    };
  },

  async getFileContents(workspace: string, repoSlug: string, path: string, ref?: string) {
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const branchRef = ref || 'main';

    const response = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(branchRef)}/${encodeURIComponent(cleanPath)}`, {
      headers
    });

    if (response.status === 404) {
      return null;
    }

    if (!response.ok) {
      throw new Error(`Failed to fetch Bitbucket file (${response.status})`);
    }

    const content = await response.text();
    return {
      sha: 'bitbucket-sha-placeholder',
      content,
      size: content.length
    };
  },

  async getFileTree(workspace: string, repoSlug: string, ref?: string): Promise<string[]> {
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();
    const branchRef = ref || 'main';

    const response = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/src/${encodeURIComponent(branchRef)}/?max_depth=5`, {
      headers
    });

    if (!response.ok) {
      return [];
    }

    const data = await response.json();
    const values = data.values || [];
    return values.filter((v: any) => v.type === 'commit_file').map((v: any) => v.path);
  },

  async pushArtifact(options: PushOptions): Promise<PushResult> {
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();
    const { owner, repo, filePath, commitMessage, pushMode, content } = options;

    const workspace = owner;
    const repoSlug = repo;
    const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

    // 1. Fetch main branch
    const repoDetailsRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}`, { headers });
    if (!repoDetailsRes.ok) {
      throw new Error(`Bitbucket repository not found.`);
    }
    const repoDetails = await repoDetailsRes.json();
    const defaultBranch = repoDetails.mainbranch?.name || 'main';

    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    // 2. Handle branch creation if branch_pr
    if (pushMode === 'branch_pr') {
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-${timestamp}`;
      targetBranch = createdBranchName;

      // Get default branch commit hash
      const branchRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/refs/branches/${defaultBranch}`, { headers });
      if (!branchRes.ok) {
        throw new Error(`Could not fetch Bitbucket default branch "${defaultBranch}".`);
      }
      const branchData = await branchRes.json();
      const parentHash = branchData.target.hash;

      // Create branch
      const createBranchRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/refs/branches`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createdBranchName,
          target: {
            hash: parentHash
          }
        })
      });

      if (!createBranchRes.ok) {
        throw new Error(`Failed to create Bitbucket branch.`);
      }
    }

    // 3. Commit files using multipart/form-data
    const formData = new FormData();
    formData.append('message', commitMessage || `Push ${cleanPath} via nowaygit`);
    formData.append('branch', targetBranch);
    formData.append(cleanPath, new Blob([content], { type: 'text/plain' }), cleanPath);

    const commitRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/src`, {
      method: 'POST',
      headers: {
        Authorization: headers.Authorization
      },
      body: formData
    });

    if (!commitRes.ok) {
      throw new Error(`Failed to commit files to Bitbucket.`);
    }

    const commitUrl = `${repoDetails.links?.html?.href}/commits/branch/${targetBranch}`;

    // 4. Open Pull Request
    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const prRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/pullrequests`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: options.prTitle || commitMessage || `Merge updates to ${cleanPath}`,
          description: options.prBody || `Automated Pull Request generated by **nowaygit** from claude.ai.`,
          source: {
            branch: {
              name: createdBranchName
            }
          },
          destination: {
            branch: {
              name: defaultBranch
            }
          }
        })
      });

      if (prRes.ok) {
        const prData = await prRes.json();
        prUrl = prData.links?.html?.href;
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
    const headers = await this.getAuthHeader();
    const baseUrl = await this.getBaseUrl();
    const { owner, repo, commitMessage, pushMode, files } = options;

    const workspace = owner;
    const repoSlug = repo;

    const repoDetailsRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}`, { headers });
    if (!repoDetailsRes.ok) {
      throw new Error(`Bitbucket repository not found.`);
    }
    const repoDetails = await repoDetailsRes.json();
    const defaultBranch = repoDetails.mainbranch?.name || 'main';

    let targetBranch = defaultBranch;
    let createdBranchName: string | undefined;

    if (pushMode === 'branch_pr') {
      const timestamp = Date.now().toString().slice(-5);
      createdBranchName = options.targetBranch || `nowaygit-batch-${timestamp}`;
      targetBranch = createdBranchName;

      const branchRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/refs/branches/${defaultBranch}`, { headers });
      if (!branchRes.ok) {
        throw new Error(`Could not fetch Bitbucket default branch.`);
      }
      const branchData = await branchRes.json();
      const parentHash = branchData.target.hash;

      const createBranchRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/refs/branches`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: createdBranchName,
          target: {
            hash: parentHash
          }
        })
      });

      if (!createBranchRes.ok) {
        throw new Error(`Failed to create Bitbucket branch.`);
      }
    }

    // Commit multiple files using multipart/form-data
    const formData = new FormData();
    formData.append('message', commitMessage || `Batch commit via nowaygit`);
    formData.append('branch', targetBranch);
    for (const f of files) {
      const cleanPath = f.filePath.startsWith('/') ? f.filePath.slice(1) : f.filePath;
      formData.append(cleanPath, new Blob([f.content], { type: 'text/plain' }), cleanPath);
    }

    const commitRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/src`, {
      method: 'POST',
      headers: {
        Authorization: headers.Authorization
      },
      body: formData
    });

    if (!commitRes.ok) {
      throw new Error(`Failed to commit batch updates to Bitbucket.`);
    }

    const commitUrl = `${repoDetails.links?.html?.href}/commits/branch/${targetBranch}`;

    let prUrl: string | undefined;
    if (pushMode === 'branch_pr' && createdBranchName) {
      const prRes = await fetch(`${baseUrl}/repositories/${workspace}/${repoSlug}/pullrequests`, {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          title: options.prTitle || commitMessage || `Merge batch updates (${files.length} files)`,
          description: options.prBody || `Automated Pull Request generated by **nowaygit** from claude.ai.`,
          source: {
            branch: {
              name: createdBranchName
            }
          },
          destination: {
            branch: {
              name: defaultBranch
            }
          }
        })
      });

      if (prRes.ok) {
        const prData = await prRes.json();
        prUrl = prData.links?.html?.href;
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
