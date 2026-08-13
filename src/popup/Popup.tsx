import React, { useState, useEffect } from 'react';
import {
  GitPullRequest,
  Key,
  LogOut,
  ExternalLink,
  Save,
  CheckCircle,
  GitBranch,
  Settings,
  Github,
  Terminal,
  Copy,
  Check
} from 'lucide-react';
import { GitHubUser, ExtensionSettings, GitHubDeviceCodeResponse, GitProvider } from '../types';
import { Onboarding } from './Onboarding';
import { DiagnosticLog } from '../services/logger';

export const Popup: React.FC = () => {
  const [auth, setAuth] = useState<{ authenticated: boolean; user: GitHubUser | null }>({
    authenticated: false,
    user: null
  });
  const [settings, setSettings] = useState<ExtensionSettings>({
    githubClientId: 'Ov23liZ2Ym642n4jZ9aO',
    defaultPushMode: 'branch_pr'
  });
  const [deviceCode, setDeviceCode] = useState<GitHubDeviceCodeResponse | null>(null);

  // Diagnostics & onboarding state
  const [diagnostics, setDiagnostics] = useState<DiagnosticLog[]>([]);
  const [copiedDiag, setCopiedDiag] = useState<boolean>(false);
  const [showOnboarding, setShowOnboarding] = useState<boolean>(false);

  // Editable settings inputs
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [clientSecretInput, setClientSecretInput] = useState<string>('');
  const [pushModeInput, setPushModeInput] = useState<'branch_pr' | 'direct'>('branch_pr');
  const [activeTab, setActiveTab] = useState<'main' | 'settings' | 'diagnostics'>('main');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

  // GitLab
  const [gitlabTokenInput, setGitlabTokenInput] = useState<string>('');
  const [gitlabHostInput, setGitlabHostInput] = useState<string>('');

  // Bitbucket
  const [bitbucketTokenInput, setBitbucketTokenInput] = useState<string>('');
  const [bitbucketUsernameInput, setBitbucketUsernameInput] = useState<string>('');

  // Vercel Hooks
  const [vercelHooksList, setVercelHooksList] = useState<Array<{ id: string; name: string; url: string }>>([]);
  const [newHookName, setNewHookName] = useState<string>('');
  const [newHookUrl, setNewHookUrl] = useState<string>('');

  // Presets
  const [presetsList, setPresetsList] = useState<any[]>([]);
  const [newPresetName, setNewPresetName] = useState<string>('');
  const [newPresetProvider, setNewPresetProvider] = useState<GitProvider>('github');
  const [newPresetOwner, setNewPresetOwner] = useState<string>('');
  const [newPresetRepo, setNewPresetRepo] = useState<string>('');
  const [newPresetBranch, setNewPresetBranch] = useState<string>('main');
  const [newPresetFolderPath, setNewPresetFolderPath] = useState<string>('src/');
  const [newPresetPushMode, setNewPresetPushMode] = useState<'branch_pr' | 'direct'>('branch_pr');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      // Check Auth
      const authRes = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });
      if (authRes?.success && authRes.data?.authenticated) {
        setAuth({ authenticated: true, user: authRes.data.user });
      }

      // Check Settings
      const setRes = await chrome.runtime.sendMessage({ type: 'GET_SETTINGS' });
      if (setRes?.success && setRes.data) {
        const s: ExtensionSettings = setRes.data;
        setSettings(s);
        setApiKeyInput(s.anthropicApiKey || '');
        setClientIdInput(s.githubClientId || 'Ov23liZ2Ym642n4jZ9aO');
        setClientSecretInput(s.githubClientSecret || '');
        setPushModeInput(s.defaultPushMode || 'branch_pr');
        setGitlabTokenInput(s.gitlabToken || '');
        setGitlabHostInput(s.gitlabHost || 'https://gitlab.com');
        setBitbucketTokenInput(s.bitbucketToken || '');
        setBitbucketUsernameInput(s.bitbucketUsername || '');
        setVercelHooksList(s.vercelDeployHooks || []);
        setPresetsList(s.presets || []);
        if (!s.onboardingCompleted) {
          setShowOnboarding(true);
        }
      }

      // Fetch Diagnostics
      const diagRes = await chrome.runtime.sendMessage({ type: 'GET_DIAGNOSTICS' });
      if (diagRes?.success && Array.isArray(diagRes.data)) {
        setDiagnostics(diagRes.data);
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleCompleteOnboarding = async () => {
    setShowOnboarding(false);
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { onboardingCompleted: true }
    });
  };

  const handleCopyDiagnostics = () => {
    const text = JSON.stringify(diagnostics, null, 2);
    navigator.clipboard.writeText(text);
    setCopiedDiag(true);
    setTimeout(() => setCopiedDiag(false), 2000);
  };

  const handleClearDiagnostics = async () => {
    const res = await chrome.runtime.sendMessage({ type: 'CLEAR_DIAGNOSTICS' });
    if (res?.success) {
      setDiagnostics([]);
    }
  };

  const handleStartAuth = async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'INITIATE_AUTH' });
      if (res?.success && res.data) {
        setDeviceCode(res.data);
        pollAuth(res.data);
      }
    } catch {}
  };

  const pollAuth = (deviceCodeData: any) => {
    const timer = setInterval(async () => {
      const check = await chrome.runtime.sendMessage({
        type: 'POLL_AUTH',
        deviceCode: deviceCodeData.device_code
      });
      if (check?.success && check.data?.authenticated) {
        clearInterval(timer);
        setDeviceCode(null);
        setAuth({ authenticated: true, user: check.data.user });
      }
    }, 5000);
  };

  const handleLogout = async () => {
    await chrome.runtime.sendMessage({ type: 'LOGOUT' });
    setAuth({ authenticated: false, user: null });
  };

  const handleSaveSettings = async () => {
    try {
      const updated = await chrome.runtime.sendMessage({
        type: 'SAVE_SETTINGS',
        settings: {
          anthropicApiKey: apiKeyInput.trim(),
          githubClientId: clientIdInput.trim() || 'Ov23liZ2Ym642n4jZ9aO',
          githubClientSecret: clientSecretInput.trim(),
          defaultPushMode: pushModeInput,
          gitlabToken: gitlabTokenInput.trim(),
          gitlabHost: gitlabHostInput.trim() || 'https://gitlab.com',
          bitbucketToken: bitbucketTokenInput.trim(),
          bitbucketUsername: bitbucketUsernameInput.trim()
        }
      });

      if (updated?.success) {
        setSettings(updated.data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {}
  };

  // Vercel Hook Helpers
  const handleAddVercelHook = async () => {
    if (!newHookName.trim() || !newHookUrl.trim()) return;
    const newHook = {
      id: Date.now().toString(),
      name: newHookName.trim(),
      url: newHookUrl.trim()
    };
    const updatedList = [...vercelHooksList, newHook];
    setVercelHooksList(updatedList);
    setNewHookName('');
    setNewHookUrl('');

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { vercelDeployHooks: updatedList }
    });
  };

  const handleDeleteVercelHook = async (hookId: string) => {
    const updatedList = vercelHooksList.filter((h) => h.id !== hookId);
    setVercelHooksList(updatedList);
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { vercelDeployHooks: updatedList }
    });
  };

  // Presets Helpers
  const handleAddPreset = async () => {
    if (!newPresetName.trim() || !newPresetOwner.trim() || !newPresetRepo.trim()) return;
    const newPreset = {
      id: Date.now().toString(),
      name: newPresetName.trim(),
      provider: newPresetProvider,
      owner: newPresetOwner.trim(),
      repo: newPresetRepo.trim(),
      branch: newPresetBranch.trim(),
      folderPath: newPresetFolderPath.trim(),
      pushMode: newPresetPushMode
    };
    const updatedList = [...presetsList, newPreset];
    setPresetsList(updatedList);
    setNewPresetName('');
    setNewPresetOwner('');
    setNewPresetRepo('');
    setNewPresetBranch('main');
    setNewPresetFolderPath('src/');

    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { presets: updatedList }
    });
  };

  const handleDeletePreset = async (presetId: string) => {
    const updatedList = presetsList.filter((p) => p.id !== presetId);
    setPresetsList(updatedList);
    await chrome.runtime.sendMessage({
      type: 'SAVE_SETTINGS',
      settings: { presets: updatedList }
    });
  };

  const handleExportPresets = () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(presetsList, null, 2));
    const dlAnchorElem = document.createElement('a');
    dlAnchorElem.setAttribute("href", dataStr);
    dlAnchorElem.setAttribute("download", "nowaygit_presets.json");
    dlAnchorElem.click();
  };

  const handleImportPresets = (event: React.ChangeEvent<HTMLInputElement>) => {
    const fileReader = new FileReader();
    if (event.target.files && event.target.files[0]) {
      fileReader.readAsText(event.target.files[0], "UTF-8");
      fileReader.onload = async (e) => {
        try {
          const parsed = JSON.parse(e.target?.result as string);
          if (Array.isArray(parsed)) {
            const merged = [...presetsList, ...parsed];
            setPresetsList(merged);
            await chrome.runtime.sendMessage({
              type: 'SAVE_SETTINGS',
              settings: { presets: merged }
            });
            alert('Presets imported successfully!');
          } else {
            alert('Invalid presets file format.');
          }
        } catch {
          alert('Error parsing presets JSON.');
        }
      };
    }
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
        Loading nowaygit...
      </div>
    );
  }

  if (showOnboarding) {
    return <Onboarding onComplete={handleCompleteOnboarding} onStartAuth={handleStartAuth} />;
  }

  return (
    <div style={{ width: '340px', backgroundColor: '#fafaf9', color: '#1e293b', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <style>{`
        input, select, button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
        }
        input:focus, select:focus {
          outline: none;
          border-color: #0f172a !important;
          box-shadow: 0 0 0 2px rgba(15, 23, 42, 0.1) !important;
        }
        .btn-primary:hover {
          background-color: #1e293b !important;
          transform: translateY(-1px);
          box-shadow: 0 4px 10px rgba(15, 23, 42, 0.15) !important;
        }
        .btn-primary:active {
          transform: translateY(0);
          box-shadow: none !important;
        }
        .card-hover {
          transition: transform 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease;
        }
        .card-hover:hover {
          transform: translateY(-1px);
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.05) !important;
        }
        .tab-btn {
          transition: all 0.2s ease;
        }
        .tab-btn:hover {
          background-color: #f1f5f9 !important;
          color: #0f172a !important;
        }
        .tab-btn-active {
          background-color: #e2e8f0 !important;
          color: #0f172a !important;
        }
        /* Custom scrollbar */
        ::-webkit-scrollbar {
          width: 5px;
          height: 5px;
        }
        ::-webkit-scrollbar-track {
          background: transparent;
        }
        ::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 3px;
        }
        ::-webkit-scrollbar-thumb:hover {
          background: #94a3b8;
        }
      `}</style>
      {/* Extension Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #e2e8f0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: '#ffffff'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #1e293b 0%, #475569 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GitPullRequest style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#0f172a' }}>nowaygit</h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('main')}
            className={`tab-btn ${activeTab === 'main' ? 'tab-btn-active' : ''}`}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: activeTab === 'main' ? '#e2e8f0' : 'transparent',
              color: activeTab === 'main' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 500
            }}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`tab-btn ${activeTab === 'settings' ? 'tab-btn-active' : ''}`}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: activeTab === 'settings' ? '#e2e8f0' : 'transparent',
              color: activeTab === 'settings' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Settings style={{ width: '12px', height: '12px' }} />
          </button>
          <button
            onClick={() => setActiveTab('diagnostics')}
            title="Diagnostics"
            className={`tab-btn ${activeTab === 'diagnostics' ? 'tab-btn-active' : ''}`}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: activeTab === 'diagnostics' ? '#e2e8f0' : 'transparent',
              color: activeTab === 'diagnostics' ? '#0f172a' : '#64748b',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '4px'
            }}
          >
            <Terminal style={{ width: '12px', height: '12px' }} />
          </button>
        </div>
      </div>

      {/* Main Tab */}
      {activeTab === 'main' && (
        <div style={{ padding: '16px' }}>
          {/* Auth Card */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
              marginBottom: '16px'
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                marginBottom: '10px'
              }}
            >
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#64748b', fontWeight: 600 }}>
                GitHub Connection
              </span>
              {auth.authenticated && (
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#ef4444',
                    cursor: 'pointer',
                    padding: 0
                  }}
                >
                  <LogOut style={{ width: '14px', height: '14px' }} />
                </button>
              )}
            </div>

            {auth.authenticated && auth.user ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <img
                  src={auth.user.avatar_url}
                  alt={auth.user.login}
                  style={{ width: '32px', height: '32px', borderRadius: '50%' }}
                />
                <div>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                    {auth.user.name || auth.user.login}
                  </div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>@{auth.user.login}</div>
                </div>
              </div>
            ) : deviceCode ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <p style={{ fontSize: '11px', color: '#475569', margin: '0 0 6px' }}>
                  Enter code on GitHub:
                </p>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '2px',
                    marginBottom: '8px'
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
                    gap: '4px',
                    fontSize: '11px',
                    color: '#2563eb',
                    textDecoration: 'none',
                    fontWeight: 500
                  }}
                >
                  Authorize <ExternalLink style={{ width: '10px', height: '10px' }} />
                </a>
              </div>
            ) : (
              <button
                onClick={handleStartAuth}
                className="btn-primary"
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#0f172a',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '6px',
                  fontSize: '12px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '6px'
                }}
              >
                <Github style={{ width: '14px', height: '14px' }} /> Connect GitHub Account
              </button>
            )}
          </div>

          {/* Quick Info & Instructions */}
          <div
            className="card-hover"
            style={{
              padding: '12px',
              backgroundColor: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#334155',
              lineHeight: 1.4,
              boxShadow: '0 1px 2px rgba(0,0,0,0.02)'
            }}
          >
            <div style={{ fontWeight: 600, color: '#0f172a', marginBottom: '4px' }}>
              How to use nowaygit:
            </div>
            1. Open any artifact in <strong style={{ color: '#0f172a' }}>claude.ai</strong>.<br />
            2. Click the <strong style={{ color: '#0f172a' }}>Push to GitHub</strong> button in the toolbar.<br />
            3. Choose target repo, path, & commit message!
          </div>

          {/* Last Used Repo Shortcut */}
          {settings.lastUsedRepo && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: '#64748b' }}>
              <div style={{ marginBottom: '4px' }}>Last Pushed Target:</div>
              <a
                href={`https://github.com/${settings.lastUsedRepo.owner}/${settings.lastUsedRepo.repo}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#2563eb',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  fontWeight: 500
                }}
              >
                {settings.lastUsedRepo.owner}/{settings.lastUsedRepo.repo} (
                {settings.lastUsedRepo.filePath}) <ExternalLink style={{ width: '10px', height: '10px' }} />
              </a>
            </div>
          )}
        </div>
      )}

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div style={{ padding: '16px' }}>
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Default Push Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPushModeInput('branch_pr')}
                style={{
                  flex: 1,
                  padding: '6px',
                  backgroundColor: pushModeInput === 'branch_pr' ? '#0f172a' : '#ffffff',
                  border: `1px solid ${pushModeInput === 'branch_pr' ? '#0f172a' : '#cbd5e1'}`,
                  borderRadius: '6px',
                  color: pushModeInput === 'branch_pr' ? '#ffffff' : '#475569',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: 500
                }}
              >
                <GitPullRequest style={{ width: '12px', height: '12px' }} /> Branch + PR
              </button>
              <button
                onClick={() => setPushModeInput('direct')}
                style={{
                  flex: 1,
                  padding: '6px',
                  backgroundColor: pushModeInput === 'direct' ? '#0f172a' : '#ffffff',
                  border: `1px solid ${pushModeInput === 'direct' ? '#0f172a' : '#cbd5e1'}`,
                  borderRadius: '6px',
                  color: pushModeInput === 'direct' ? '#ffffff' : '#475569',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px',
                  fontWeight: 500
                }}
              >
                <GitBranch style={{ width: '12px', height: '12px' }} /> Direct Push
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Anthropic API Key (AI Commit Messages)
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="password"
                value={apiKeyInput}
                onChange={(e) => setApiKeyInput(e.target.value)}
                placeholder="sk-ant-api03-..."
                style={{
                  width: '100%',
                  padding: '6px 10px 6px 28px',
                  backgroundColor: '#ffffff',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                  color: '#0f172a',
                  fontSize: '11px',
                  boxSizing: 'border-box'
                }}
              />
              <Key
                style={{
                  position: 'absolute',
                  left: '8px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  width: '12px',
                  height: '12px',
                  color: '#64748b'
                }}
              />
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '10px', color: '#64748b' }}>
              Optional. Used only client-side to generate AI commit messages.
            </p>
          </div>

          <div style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              GitHub OAuth Client ID
            </label>
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '11px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

          {/* GitLab Integration */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              GitLab Personal Access Token
            </label>
            <input
              type="password"
              placeholder="glpat-..."
              value={gitlabTokenInput}
              onChange={(e) => setGitlabTokenInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '11px',
                boxSizing: 'border-box',
                marginBottom: '6px'
              }}
            />
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              GitLab Host URL (Optional)
            </label>
            <input
              type="text"
              placeholder="https://gitlab.com"
              value={gitlabHostInput}
              onChange={(e) => setGitlabHostInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '11px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

          {/* Bitbucket Integration */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Bitbucket App Password
            </label>
            <input
              type="password"
              placeholder="App password token"
              value={bitbucketTokenInput}
              onChange={(e) => setBitbucketTokenInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '11px',
                boxSizing: 'border-box',
                marginBottom: '6px'
              }}
            />
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Bitbucket Username
            </label>
            <input
              type="text"
              placeholder="e.g. bitbucket_user"
              value={bitbucketUsernameInput}
              onChange={(e) => setBitbucketUsernameInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                color: '#0f172a',
                fontSize: '11px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

          {/* Vercel Hook Integration */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
              Vercel Deploy Hooks
            </label>
            {vercelHooksList.length > 0 && (
              <div style={{ marginBottom: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                {vercelHooksList.map((h) => (
                  <div key={h.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#0f172a' }}>{h.name}</span>
                    <button onClick={() => handleDeleteVercelHook(h.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '4px' }}>
              <input
                type="text"
                placeholder="Hook Name"
                value={newHookName}
                onChange={(e) => setNewHookName(e.target.value)}
                style={{ width: '40%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
              />
              <input
                type="text"
                placeholder="https://api.vercel.com/..."
                value={newHookUrl}
                onChange={(e) => setNewHookUrl(e.target.value)}
                style={{ width: '60%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
              />
            </div>
            <button onClick={handleAddVercelHook} className="btn-primary" style={{ width: '100%', padding: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer', marginBottom: '8px' }}>
              Add Deploy Hook
            </button>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

          {/* Presets Manager */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569' }}>Destination Presets</label>
              <div style={{ display: 'flex', gap: '6px' }}>
                <button onClick={handleExportPresets} style={{ background: 'none', border: 'none', color: '#2563eb', fontSize: '9px', cursor: 'pointer' }}>Export</button>
                <label style={{ color: '#2563eb', fontSize: '9px', cursor: 'pointer' }}>
                  Import
                  <input type="file" accept=".json" onChange={handleImportPresets} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            {presetsList.length > 0 && (
              <div style={{ marginBottom: '8px', maxHeight: '100px', overflowY: 'auto' }}>
                {presetsList.map((p) => (
                  <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#f1f5f9', padding: '4px 8px', borderRadius: '4px', marginBottom: '4px' }}>
                    <span style={{ fontSize: '10px', color: '#0f172a' }}>{p.name} ({p.owner}/{p.repo})</span>
                    <button onClick={() => handleDeletePreset(p.id)} style={{ border: 'none', background: 'transparent', color: '#ef4444', cursor: 'pointer', fontSize: '10px' }}>Remove</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', backgroundColor: '#f1f5f9', border: '1px solid #e2e8f0', padding: '8px', borderRadius: '6px', marginBottom: '4px' }}>
              <input
                type="text"
                placeholder="Preset Name (e.g. Main Repo)"
                value={newPresetName}
                onChange={(e) => setNewPresetName(e.target.value)}
                style={{ padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
              />
              <div style={{ display: 'flex', gap: '4px' }}>
                <select
                  value={newPresetProvider}
                  onChange={(e) => setNewPresetProvider(e.target.value as any)}
                  style={{ width: '40%', padding: '4px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="bitbucket">Bitbucket</option>
                </select>
                <input
                  type="text"
                  placeholder="Owner"
                  value={newPresetOwner}
                  onChange={(e) => setNewPresetOwner(e.target.value)}
                  style={{ width: '30%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                />
                <input
                  type="text"
                  placeholder="Repo"
                  value={newPresetRepo}
                  onChange={(e) => setNewPresetRepo(e.target.value)}
                  style={{ width: '30%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                />
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                <input
                  type="text"
                  placeholder="Branch"
                  value={newPresetBranch}
                  onChange={(e) => setNewPresetBranch(e.target.value)}
                  style={{ width: '30%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                />
                <input
                  type="text"
                  placeholder="Folder Path"
                  value={newPresetFolderPath}
                  onChange={(e) => setNewPresetFolderPath(e.target.value)}
                  style={{ width: '40%', padding: '4px 6px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                />
                <select
                  value={newPresetPushMode}
                  onChange={(e) => setNewPresetPushMode(e.target.value as any)}
                  style={{ width: '30%', padding: '4px', backgroundColor: '#ffffff', border: '1px solid #cbd5e1', borderRadius: '4px', color: '#0f172a', fontSize: '10px' }}
                >
                  <option value="branch_pr">PR</option>
                  <option value="direct">Direct</option>
                </select>
              </div>
              <button onClick={handleAddPreset} className="btn-primary" style={{ padding: '4px', backgroundColor: '#0f172a', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '10px', cursor: 'pointer' }}>
                Add Preset
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #e2e8f0', margin: '14px 0' }} />

          <button
            onClick={handleSaveSettings}
            className="btn-primary"
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: saveSuccess ? '#22c55e' : '#0f172a',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
          >
            {saveSuccess ? (
              <>
                <CheckCircle style={{ width: '14px', height: '14px' }} /> Saved!
              </>
            ) : (
              <>
                <Save style={{ width: '14px', height: '14px' }} /> Save Preferences
              </>
            )}
          </button>
        </div>
      )}

      {/* Diagnostics Tab */}
      {activeTab === 'diagnostics' && (
        <div style={{ padding: '16px' }}>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              marginBottom: '10px'
            }}
          >
            <span style={{ fontSize: '12px', fontWeight: 600, color: '#475569' }}>
              Local Diagnostics (Last {diagnostics.length})
            </span>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={handleCopyDiagnostics}
                disabled={diagnostics.length === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: copiedDiag ? '#10b981' : '#2563eb',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                {copiedDiag ? (
                  <>
                    <Check style={{ width: '12px', height: '12px' }} /> Copied
                  </>
                ) : (
                  <>
                    <Copy style={{ width: '12px', height: '12px' }} /> Copy Logs
                  </>
                )}
              </button>
              <button
                onClick={handleClearDiagnostics}
                disabled={diagnostics.length === 0}
                style={{
                  background: 'none',
                  border: 'none',
                  color: '#ef4444',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
                }}
              >
                Clear Logs
              </button>
            </div>
          </div>

          <div
            style={{
              maxHeight: '260px',
              overflowY: 'auto',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '6px',
              padding: '10px',
              fontFamily: 'monospace',
              fontSize: '10px',
              color: '#334155',
              lineHeight: 1.4
            }}
          >
            {diagnostics.length === 0 ? (
              <div style={{ color: '#64748b', textAlign: 'center', padding: '20px 0' }}>
                No diagnostic errors recorded.
              </div>
            ) : (
              diagnostics.map((log, idx) => (
                <div
                  key={idx}
                  style={{
                    marginBottom: '8px',
                    paddingBottom: '8px',
                    borderBottom: '1px solid #e2e8f0'
                  }}
                >
                  <div style={{ color: '#ef4444', fontWeight: 600 }}>
                    [{new Date(log.timestamp).toLocaleTimeString()}] {log.source}
                  </div>
                  <div>{log.message}</div>
                  {log.details && <div style={{ color: '#64748b' }}>{log.details}</div>}
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};
