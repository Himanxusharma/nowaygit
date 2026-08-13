import React, { useState } from 'react';
import { GitPullRequest, Github, Sparkles, CheckCircle2, ArrowRight } from 'lucide-react';

interface OnboardingProps {
  onComplete: () => void;
  onStartAuth: () => void;
}

export const Onboarding: React.FC<OnboardingProps> = ({ onComplete, onStartAuth }) => {
  const [step, setStep] = useState<number>(1);

  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      onComplete();
    }
  };

  return (
    <div
      style={{
        padding: '20px 16px',
        backgroundColor: '#f8fafc',
        color: '#0f172a',
        minHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        fontFamily: 'Inter, system-ui, sans-serif'
      }}
    >
      <style>{`
        button {
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
      `}</style>
      {/* Top Header & Skip Action */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '6px' }}>
          {[1, 2, 3].map((i) => (
            <div
              key={i}
              style={{
                width: '24px',
                height: '4px',
                borderRadius: '2px',
                backgroundColor: i === step ? '#0f172a' : i < step ? '#64748b' : '#e2e8f0',
                transition: 'background-color 0.2s ease'
              }}
            />
          ))}
        </div>
        <button
          onClick={onComplete}
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            fontSize: '11px',
            cursor: 'pointer'
          }}
        >
          Skip
        </button>
      </div>

      {/* Step Content */}
      <div style={{ textAlign: 'center', padding: '16px 0' }}>
        {step === 1 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                background: '#ffffff',
                border: '1px solid #ef4444',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 10px rgba(239, 68, 68, 0.15)'
              }}
            >
              <GitPullRequest style={{ width: '28px', height: '28px', color: '#ef4444' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Welcome to nowaygit
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              Push generated code, markdown, and whole conversation outputs directly from{' '}
              <strong style={{ color: '#0f172a' }}>claude.ai</strong> to your Git repos in 1 click.
            </p>
          </div>
        )}

        {step === 2 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}
            >
              <Github style={{ width: '28px', height: '28px', color: '#0f172a' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>
              Connect Your GitHub
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              Uses GitHub Device Flow. Pure client-side, no passwords stored, and zero secret keys required.
            </p>
            <button
              onClick={onStartAuth}
              style={{
                padding: '8px 16px',
                backgroundColor: '#ffffff',
                color: '#0f172a',
                border: '1px solid #cbd5e1',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '8px',
                boxShadow: '0 1px 2px rgba(0,0,0,0.05)'
              }}
            >
              Connect GitHub Now
            </button>
          </div>
        )}

        {step === 3 && (
          <div style={{ textAlign: 'center' }}>
            <div
              style={{
                width: '52px',
                height: '52px',
                borderRadius: '16px',
                backgroundColor: '#ffffff',
                border: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 4px 6px rgba(0,0,0,0.05)'
              }}
            >
              <Sparkles style={{ width: '28px', height: '28px', color: '#eab308' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600, color: '#0f172a' }}>Ready to Build!</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#475569', lineHeight: 1.5 }}>
              Open any artifact in <strong style={{ color: '#0f172a' }}>claude.ai</strong> and click the injected{' '}
              <span style={{ color: '#ef4444', fontWeight: 600 }}>Push to GitHub</span> toolbar button.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div>
        <button
          onClick={handleNext}
          className="btn-primary"
          style={{
            width: '100%',
            padding: '10px',
            backgroundColor: '#0f172a',
            color: '#fff',
            border: 'none',
            borderRadius: '8px',
            fontSize: '13px',
            fontWeight: 600,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '6px'
          }}
        >
          {step < 3 ? (
            <>
              Next <ArrowRight style={{ width: '14px', height: '14px' }} />
            </>
          ) : (
            <>
              Get Started <CheckCircle2 style={{ width: '14px', height: '14px' }} />
            </>
          )}
        </button>
      </div>
    </div>
  );
};
