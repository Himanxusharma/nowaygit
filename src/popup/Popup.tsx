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
  Github
} from 'lucide-react';
import { GitHubUser, ExtensionSettings, GitHubDeviceCodeResponse } from '../types';

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

  // Editable settings inputs
  const [apiKeyInput, setApiKeyInput] = useState<string>('');
  const [clientIdInput, setClientIdInput] = useState<string>('');
  const [pushModeInput, setPushModeInput] = useState<'branch_pr' | 'direct'>('branch_pr');
  const [activeTab, setActiveTab] = useState<'main' | 'settings'>('main');
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);
  const [loading, setLoading] = useState<boolean>(true);

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
        setPushModeInput(s.defaultPushMode || 'branch_pr');
      }
    } catch {
    } finally {
      setLoading(false);
    }
  };

  const handleStartAuth = async () => {
    try {
      const res = await chrome.runtime.sendMessage({ type: 'INITIATE_AUTH' });
      if (res?.success && res.data) {
        setDeviceCode(res.data);
        pollAuth();
      }
    } catch {}
  };

  const pollAuth = () => {
    const timer = setInterval(async () => {
      const check = await chrome.runtime.sendMessage({ type: 'CHECK_AUTH_STATUS' });
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
          defaultPushMode: pushModeInput
        }
      });

      if (updated?.success) {
        setSettings(updated.data);
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch {}
  };

  if (loading) {
    return (
      <div style={{ padding: '40px 20px', textAlign: 'center', color: '#94a3b8' }}>
        Loading nowaygit...
      </div>
    );
  }

  return (
    <div style={{ width: '340px', backgroundColor: '#0f172a', color: '#f8fafc' }}>
      {/* Extension Header */}
      <div
        style={{
          padding: '14px 16px',
          borderBottom: '1px solid #1e293b',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          background: 'linear-gradient(135deg, #0f172a 0%, #1e1b4b 100%)'
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <div
            style={{
              width: '28px',
              height: '28px',
              borderRadius: '6px',
              background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}
          >
            <GitPullRequest style={{ width: '16px', height: '16px', color: '#fff' }} />
          </div>
          <div>
            <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 600 }}>nowaygit</h2>
          </div>
        </div>

        <div style={{ display: 'flex', gap: '4px' }}>
          <button
            onClick={() => setActiveTab('main')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: activeTab === 'main' ? '#334155' : 'transparent',
              color: activeTab === 'main' ? '#fff' : '#94a3b8',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Home
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              backgroundColor: activeTab === 'settings' ? '#334155' : 'transparent',
              color: activeTab === 'settings' ? '#fff' : '#94a3b8',
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
        </div>
      </div>

      {/* Main Tab */}
      {activeTab === 'main' && (
        <div style={{ padding: '16px' }}>
          {/* Auth Card */}
          <div
            style={{
              padding: '14px',
              backgroundColor: '#1e293b',
              borderRadius: '10px',
              border: '1px solid #334155',
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
              <span style={{ fontSize: '11px', textTransform: 'uppercase', color: '#94a3b8', fontWeight: 600 }}>
                GitHub Connection
              </span>
              {auth.authenticated && (
                <button
                  onClick={handleLogout}
                  title="Sign out"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#f87171',
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
                  <div style={{ fontSize: '13px', fontWeight: 600, color: '#fff' }}>
                    {auth.user.name || auth.user.login}
                  </div>
                  <div style={{ fontSize: '11px', color: '#94a3b8' }}>@{auth.user.login}</div>
                </div>
              </div>
            ) : deviceCode ? (
              <div style={{ textAlign: 'center', padding: '6px 0' }}>
                <p style={{ fontSize: '11px', color: '#cbd5e1', margin: '0 0 6px' }}>
                  Enter code on GitHub:
                </p>
                <div
                  style={{
                    fontSize: '18px',
                    fontWeight: 700,
                    color: '#a855f7',
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
                    color: '#818cf8',
                    textDecoration: 'none'
                  }}
                >
                  Authorize <ExternalLink style={{ width: '10px', height: '10px' }} />
                </a>
              </div>
            ) : (
              <button
                onClick={handleStartAuth}
                style={{
                  width: '100%',
                  padding: '8px',
                  backgroundColor: '#6366f1',
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
            style={{
              padding: '12px',
              backgroundColor: 'rgba(99, 102, 241, 0.1)',
              border: '1px solid rgba(99, 102, 241, 0.2)',
              borderRadius: '8px',
              fontSize: '11px',
              color: '#cbd5e1',
              lineHeight: 1.4
            }}
          >
            <div style={{ fontWeight: 600, color: '#818cf8', marginBottom: '4px' }}>
              How to use nowaygit:
            </div>
            1. Open any artifact in <strong style={{ color: '#fff' }}>claude.ai</strong>.<br />
            2. Click the <strong style={{ color: '#a855f7' }}>Push to GitHub</strong> button in the toolbar.<br />
            3. Choose target repo, path, & commit message!
          </div>

          {/* Last Used Repo Shortcut */}
          {settings.lastUsedRepo && (
            <div style={{ marginTop: '16px', fontSize: '11px', color: '#94a3b8' }}>
              <div style={{ marginBottom: '4px' }}>Last Pushed Target:</div>
              <a
                href={`https://github.com/${settings.lastUsedRepo.owner}/${settings.lastUsedRepo.repo}`}
                target="_blank"
                rel="noreferrer"
                style={{
                  color: '#818cf8',
                  textDecoration: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px'
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
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
              Default Push Mode
            </label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <button
                onClick={() => setPushModeInput('branch_pr')}
                style={{
                  flex: 1,
                  padding: '6px',
                  backgroundColor: pushModeInput === 'branch_pr' ? '#334155' : '#1e293b',
                  border: `1px solid ${pushModeInput === 'branch_pr' ? '#6366f1' : '#334155'}`,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <GitPullRequest style={{ width: '12px', height: '12px' }} /> Branch + PR
              </button>
              <button
                onClick={() => setPushModeInput('direct')}
                style={{
                  flex: 1,
                  padding: '6px',
                  backgroundColor: pushModeInput === 'direct' ? '#334155' : '#1e293b',
                  border: `1px solid ${pushModeInput === 'direct' ? '#6366f1' : '#334155'}`,
                  borderRadius: '6px',
                  color: '#fff',
                  fontSize: '11px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '4px'
                }}
              >
                <GitBranch style={{ width: '12px', height: '12px' }} /> Direct Push
              </button>
            </div>
          </div>

          <div style={{ marginBottom: '14px' }}>
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
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
                  backgroundColor: '#1e293b',
                  border: '1px solid #334155',
                  borderRadius: '6px',
                  color: '#fff',
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
            <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#cbd5e1', marginBottom: '4px' }}>
              GitHub OAuth Client ID
            </label>
            <input
              type="text"
              value={clientIdInput}
              onChange={(e) => setClientIdInput(e.target.value)}
              style={{
                width: '100%',
                padding: '6px 10px',
                backgroundColor: '#1e293b',
                border: '1px solid #334155',
                borderRadius: '6px',
                color: '#fff',
                fontSize: '11px',
                boxSizing: 'border-box'
              }}
            />
          </div>

          <button
            onClick={handleSaveSettings}
            style={{
              width: '100%',
              padding: '8px',
              backgroundColor: saveSuccess ? '#22c55e' : '#6366f1',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'background-color 0.2s ease'
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
    </div>
  );
};
