// Plain node script to test and verify gitlab, bitbucket, and vercel services.
// Mocks chrome and fetch APIs to simulate extension background environment.

import { gitlabService } from './gitlab';
import { bitbucketService } from './bitbucket';
import { vercelService } from './vercel';

// 1. Mock Chrome API
global.chrome = {
  storage: {
    local: {
      get: async (_key: string) => {
        return {
          nowaygit_settings: {
            githubClientId: 'mock_github_client_id',
            gitlabToken: 'mock_gitlab_token',
            gitlabHost: 'https://gitlab.example.com',
            bitbucketToken: 'mock_bitbucket_token',
            bitbucketUsername: 'mock_bitbucket_username'
          }
        };
      },
      set: async (_value: any) => {}
    },
    session: {
      get: async (_key: string) => {
        return { github_access_token: 'mock_github_access_token' };
      },
      set: async (_value: any) => {},
      remove: async (_keys: string | string[]) => {}
    }
  }
} as any;

// Helper to mock fetch responses
let mockResponses: Array<{ url: string; method?: string; status: number; body: any }> = [];

const mockFetch = (url: any, options: any = {}) => {
  const method = options.method || 'GET';
  const matched = mockResponses.find(
    (m) =>
      (url.toString().split('?')[0] === m.url.split('?')[0]) &&
      (!m.method || m.method.toUpperCase() === method.toUpperCase())
  );

  if (!matched) {
    console.error(`[MOCK FETCH] Unmatched call: ${method} ${url}`);
    return Promise.resolve(new Response(JSON.stringify({ error: 'unmatched' }), { status: 404 }));
  }

  return Promise.resolve(
    new Response(
      typeof matched.body === 'string' ? matched.body : JSON.stringify(matched.body),
      {
        status: matched.status,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  );
};

global.fetch = mockFetch as any;

async function runTests() {
  console.log('🧪 Starting Phase 2 Service Verification Tests...');

  // --- Vercel Service Tests ---
  console.log('\n--- 1. Testing Vercel Deploy Hook ---');
  mockResponses = [
    {
      url: 'https://api.vercel.com/v1/integrations/deploy/test-hook',
      method: 'POST',
      status: 200,
      body: { job: { id: 'vercel_job_992' } }
    }
  ];

  const vResult = await vercelService.triggerDeploy('https://api.vercel.com/v1/integrations/deploy/test-hook');
  if (vResult.success && vResult.id === 'vercel_job_992') {
    console.log('✅ Vercel Deploy hook triggered successfully!');
  } else {
    throw new Error('Vercel Deploy hook test failed!');
  }

  // --- GitLab Service Tests ---
  console.log('\n--- 2. Testing GitLab Projects Fetch & File Content ---');
  mockResponses = [
    {
      url: 'https://gitlab.example.com/api/v4/projects?membership=true',
      method: 'GET',
      status: 200,
      body: [
        {
          id: 101,
          name: 'My Repo',
          path_with_namespace: 'group/my-repo',
          visibility: 'private',
          default_branch: 'main',
          web_url: 'https://gitlab.example.com/group/my-repo'
        }
      ]
    },
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo/repository/files/src%2Fapp.tsx?ref=main',
      method: 'GET',
      status: 200,
      body: {
        blob_id: 'blob_9918',
        content: btoa('console.log("GitLab App");'),
        encoding: 'base64',
        size: 26
      }
    }
  ];

  const glProjects = await gitlabService.getProjects();
  if (glProjects.length === 1 && glProjects[0].full_name === 'group/my-repo') {
    console.log('✅ GitLab projects retrieved successfully!');
  } else {
    throw new Error('GitLab projects retrieval failed!');
  }

  const glFile = await gitlabService.getFileContents('group/my-repo', 'src/app.tsx', 'main');
  if (glFile && glFile.content === 'console.log("GitLab App");') {
    console.log('✅ GitLab file contents read correctly!');
  } else {
    throw new Error('GitLab file content reading failed!');
  }

  // --- GitLab Commit Tests ---
  console.log('\n--- 3. Testing GitLab Commit & MR flow ---');
  mockResponses = [
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo',
      method: 'GET',
      status: 200,
      body: { default_branch: 'main', web_url: 'https://gitlab.example.com/group/my-repo' }
    },
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo/repository/branches',
      method: 'POST',
      status: 200,
      body: { name: 'nowaygit-branch' }
    },
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo/repository/files/src%2Fapp.tsx?ref=nowaygit-branch',
      method: 'GET',
      status: 404,
      body: {}
    },
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo/repository/commits',
      method: 'POST',
      status: 201,
      body: { id: 'commit_gitlab_1288' }
    },
    {
      url: 'https://gitlab.example.com/api/v4/projects/group%2Fmy-repo/merge_requests',
      method: 'POST',
      status: 201,
      body: { web_url: 'https://gitlab.example.com/group/my-repo/-/merge_requests/12' }
    }
  ];

  const glPush = await gitlabService.pushArtifact({
    owner: 'group',
    repo: 'my-repo',
    isNewRepo: false,
    filePath: 'src/app.tsx',
    content: 'console.log("new code");',
    commitMessage: 'Commit from nowaygit',
    pushMode: 'branch_pr',
    targetBranch: 'nowaygit-branch'
  });

  if (glPush.success && glPush.prUrl?.includes('merge_requests/12')) {
    console.log('✅ GitLab Push and Merge Request successfully created!');
  } else {
    throw new Error('GitLab Push/MR flow failed!');
  }

  // --- Bitbucket Service Tests ---
  console.log('\n--- 4. Testing Bitbucket Repo Fetch & Commits ---');
  mockResponses = [
    {
      url: 'https://api.bitbucket.org/2.0/workspaces?role=member',
      method: 'GET',
      status: 200,
      body: { values: [{ slug: 'my-workspace' }] }
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace?role=member',
      method: 'GET',
      status: 200,
      body: {
        values: [
          {
            uuid: '{repo-uuid-99}',
            name: 'BB Repo',
            full_name: 'my-workspace/bb-repo',
            is_private: true,
            mainbranch: { name: 'master' },
            links: { html: { href: 'https://bitbucket.org/my-workspace/bb-repo' } }
          }
        ]
      }
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace/bb-repo',
      method: 'GET',
      status: 200,
      body: {
        mainbranch: { name: 'master' },
        links: { html: { href: 'https://bitbucket.org/my-workspace/bb-repo' } }
      }
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace/bb-repo/refs/branches/master',
      method: 'GET',
      status: 200,
      body: { target: { hash: 'parent_commit_sha' } }
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace/bb-repo/refs/branches',
      method: 'POST',
      status: 201,
      body: { name: 'nowaygit-branch' }
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace/bb-repo/src',
      method: 'POST',
      status: 201,
      body: {}
    },
    {
      url: 'https://api.bitbucket.org/2.0/repositories/my-workspace/bb-repo/pullrequests',
      method: 'POST',
      status: 201,
      body: { links: { html: { href: 'https://bitbucket.org/my-workspace/bb-repo/pull-requests/1' } } }
    }
  ];

  const bbRepos = await bitbucketService.getRepositories();
  if (bbRepos.length === 1 && bbRepos[0].full_name === 'my-workspace/bb-repo') {
    console.log('✅ Bitbucket repositories retrieved successfully!');
  } else {
    throw new Error('Bitbucket repositories fetch failed!');
  }

  const bbPush = await bitbucketService.pushArtifact({
    owner: 'my-workspace',
    repo: 'bb-repo',
    isNewRepo: false,
    filePath: 'index.js',
    content: 'console.log("bitbucket app");',
    commitMessage: 'Push to Bitbucket',
    pushMode: 'branch_pr',
    targetBranch: 'nowaygit-branch'
  });

  if (bbPush.success && bbPush.prUrl?.includes('pull-requests/1')) {
    console.log('✅ Bitbucket Push and Pull Request successfully created!');
  } else {
    throw new Error('Bitbucket Push/PR flow failed!');
  }

  console.log('\n🎉 ALL Phase 2 Service Verification Tests Passed!');
}

runTests().catch((err) => {
  console.error('\n❌ Verification test suite failed:', err);
  process.exit(1);
});
