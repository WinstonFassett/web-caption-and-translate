import React from 'react';
import { Loader2, CheckCircle, AlertCircle, X } from 'lucide-react';

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

interface ProgressToastProps {
  isVisible: boolean;
  progressState?: ProgressState;
  isComplete: boolean;
  error?: string | null;
  onDismiss: () => void;
}

export const ProgressToast: React.FC<ProgressToastProps> = ({
  isVisible,
  progressState,
  isComplete,
  error,
  onDismiss
}) => {
  const [showAllFiles, setShowAllFiles] = React.useState(false);
  
  if (!isVisible) return null;

  const fileArray = progressState ? Array.from(progressState.files.values()) : [];
  const visibleFiles = showAllFiles ? fileArray : fileArray.slice(0, 6);
  const hasMoreFiles = fileArray.length > 6;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/20 shadow-2xl animate-fade-in-up">
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center space-x-2">
            {error ? (
              <AlertCircle className="w-5 h-5 text-red-400" />
            ) : isComplete ? (
              <CheckCircle className="w-5 h-5 text-green-400" />
            ) : (
              <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
            )}
            <span className={`font-medium text-sm ${
              error ? 'text-red-400' : isComplete ? 'text-green-400' : 'text-blue-400'
            }`}>
              {error ? 'Translation Error' : isComplete ? 'Model Ready!' : 'Loading Translation Model'}
            </span>
          </div>
          <button
            onClick={onDismiss}
            className="p-1 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors duration-200"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {error ? (
          <div className="text-xs text-red-300 opacity-75 break-words">
            {error}
          </div>
        ) : isComplete ? (
          <div className="text-xs text-green-300 opacity-75">
            AI translation model loaded successfully
          </div>
        ) : progressState ? (
          <div className="space-y-3">
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
                  style={{ 
                    width: `${Math.max(0, Math.min(100, progressState.overallProgress || 0))}%`,
                    minWidth: progressState.overallProgress > 0 ? '2px' : '0px'
                  }}
                />
              </div>
              
              <div className="flex justify-between text-xs text-blue-300">
                <span>Overall Progress</span>
                <span>{Math.round(progressState.overallProgress || 0)}%</span>
              </div>
            </div>
            
            {/* Individual File Progress - only show if multiple files */}
            {fileArray.length > 0 && (
              <div className="space-y-2">
                <div className="text-xs text-blue-200 font-medium">
                  Files ({fileArray.length}):
                </div>
                
                <div className={`space-y-2 ${showAllFiles ? 'max-h-48 overflow-y-auto' : ''}`}>
                  {visibleFiles.map((file, index) => (
                    <div key={index} className="space-y-1">
                      <div className="flex justify-between text-xs text-blue-300">
                        <span className="truncate max-w-[200px]" title={file.fileName}>
                          {file.fileName.split('/').pop() || file.fileName}
                        </span>
                        <span className={file.progress === 100 ? 'text-green-400' : ''}>
                          {file.progress}%
                        </span>
                      </div>
                      <div className="w-full bg-blue-900/30 rounded-full h-1">
                        <div 
                          className={`h-1 rounded-full transition-all duration-300 ease-out ${
                            file.progress === 100 ? 'bg-green-400' : 'bg-blue-300'
                          }`}
                          style={{ 
                            width: `${Math.max(0, Math.min(100, file.progress))}%`,
                            minWidth: file.progress > 0 ? '2px' : '0px'
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                
                {hasMoreFiles && !showAllFiles && (
                  <button
                    onClick={() => setShowAllFiles(true)}
                    className="text-xs text-blue-300 hover:text-blue-200 transition-colors duration-200 underline"
                  >
                    +{fileArray.length - 6} more files... (click to show all)
                  </button>
                )}
                
                {showAllFiles && hasMoreFiles && (
                  <button
                    onClick={() => setShowAllFiles(false)}
                    className="text-xs text-blue-300 hover:text-blue-200 transition-colors duration-200 underline"
                  >
                    Show fewer files
                  </button>
                )}
              </div>
            )}
            
            {(progressState.overallProgress || 0) < 100 && (
              <div className="text-xs text-blue-200 opacity-75">
                Model size: ~50-100MB
              </div>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
};