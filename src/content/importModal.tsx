import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import { X, File, RefreshCw, FileText } from 'lucide-react';
import { GitProvider, GitHubRepo } from '../types';

interface ImportModalProps {
  onClose: () => void;
}

export const ImportModal: React.FC<ImportModalProps> = ({ onClose }) => {
  const [provider, setProvider] = useState<GitProvider>('github');
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [selectedBranch, setSelectedBranch] = useState<string>('main');
  const [filePaths, setFilePaths] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadingFiles, setLoadingFiles] = useState<boolean>(false);
  const [filterQuery, setFilterQuery] = useState<string>('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchRepos();
  }, [provider]);

  useEffect(() => {
    if (selectedRepo) {
      fetchFiles();
    }
  }, [selectedRepo, selectedBranch]);

  const fetchRepos = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GET_REPOS_BY_PROVIDER',
        provider
      });
      if (res?.success && Array.isArray(res.data)) {
        setRepos(res.data);
        if (res.data.length > 0) {
          setSelectedRepo(res.data[0].full_name);
          setSelectedBranch(res.data[0].default_branch || 'main');
        } else {
          setSelectedRepo('');
        }
      } else {
        setError(res?.error || 'Provider credentials not configured or failed to connect.');
      }
    } catch {
      setError('Could not reach backend background worker.');
    } finally {
      setLoading(false);
    }
  };

  const fetchFiles = async () => {
    if (!selectedRepo) return;
    setLoadingFiles(true);
    setError(null);
    try {
      const [owner, repo] = selectedRepo.split('/');
      const res = await chrome.runtime.sendMessage({
        type: 'GET_FILE_TREE',
        provider,
        owner,
        repo,
        ref: selectedBranch
      });

      if (res?.success && Array.isArray(res.data)) {
        setFilePaths(res.data);
      } else {
        setFilePaths([]);
      }
    } catch {
      setFilePaths([]);
    } finally {
      setLoadingFiles(false);
    }
  };

  const handleImport = async (path: string) => {
    setLoading(true);
    setError(null);
    try {
      const [owner, repo] = selectedRepo.split('/');
      const res = await chrome.runtime.sendMessage({
        type: 'GET_FILE_CONTENTS_BY_PROVIDER',
        provider,
        owner,
        repo,
        path,
        ref: selectedBranch
      });

      if (res?.success && res.data) {
        insertContentIntoClaude(path, res.data.content);
        onClose();
      } else {
        setError(res?.error || 'Failed to read file content.');
      }
    } catch {
      setError('Import request failed.');
    } finally {
      setLoading(false);
    }
  };

  const insertContentIntoClaude = (filename: string, content: string) => {
    // Locate Claude's textarea input field
    const textarea =
      document.querySelector('[data-testid="chat-input"]') ||
      document.querySelector('textarea[placeholder*="Ask Claude"]') ||
      document.querySelector('textarea') ||
      document.querySelector('div[contenteditable="true"]');

    if (!textarea) {
      alert('Could not find Claude chat input field. Please make sure the chat window is open.');
      return;
    }

    const language = filename.split('.').pop() || 'txt';
    const formatted = `Here is the code of my imported file \`${filename}\` from ${provider} (${selectedRepo}):\n\n\`\`\`${language}\n${content}\n\`\`\`\n`;

    if (textarea instanceof HTMLTextAreaElement) {
      textarea.value = formatted + textarea.value;
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    } else if (textarea instanceof HTMLDivElement) {
      // Handle contenteditable editors (e.g. ProseMirror/Lexical used by Claude)
      const p = document.createElement('p');
      p.innerText = formatted;
      textarea.appendChild(p);
      textarea.dispatchEvent(new Event('input', { bubbles: true }));
      textarea.focus();
    }
  };

  const filteredPaths = filePaths.filter((p) =>
    p.toLowerCase().includes(filterQuery.toLowerCase())
  );

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.75)',
        backdropFilter: 'blur(8px)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '520px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '80vh'
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #1e293b',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <FileText style={{ width: '18px', height: '18px', color: '#818cf8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Import File from Git
              </h3>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>
                Load code directly into Claude's prompt context
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#94a3b8',
              cursor: 'pointer',
              padding: '4px'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Body */}
        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
          {/* Provider Selection */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Select Git Provider
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              {(['github', 'gitlab', 'bitbucket'] as GitProvider[]).map((p) => (
                <button
                  key={p}
                  onClick={() => setProvider(p)}
                  style={{
                    flex: 1,
                    padding: '8px',
                    backgroundColor: provider === p ? 'rgba(99, 102, 241, 0.15)' : '#1e293b',
                    border: `1px solid ${provider === p ? '#6366f1' : '#334155'}`,
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    textTransform: 'capitalize'
                  }}
                >
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Repo Selection */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Repository
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                disabled={loading || repos.length === 0}
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#fff',
                  fontSize: '12px'
                }}
              >
                {repos.length === 0 && <option>No repositories found</option>}
                {repos.map((r) => (
                  <option key={r.id} value={r.full_name}>
                    {r.full_name}
                  </option>
                ))}
              </select>
              <button
                onClick={fetchRepos}
                style={{
                  padding: '8px',
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '8px',
                  color: '#94a3b8',
                  cursor: 'pointer'
                }}
              >
                <RefreshCw style={{ width: '16px', height: '16px', animation: loading ? 'spin 1s linear infinite' : 'none' }} />
              </button>
            </div>
          </div>

          {/* Branch input */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#cbd5e1', marginBottom: '6px' }}>
              Branch / Ref
            </label>
            <input
              type="text"
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              placeholder="main"
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* File Filter */}
          <div style={{ marginBottom: '12px' }}>
            <input
              type="text"
              placeholder="Filter files (e.g. index.ts)"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              style={{
                width: '100%',
                padding: '8px 12px',
                backgroundColor: '#020617',
                border: '1px solid #334155',
                borderRadius: '8px',
                color: '#fff',
                fontSize: '12px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          {/* File List */}
          <div
            style={{
              backgroundColor: '#020617',
              border: '1px solid #1e293b',
              borderRadius: '8px',
              maxHeight: '200px',
              overflowY: 'auto',
              padding: '6px'
            }}
          >
            {loadingFiles ? (
              <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                Fetching file tree...
              </div>
            ) : filteredPaths.length === 0 ? (
              <div style={{ color: '#64748b', fontSize: '12px', textAlign: 'center', padding: '20px 0' }}>
                No files found.
              </div>
            ) : (
              filteredPaths.map((path, idx) => (
                <div
                  key={idx}
                  onClick={() => handleImport(path)}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 10px',
                    borderRadius: '6px',
                    cursor: 'pointer',
                    fontSize: '12px',
                    transition: 'background-color 0.15s ease'
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#1e293b')}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = 'transparent')}
                >
                  <File style={{ width: '14px', height: '14px', color: '#818cf8', flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {path}
                  </span>
                </div>
              ))
            )}
          </div>

          {error && (
            <div
              style={{
                marginTop: '12px',
                padding: '8px 12px',
                backgroundColor: 'rgba(239, 68, 68, 0.15)',
                border: '1px solid rgba(239, 68, 68, 0.3)',
                borderRadius: '8px',
                color: '#f87171',
                fontSize: '12px'
              }}
            >
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const importUiInjector = {
  injectImportButton() {
    const existing = document.getElementById('nowaygit-import-btn');
    if (existing) return;

    // We look for Claude's chat input area toolbar or sibling elements
    const target =
      document.querySelector('div.flex.components-chat-input-textarea') ||
      document.querySelector('fieldset div.flex.flex-col') ||
      document.querySelector('[data-testid="chat-input"]') ||
      document.querySelector('.chat-input-container');

    if (!target) return;

    const btnContainer = document.createElement('div');
    btnContainer.id = 'nowaygit-import-container';
    btnContainer.style.display = 'inline-flex';
    btnContainer.style.alignItems = 'center';
    btnContainer.style.margin = '4px';

    const btn = document.createElement('button');
    btn.id = 'nowaygit-import-btn';
    btn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
        <polyline points="7 10 12 15 17 10"></polyline>
        <line x1="12" y1="15" x2="12" y2="3"></line>
      </svg>
      <span>Import Git File</span>
    `;

    Object.assign(btn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '4px 10px',
      fontSize: '11px',
      fontWeight: '600',
      color: '#fff',
      background: 'linear-gradient(135deg, #1e1b4b 0%, #312e81 100%)',
      border: '1px solid #4338ca',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 1px 2px rgba(0,0,0,0.2)',
      transition: 'opacity 0.2s ease'
    });

    btn.onclick = (e) => {
      e.preventDefault();
      e.stopPropagation();
      this.openImportModal();
    };

    btnContainer.appendChild(btn);
    target.appendChild(btnContainer);
  },

  openImportModal() {
    let host = document.getElementById('nowaygit-import-host');
    if (!host) {
      host = document.createElement('div');
      host.id = 'nowaygit-import-host';
      document.body.appendChild(host);
    }

    const root = createRoot(host);
    root.render(
      <ImportModal
        onClose={() => {
          root.unmount();
          host?.remove();
        }}
      />
    );
  }
};
