import React from 'react';
import { Loader2, Download, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';

interface FileProgress {
  fileName: string;
  progress: number;
  status: string;
}

interface ProgressState {
  files: Map<string, FileProgress>;
  overallProgress: number;
  status: string;
  modelName: string;
}

interface TranslationStatusProps {
  isInitializing: boolean;
  isReady: boolean;
  error: string | null;
  progressState?: ProgressState;
  targetLanguage: string;
  onPreload: () => void;
}

export const TranslationStatus: React.FC<TranslationStatusProps> = ({
  isInitializing,
  isReady,
  error,
  progressState,
  targetLanguage,
  onPreload
}) => {
  if (error) {
    return (
      <div className="flex flex-col space-y-2 px-3 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4" />
          <span>Translation Error</span>
        </div>
        <div className="text-xs text-red-300 opacity-75">
          {error}
        </div>
        <button
          onClick={onPreload}
          className="flex items-center space-x-1 text-xs text-red-300 hover:text-red-200 transition-colors duration-200"
        >
          <RefreshCw className="w-3 h-3" />
          <span>Retry</span>
        </button>
      </div>
    );
  }

  if (isInitializing && progressState) {
    const fileArray = Array.from(progressState.files.values());
    
    return (
      <div className="flex flex-col space-y-3 px-4 py-3 bg-blue-500/20 text-blue-400 rounded-lg text-sm min-w-[300px] max-w-[400px]">
        <div className="flex items-center space-x-2">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="font-medium">Loading Translation Model</span>
        </div>
        
        <div className="text-xs text-blue-300 font-medium">
          {progressState.modelName}
        </div>
        
        <div className="text-xs text-blue-300">
          {progressState.status}
        </div>
        
        {/* Overall Progress Bar */}
        <div className="space-y-2">
          <div className="w-full bg-blue-900/30 rounded-full h-2">
            <div 
              className="bg-blue-400 h-2 rounded-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(0, Math.min(100, progressState.overallProgress))}%` }}
            />
          </div>
          
          <div className="flex justify-between text-xs text-blue-300">
            <span>Overall Progress</span>
            <span>{Math.round(progressState.overallProgress)}%</span>
          </div>
        </div>
        
        {/* Individual File Progress */}
        {fileArray.length > 0 && (
          <div className="space-y-2 max-h-32 overflow-y-auto">
            <div className="text-xs text-blue-200 font-medium">Files ({fileArray.length}):</div>
            {fileArray.map((file, index) => (
              <div key={index} className="space-y-1">
                <div className="flex justify-between text-xs text-blue-300">
                  <span className="truncate max-w-[200px]" title={file.fileName}>
                    {file.fileName.split('/').pop() || file.fileName}
                  </span>
                  <span>{file.progress}%</span>
                </div>
                <div className="w-full bg-blue-900/30 rounded-full h-1">
                  <div 
                    className="bg-blue-300 h-1 rounded-full transition-all duration-300 ease-out"
                    style={{ width: `${Math.max(0, Math.min(100, file.progress))}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
        
        <div className="text-xs text-blue-200 opacity-75">
          Model size: ~50-100MB
        </div>
      </div>
    );
  }

  if (isReady) {
    return (
      <div className="flex flex-col space-y-1 px-3 py-2 bg-green-500/20 text-green-400 rounded-lg text-sm">
        <div className="flex items-center space-x-2">
          <CheckCircle className="w-4 h-4" />
          <span>AI Translation Ready</span>
        </div>
        <div className="text-xs text-green-300 opacity-75">
          {targetLanguage.toUpperCase()} model loaded
        </div>
      </div>
    );
  }

  return (
    <button
      onClick={onPreload}
      className="flex flex-col space-y-1 px-3 py-2 bg-purple-500/20 text-purple-400 hover:bg-purple-500/30 rounded-lg text-sm transition-colors duration-200"
    >
      <div className="flex items-center space-x-2">
        <Download className="w-4 h-4" />
        <span>Load AI Translation</span>
      </div>
      <div className="text-xs text-purple-300 opacity-75">
        For {targetLanguage.toUpperCase()} language
      </div>
    </button>
  );
};