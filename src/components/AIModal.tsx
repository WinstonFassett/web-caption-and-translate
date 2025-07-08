import React, { useState } from 'react';
import { X, Loader2, Copy, Download } from 'lucide-react';
import { AIResponse } from '../types';

interface AIModalProps {
  isOpen: boolean;
  onClose: () => void;
  response: AIResponse | null;
  isLoading: boolean;
}

export const AIModal: React.FC<AIModalProps> = ({
  isOpen,
  onClose,
  response,
  isLoading
}) => {
  const [copyFeedback, setCopyFeedback] = useState(false);

  if (!isOpen) return null;

  const copyToClipboard = async () => {
    if (response?.content) {
      try {
        await navigator.clipboard.writeText(response.content);
        setCopyFeedback(true);
        setTimeout(() => setCopyFeedback(false), 2000);
      } catch (err) {
        console.error('Failed to copy:', err);
      }
    }
  };

  const downloadAsMarkdown = () => {
    if (response?.content) {
      const blob = new Blob([response.content], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ai-${response.type}-${new Date().toISOString().split('T')[0]}.md`;
      a.click();
      URL.revokeObjectURL(url);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white/10 backdrop-blur-lg rounded-2xl border border-white/20 w-full max-w-4xl max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-white/20">
          <h2 className="text-xl font-bold text-white">
            {response ? `AI ${response.type.charAt(0).toUpperCase() + response.type.slice(1)}` : 'AI Processing'}
          </h2>
          <div className="flex items-center space-x-2">
            {response && (
              <>
                <button
                  onClick={copyToClipboard}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors duration-200"
                  title="Copy to clipboard"
                >
                  <Copy className="w-4 h-4" />
                </button>
                <button
                  onClick={downloadAsMarkdown}
                  className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors duration-200"
                  title="Download as Markdown"
                >
                  <Download className="w-4 h-4" />
                </button>
              </>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg bg-white/10 text-white hover:bg-white/20 transition-colors duration-200"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[60vh]">
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <div className="text-center">
                <Loader2 className="w-8 h-8 text-blue-400 animate-spin mx-auto mb-4" />
                <p className="text-white/60">AI is analyzing your transcript...</p>
              </div>
            </div>
          ) : response ? (
            <div className="prose prose-invert max-w-none">
              <div 
                className="text-white/90 leading-relaxed whitespace-pre-wrap"
                dangerouslySetInnerHTML={{ 
                  __html: response.content
                    .replace(/^# (.*$)/gm, '<h1 class="text-2xl font-bold text-white mb-4">$1</h1>')
                    .replace(/^## (.*$)/gm, '<h2 class="text-xl font-semibold text-white mb-3 mt-6">$1</h2>')
                    .replace(/^### (.*$)/gm, '<h3 class="text-lg font-medium text-white mb-2 mt-4">$1</h3>')
                    .replace(/^\*\*(.*?)\*\*/gm, '<strong class="font-semibold text-white">$1</strong>')
                    .replace(/^\*(.*?)\*/gm, '<em class="italic text-white/80">$1</em>')
                    .replace(/^- (.*$)/gm, '<li class="text-white/90 mb-1">$1</li>')
                    .replace(/^(\d+)\. (.*$)/gm, '<li class="text-white/90 mb-1">$2</li>')
                    .replace(/`([^`]+)`/g, '<code class="bg-white/10 px-2 py-1 rounded text-blue-300 font-mono text-sm">$1</code>')
                }}
              />
            </div>
          ) : null}
        </div>

        {/* Copy feedback */}
        {copyFeedback && (
          <div className="absolute top-4 right-16 bg-green-500/90 text-white px-3 py-1 rounded-lg text-sm">
            Copied!
          </div>
        )}
      </div>
    </div>
  );
};