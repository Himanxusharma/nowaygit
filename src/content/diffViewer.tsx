import React from 'react';
import { X, FileText } from 'lucide-react';
import { DiffLine } from '../types';

interface DiffViewerProps {
  filename: string;
  oldContent: string;
  newContent: string;
  onClose: () => void;
}

export const computeLineDiff = (oldStr: string, newStr: string): DiffLine[] => {
  const oldLines = oldStr.split(/\r?\n/);
  const newLines = newStr.split(/\r?\n/);
  const diffs: DiffLine[] = [];

  let i = 0;
  let j = 0;
  let oldLineNum = 1;
  let newLineNum = 1;

  while (i < oldLines.length || j < newLines.length) {
    if (i < oldLines.length && j < newLines.length && oldLines[i] === newLines[j]) {
      diffs.push({
        type: 'same',
        oldLineNumber: oldLineNum++,
        newLineNumber: newLineNum++,
        text: oldLines[i]
      });
      i++;
      j++;
    } else {
      // Simple heuristic: check if old line exists further down in newLines
      const matchIndexInNew = newLines.indexOf(oldLines[i], j);
      if (i < oldLines.length && matchIndexInNew === -1) {
        diffs.push({
          type: 'delete',
          oldLineNumber: oldLineNum++,
          text: oldLines[i]
        });
        i++;
      } else if (j < newLines.length) {
        diffs.push({
          type: 'add',
          newLineNumber: newLineNum++,
          text: newLines[j]
        });
        j++;
      } else if (i < oldLines.length) {
        diffs.push({
          type: 'delete',
          oldLineNumber: oldLineNum++,
          text: oldLines[i]
        });
        i++;
      }
    }
  }

  return diffs;
};

export const DiffViewer: React.FC<DiffViewerProps> = ({
  filename,
  oldContent,
  newContent,
  onClose
}) => {
  const diffLines = computeLineDiff(oldContent, newContent);

  const additions = diffLines.filter((l) => l.type === 'add').length;
  const deletions = diffLines.filter((l) => l.type === 'delete').length;

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.85)',
        backdropFilter: 'blur(8px)',
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'
      }}
    >
      <div
        style={{
          width: '90%',
          maxWidth: '860px',
          maxHeight: '85vh',
          backgroundColor: '#0f172a',
          color: '#f8fafc',
          border: '1px solid #334155',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.6)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden'
        }}
      >
        {/* Diff Header */}
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
            <FileText style={{ width: '20px', height: '20px', color: '#818cf8' }} />
            <div>
              <h3 style={{ margin: 0, fontSize: '15px', fontWeight: 600, color: '#fff' }}>
                Diff Preview: <span style={{ color: '#a855f7' }}>{filename}</span>
              </h3>
              <div style={{ fontSize: '11px', color: '#94a3b8', marginTop: '2px' }}>
                <span style={{ color: '#4ade80', fontWeight: 600 }}>+{additions} lines</span>,{' '}
                <span style={{ color: '#f87171', fontWeight: 600 }}>-{deletions} lines</span>
              </div>
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

        {/* Code Diff Display Container */}
        <div
          style={{
            padding: '16px',
            overflowY: 'auto',
            fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
            fontSize: '12px',
            lineHeight: 1.5,
            backgroundColor: '#020617',
            flex: 1
          }}
        >
          {diffLines.map((line, idx) => {
            const isAdd = line.type === 'add';
            const isDel = line.type === 'delete';

            const bg = isAdd
              ? 'rgba(34, 197, 94, 0.12)'
              : isDel
              ? 'rgba(239, 68, 68, 0.12)'
              : 'transparent';
            const textColor = isAdd ? '#4ade80' : isDel ? '#f87171' : '#cbd5e1';
            const prefix = isAdd ? '+' : isDel ? '-' : ' ';

            return (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  backgroundColor: bg,
                  padding: '2px 8px',
                  borderRadius: '2px'
                }}
              >
                {/* Line numbers */}
                <div
                  style={{
                    width: '36px',
                    color: '#475569',
                    userSelect: 'none',
                    textAlign: 'right',
                    paddingRight: '8px'
                  }}
                >
                  {line.oldLineNumber || ''}
                </div>
                <div
                  style={{
                    width: '36px',
                    color: '#475569',
                    userSelect: 'none',
                    textAlign: 'right',
                    paddingRight: '12px'
                  }}
                >
                  {line.newLineNumber || ''}
                </div>

                {/* Prefix symbol */}
                <div
                  style={{
                    width: '16px',
                    color: textColor,
                    fontWeight: 700,
                    userSelect: 'none'
                  }}
                >
                  {prefix}
                </div>

                {/* Content text */}
                <div style={{ color: textColor, whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
                  {line.text}
                </div>
              </div>
            );
          })}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 20px',
            borderTop: '1px solid #1e293b',
            display: 'flex',
            justifyContent: 'flex-end',
            backgroundColor: '#0f172a'
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: '6px 16px',
              backgroundColor: '#334155',
              color: '#fff',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 500,
              cursor: 'pointer'
            }}
          >
            Close Diff
          </button>
        </div>
      </div>
    </div>
  );
};
