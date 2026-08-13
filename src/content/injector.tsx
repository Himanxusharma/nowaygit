import React, { useState, useEffect } from 'react';
import { createRoot } from 'react-dom/client';
import {
  GitBranch,
  GitPullRequest,
  Folder,
  CheckCircle,
  AlertCircle,
  ExternalLink,
  Sparkles,
  X,
  PlusCircle,
  RefreshCw,
  Lock,
  Globe,
  FileCode
} from 'lucide-react';
import {
  ArtifactData,
  GitHubRepo,
  GitHubUser,
  GitHubDeviceCodeResponse,
  PushResult,
  ExtensionSettings
} from '../types';

interface PushModalProps {
  artifact: ArtifactData;
  onClose: () => void;
}

const PushModal: React.FC<PushModalProps> = ({ artifact, onClose }) => {
  const [auth, setAuth] = useState<{ authenticated: boolean; user: GitHubUser | null }>({
    authenticated: false,
    user: null
  });
  const [deviceCode, setDeviceCode] = useState<GitHubDeviceCodeResponse | null>(null);
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [loadingRepos, setLoadingRepos] = useState<boolean>(false);

  // Form states
  const [selectedRepo, setSelectedRepo] = useState<string>('');
  const [createNewRepo, setCreateNewRepo] = useState<boolean>(false);
  const [newRepoName, setNewRepoName] = useState<string>('');
  const [newRepoDesc, setNewRepoDesc] = useState<string>('');
  const [isPrivate, setIsPrivate] = useState<boolean>(false);
  const [filePath, setFilePath] = useState<string>(artifact.inferredFilename);
  const [pushMode, setPushMode] = useState<'branch_pr' | 'direct'>('branch_pr');
  const [commitMessage, setCommitMessage] = useState<string>('');
  const [generatingAi, setGeneratingAi] = useState<boolean>(false);

  // Existing file & diff check state
  const [existingFile, setExistingFile] = useState<{ sha: string; content: string; size: number } | null>(null);
  const [checkingExisting, setCheckingExisting] = useState<boolean>(false);

  // Operation state
  const [pushing, setPushing] = useState<boolean>(false);
  const [result, setResult] = useState<PushResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Init auth status & preferences
  useEffect(() => {
    checkAuth();
    loadSettings();
  }, []);

  useEffect(() => {
    if (auth.authenticated && selectedRepo && filePath.trim() && !createNewRepo) {
      checkExistingFile();
    } else {
      setExistingFile(null);
    }
  }, [selectedRepo, filePath, createNewRepo, auth.authenticated]);

  const checkExistingFile = async () => {
    if (!selectedRepo || !filePath.trim()) return;
    setCheckingExisting(true);
    try {
      const [o, r] = selectedRepo.split('/');
      const res = await chrome.runtime.sendMessage({
        type: 'GET_FILE_CONTENTS',
        owner: o,
        repo: r,
        path: filePath.trim()
      });

      if (res?.success && res.data) {
        setExistingFile(res.data);
      } else {
        setExistingFile(null);
      }
    } catch {
      setExistingFile(null);
    } finally {
      setCheckingExisting(false);
    }
  };

  const checkAuth = async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });
      if (res?.success && res.data?.authenticated) {
        setAuth({ authenticated: true, user: res.data.user });
        fetchRepos();
      } else {
        setAuth({ authenticated: false, user: null });
      }
    } catch {
      setAuth({ authenticated: false, user: null });
    }
  };

  const loadSettings = async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (res?.success && res.data) {
        const settings: ExtensionSettings = res.data;
        setPushMode(settings.defaultPushMode || 'branch_pr');
        if (settings.lastUsedRepo && !createNewRepo) {
          setSelectedRepo(`${settings.lastUsedRepo.owner}/${settings.lastUsedRepo.repo}`);
        }
      }
    } catch {}
    generateAiCommitMessage();
  };

  const fetchRepos = async () => {
    setLoadingRepos(true);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'GET_REPOS' });
      if (res?.success && Array.isArray(res.data)) {
        setRepos(res.data);
        if (res.data.length > 0 && !selectedRepo) {
          setSelectedRepo(res.data[0].full_name);
        }
      }
    } catch (err: any) {
      setError('Could not fetch repositories.');
    } finally {
      setLoadingRepos(false);
    }
  };

  const startDeviceFlow = async () => {
    setError(null);
    try {
      const res = await chrome.runtime.sendMessage({ type: 'INITIATE_AUTH' });
      if (res?.success && res.data) {
        setDeviceCode(res.data);
        // Start polling check
        pollForAuthToken(res.data.device_code, res.data.interval || 5);
      } else {
        setError(res?.error || 'Failed to initiate GitHub Device Flow.');
      }
    } catch (err: any) {
      setError(err.message || 'Auth initiation error');
    }
  };

  const pollForAuthToken = (_code: string, intervalSec: number) => {
    const timer = setInterval(async () => {
      try {
        const check = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });
        if (check?.success && check.data?.authenticated) {
          clearInterval(timer);
          setDeviceCode(null);
          setAuth({ authenticated: true, user: check.data.user });
          fetchRepos();
        }
      } catch {}
    }, Math.max(intervalSec, 5) * 1000);
  };

  const generateAiCommitMessage = async () => {
    setGeneratingAi(true);
    try {
      const res = await chrome.runtime.sendMessage({
        type: 'GENERATE_COMMIT_MESSAGE',
        filename: filePath,
        content: artifact.content
      });
      if (res?.success && res.data) {
        setCommitMessage(res.data);
      } else {
        setCommitMessage(`Add ${filePath} via nowaygit`);
      }
    } catch {
      setCommitMessage(`Add ${filePath} via nowaygit`);
    } finally {
      setGeneratingAi(false);
    }
  };

  const handlePush = async () => {
    setError(null);
    setPushing(true);

    try {
      let targetOwner = '';
      let targetRepoName = '';

      if (createNewRepo) {
        if (!newRepoName.trim()) {
          throw new Error('Please enter a name for the new repository.');
        }
        const createRes = await chrome.runtime.sendMessage({
          type: 'CREATE_REPO',
          name: newRepoName.trim(),
          description: newRepoDesc.trim(),
          isPrivate
        });

        if (!createRes?.success) {
          throw new Error(createRes?.error || 'Failed to create repository on GitHub.');
        }
        targetOwner = createRes.data.owner.login;
        targetRepoName = createRes.data.name;
      } else {
        if (!selectedRepo) {
          throw new Error('Please select a target repository.');
        }
        const [o, r] = selectedRepo.split('/');
        targetOwner = o;
        targetRepoName = r;
      }

      const pushRes = await chrome.runtime.sendMessage({
        type: 'PUSH_ARTIFACT',
        options: {
          owner: targetOwner,
          repo: targetRepoName,
          isNewRepo: createNewRepo,
          filePath: filePath.trim(),
          commitMessage: commitMessage.trim() || `Update ${filePath} via nowaygit`,
          pushMode,
          content: artifact.content
        }
      });

      if (!pushRes?.success) {
        throw new Error(pushRes?.error || 'Failed to push artifact.');
      }

      setResult(pushRes.data);
    } catch (err: any) {
      setError(err.message || 'Push operation failed');
    } finally {
      setPushing(false);
    }
  };

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
          width: '100%',
          maxWidth: '560px',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          animation: 'fadeIn 0.2s ease-out'
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
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <GitPullRequest style={{ width: '18px', height: '18px', color: '#fff' }} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#ffffff' }}>
                nowaygit
              </h3>
              <span style={{ fontSize: '12px', color: '#94a3b8' }}>
                Push to GitHub in 1 click
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
              padding: '4px',
              borderRadius: '6px'
            }}
          >
            <X style={{ width: '20px', height: '20px' }} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px' }}>
          {/* Unauthenticated View */}
          {!auth.authenticated ? (
            <div style={{ textAlign: 'center', padding: '20px 10px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: '#1e293b',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <Lock style={{ width: '24px', height: '24px', color: '#818cf8' }} />
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
                Connect GitHub
              </h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px' }}>
                Authenticate securely using GitHub Device Flow. No passwords or secrets stored.
              </p>

              {deviceCode ? (
                <div
                  style={{
                    backgroundColor: '#1e293b',
                    padding: '16px',
                    borderRadius: '12px',
                    marginBottom: '16px'
                  }}
                >
                  <p style={{ margin: '0 0 8px', fontSize: '12px', color: '#94a3b8' }}>
                    Enter this code at GitHub:
                  </p>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: 700,
                      letterSpacing: '4px',
                      color: '#a855f7',
                      fontFamily: 'monospace',
                      marginBottom: '12px'
                    }}
                  >
                    {deviceCode.user_code}
                  </div>
                  <a
                    href={deviceCode.verification_uri}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 16px',
                      backgroundColor: '#6366f1',
                      color: '#fff',
                      borderRadius: '8px',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500
                    }}
                  >
                    Open GitHub Verification <ExternalLink style={{ width: '14px', height: '14px' }} />
                  </a>
                  <p style={{ margin: '12px 0 0', fontSize: '11px', color: '#64748b' }}>
                    Waiting for authorization...
                  </p>
                </div>
              ) : (
                <button
                  onClick={startDeviceFlow}
                  style={{
                    padding: '10px 20px',
                    backgroundColor: '#6366f1',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '14px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  Sign in with GitHub
                </button>
              )}
            </div>
          ) : result ? (
            /* Success Confirmation View */
            <div style={{ textAlign: 'center', padding: '10px' }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '50%',
                  backgroundColor: 'rgba(34, 197, 94, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  margin: '0 auto 16px'
                }}
              >
                <CheckCircle style={{ width: '28px', height: '28px', color: '#4ade80' }} />
              </div>

              <h4 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
                Successfully Pushed!
              </h4>
              <p style={{ fontSize: '13px', color: '#94a3b8', margin: '0 0 20px' }}>
                Your artifact has been landed on GitHub.
              </p>

              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '10px',
                  marginBottom: '20px'
                }}
              >
                {result.prUrl && (
                  <a
                    href={result.prUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '10px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#818cf8',
                      textDecoration: 'none',
                      fontSize: '13px',
                      fontWeight: 500,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    View Pull Request on GitHub <ExternalLink style={{ width: '14px', height: '14px' }} />
                  </a>
                )}
                {result.commitUrl && (
                  <a
                    href={result.commitUrl}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      padding: '10px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#cbd5e1',
                      textDecoration: 'none',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px'
                    }}
                  >
                    View Commit on GitHub <ExternalLink style={{ width: '14px', height: '14px' }} />
                  </a>
                )}
              </div>

              <button
                onClick={onClose}
                style={{
                  padding: '8px 20px',
                  backgroundColor: '#334155',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '13px',
                  fontWeight: 500,
                  cursor: 'pointer'
                }}
              >
                Done
              </button>
            </div>
          ) : (
            /* Push Form View */
            <div>
              {/* Target Repo Picker */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px'
                  }}
                >
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>
                    Destination Repository
                  </label>
                  <button
                    onClick={() => setCreateNewRepo(!createNewRepo)}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#818cf8',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <PlusCircle style={{ width: '12px', height: '12px' }} />
                    {createNewRepo ? 'Select Existing Repo' : 'Create New Repo'}
                  </button>
                </div>

                {createNewRepo ? (
                  <div
                    style={{
                      backgroundColor: '#1e293b',
                      padding: '12px',
                      borderRadius: '8px',
                      border: '1px solid #334155'
                    }}
                  >
                    <input
                      type="text"
                      placeholder="Repository name (e.g. my-app)"
                      value={newRepoName}
                      onChange={(e) => setNewRepoName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px',
                        marginBottom: '8px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <input
                      type="text"
                      placeholder="Description (optional)"
                      value={newRepoDesc}
                      onChange={(e) => setNewRepoDesc(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '8px 12px',
                        backgroundColor: '#0f172a',
                        border: '1px solid #475569',
                        borderRadius: '6px',
                        color: '#fff',
                        fontSize: '13px',
                        marginBottom: '8px',
                        boxSizing: 'border-box'
                      }}
                    />
                    <div style={{ display: 'flex', gap: '16px', fontSize: '12px' }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="vis"
                          checked={!isPrivate}
                          onChange={() => setIsPrivate(false)}
                        />
                        <Globe style={{ width: '12px', height: '12px' }} /> Public
                      </label>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: 'pointer' }}>
                        <input
                          type="radio"
                          name="vis"
                          checked={isPrivate}
                          onChange={() => setIsPrivate(true)}
                        />
                        <Lock style={{ width: '12px', height: '12px' }} /> Private
                      </label>
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', gap: '8px' }}>
                    <select
                      value={selectedRepo}
                      onChange={(e) => setSelectedRepo(e.target.value)}
                      disabled={loadingRepos}
                      style={{
                        flex: 1,
                        padding: '8px 12px',
                        backgroundColor: '#1e293b',
                        border: '1px solid #334155',
                        borderRadius: '8px',
                        color: '#fff',
                        fontSize: '13px'
                      }}
                    >
                      {repos.map((r) => (
                        <option key={r.id} value={r.full_name}>
                          {r.full_name} {r.private ? '🔒' : ''}
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
                      <RefreshCw style={{ width: '16px', height: '16px' }} />
                    </button>
                  </div>
                )}
              </div>

              {/* Path & Filename */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '6px' }}>
                  Target File Path
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type="text"
                    value={filePath}
                    onChange={(e) => setFilePath(e.target.value)}
                    placeholder="src/components/MyComponent.tsx"
                    style={{
                      width: '100%',
                      padding: '8px 12px 8px 36px',
                      backgroundColor: '#1e293b',
                      border: '1px solid #334155',
                      borderRadius: '8px',
                      color: '#fff',
                      fontSize: '13px',
                      boxSizing: 'border-box'
                    }}
                  />
                  <Folder
                    style={{
                      position: 'absolute',
                      left: '12px',
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: '14px',
                      height: '14px',
                      color: '#64748b'
                    }}
                  />
                </div>

                {/* Existing file alert & diff hint */}
                {checkingExisting ? (
                  <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '4px' }}>
                    Checking file status on GitHub...
                  </div>
                ) : existingFile ? (
                  <div
                    style={{
                      marginTop: '6px',
                      padding: '8px 10px',
                      backgroundColor: 'rgba(234, 179, 8, 0.12)',
                      border: '1px solid rgba(234, 179, 8, 0.3)',
                      borderRadius: '6px',
                      fontSize: '11px',
                      color: '#fde047',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px'
                    }}
                  >
                    <AlertCircle style={{ width: '14px', height: '14px', flexShrink: 0 }} />
                    <span>
                      <strong>Existing file found</strong> (SHA: {existingFile.sha.slice(0, 7)}). Push will update this file.
                    </span>
                  </div>
                ) : (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                    New file will be created at this path.
                  </div>
                )}
              </div>

              {/* Commit Message */}
              <div style={{ marginBottom: '16px' }}>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    marginBottom: '6px'
                  }}
                >
                  <label style={{ fontSize: '13px', fontWeight: 500, color: '#cbd5e1' }}>
                    Commit Message
                  </label>
                  <button
                    onClick={generateAiCommitMessage}
                    disabled={generatingAi}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#a855f7',
                      fontSize: '12px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px'
                    }}
                  >
                    <Sparkles style={{ width: '12px', height: '12px' }} />
                    {generatingAi ? 'Generating...' : 'AI Rewrite'}
                  </button>
                </div>
                <input
                  type="text"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  placeholder="Commit message"
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    backgroundColor: '#1e293b',
                    border: '1px solid #334155',
                    borderRadius: '8px',
                    color: '#fff',
                    fontSize: '13px',
                    boxSizing: 'border-box'
                  }}
                />
              </div>

              {/* Push Strategy */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 500, color: '#cbd5e1', marginBottom: '8px' }}>
                  Push Strategy
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
                  <div
                    onClick={() => setPushMode('branch_pr')}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: pushMode === 'branch_pr' ? 'rgba(99, 102, 241, 0.15)' : '#1e293b',
                      border: `1px solid ${pushMode === 'branch_pr' ? '#6366f1' : '#334155'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <GitPullRequest
                      style={{
                        width: '16px',
                        height: '16px',
                        color: pushMode === 'branch_pr' ? '#818cf8' : '#64748b'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Create PR</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Safe (default)</div>
                    </div>
                  </div>

                  <div
                    onClick={() => setPushMode('direct')}
                    style={{
                      padding: '10px 12px',
                      backgroundColor: pushMode === 'direct' ? 'rgba(99, 102, 241, 0.15)' : '#1e293b',
                      border: `1px solid ${pushMode === 'direct' ? '#6366f1' : '#334155'}`,
                      borderRadius: '8px',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px'
                    }}
                  >
                    <GitBranch
                      style={{
                        width: '16px',
                        height: '16px',
                        color: pushMode === 'direct' ? '#818cf8' : '#64748b'
                      }}
                    />
                    <div>
                      <div style={{ fontSize: '12px', fontWeight: 600 }}>Direct Commit</div>
                      <div style={{ fontSize: '10px', color: '#94a3b8' }}>Push to default</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <div
                  style={{
                    padding: '10px 12px',
                    backgroundColor: 'rgba(239, 68, 68, 0.15)',
                    border: '1px solid rgba(239, 68, 68, 0.3)',
                    borderRadius: '8px',
                    color: '#f87171',
                    fontSize: '12px',
                    marginBottom: '16px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px'
                  }}
                >
                  <AlertCircle style={{ width: '16px', height: '16px', flexShrink: 0 }} />
                  <span>{error}</span>
                </div>
              )}

              {/* Action Buttons */}
              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  onClick={onClose}
                  style={{
                    padding: '8px 16px',
                    backgroundColor: 'transparent',
                    color: '#94a3b8',
                    border: 'none',
                    fontSize: '13px',
                    fontWeight: 500,
                    cursor: 'pointer'
                  }}
                >
                  Cancel
                </button>

                <button
                  onClick={handlePush}
                  disabled={pushing}
                  style={{
                    padding: '8px 20px',
                    background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontSize: '13px',
                    fontWeight: 600,
                    cursor: pushing ? 'not-allowed' : 'pointer',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    opacity: pushing ? 0.7 : 1
                  }}
                >
                  {pushing ? (
                    <>
                      <RefreshCw style={{ width: '14px', height: '14px', animation: 'spin 1s linear infinite' }} />
                      Pushing...
                    </>
                  ) : (
                    <>
                      <FileCode style={{ width: '14px', height: '14px' }} />
                      Push to GitHub
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export const uiInjector = {
  injectButton(artifact: ArtifactData) {
    const existingButton = document.getElementById('nowaygit-push-btn');
    if (existingButton) return;

    // Target toolbar inside claude.ai artifact header
    const toolbar =
      document.querySelector('[data-testid="artifact-header"]') ||
      document.querySelector('header') ||
      document.querySelector('.artifact-header');

    if (!toolbar) return;

    const btnContainer = document.createElement('div');
    btnContainer.id = 'nowaygit-push-btn-container';
    btnContainer.style.display = 'inline-flex';
    btnContainer.style.alignItems = 'center';
    btnContainer.style.marginLeft = '8px';

    const pushBtn = document.createElement('button');
    pushBtn.id = 'nowaygit-push-btn';
    pushBtn.innerHTML = `
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 5px;">
        <path d="M15 22v-4a4.8 4.8 0 0 0-1-3.5c3 0 6-2 6-5.5.08-1.25-.27-2.48-1-3.5.28-1.15.28-2.35 0-3.5 0 0-1 0-3 1.5-2.64-.5-5.36-.5-8 0C6 2 5 2 5 2c-.3 1.15-.3 2.35 0 3.5A5.403 5.403 0 0 0 4 9c0 3.5 3 5.5 6 5.5-.39.49-.68 1.05-.85 1.65-.17.6-.22 1.23-.15 1.85v4"></path>
        <path d="M9 18c-4.51 2-5-2-7-2"></path>
      </svg>
      <span>Push to GitHub</span>
    `;

    Object.assign(pushBtn.style, {
      display: 'inline-flex',
      alignItems: 'center',
      padding: '5px 12px',
      fontSize: '12px',
      fontWeight: '600',
      color: '#ffffff',
      background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
      border: 'none',
      borderRadius: '6px',
      cursor: 'pointer',
      boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
      transition: 'opacity 0.2s ease'
    });

    pushBtn.onmouseenter = () => (pushBtn.style.opacity = '0.9');
    pushBtn.onmouseleave = () => (pushBtn.style.opacity = '1');

    pushBtn.onclick = () => {
      this.openPushModal(artifact);
    };

    btnContainer.appendChild(pushBtn);
    toolbar.appendChild(btnContainer);
  },

  openPushModal(artifact: ArtifactData) {
    let modalHost = document.getElementById('nowaygit-modal-host');
    if (!modalHost) {
      modalHost = document.createElement('div');
      modalHost.id = 'nowaygit-modal-host';
      document.body.appendChild(modalHost);
    }

    const root = createRoot(modalHost);
    root.render(
      <PushModal
        artifact={artifact}
        onClose={() => {
          root.unmount();
          modalHost?.remove();
        }}
      />
    );
  }
};
