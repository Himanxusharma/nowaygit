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
        backgroundColor: '#0f172a',
        color: '#f8fafc',
        minHeight: '360px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between'
      }}
    >
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
                backgroundColor: i === step ? '#818cf8' : i < step ? '#475569' : '#1e293b',
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
                background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px',
                boxShadow: '0 10px 25px -5px rgba(99, 102, 241, 0.4)'
              }}
            >
              <GitPullRequest style={{ width: '28px', height: '28px', color: '#fff' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
              Welcome to nowaygit
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Push generated code, markdown, and whole conversation outputs directly from{' '}
              <strong style={{ color: '#fff' }}>claude.ai</strong> to your GitHub repos in 1 click.
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
                backgroundColor: '#1e293b',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Github style={{ width: '28px', height: '28px', color: '#818cf8' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>
              Connect Your GitHub
            </h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Uses GitHub Device Flow. Pure client-side, no passwords stored, and zero secret keys required.
            </p>
            <button
              onClick={onStartAuth}
              style={{
                padding: '8px 16px',
                backgroundColor: '#334155',
                color: '#818cf8',
                border: '1px solid #475569',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                marginBottom: '8px'
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
                backgroundColor: 'rgba(34, 197, 94, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                margin: '0 auto 16px'
              }}
            >
              <Sparkles style={{ width: '28px', height: '28px', color: '#4ade80' }} />
            </div>
            <h3 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 600 }}>Ready to Build!</h3>
            <p style={{ margin: '0 0 16px', fontSize: '12px', color: '#94a3b8', lineHeight: 1.5 }}>
              Open any artifact in <strong style={{ color: '#fff' }}>claude.ai</strong> and click the injected{' '}
              <span style={{ color: '#a855f7', fontWeight: 600 }}>Push to GitHub</span> toolbar button.
            </p>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div>
        <button
          onClick={handleNext}
          style={{
            width: '100%',
            padding: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #a855f7 100%)',
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
