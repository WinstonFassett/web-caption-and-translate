import React, { useState, useEffect, useRef } from 'react';
import { 
  Mic, 
  MicOff, 
  Trash2, 
  Download, 
  AlertCircle,
  Copy,
  Edit3,
  Check,
  X,
  Volume2,
  Loader2,
  Brain,
  FileText,
  List,
  MessageSquare,
  Sparkles
} from 'lucide-react';
import { Caption, AIResponse } from './types';
import { LanguagePicker } from './components/LanguagePicker';
import { TranslationStatus } from './components/TranslationStatus';
import { AIModal } from './components/AIModal';
import { ProgressToast } from './components/ProgressToast';
import { translateText, preloadTranslator, isTranslationSupported, getTranslationState, getCurrentProgressState, setTranslationUpdateCallback, type ProgressState } from './utils/translator';
import { speakText } from './utils/textToSpeech';
import { generateAIResponse } from './utils/aiService';

function App() {
  const [isListening, setIsListening] = useState(false);
  const [captions, setCaptions] = useState<Caption[]>([]);
  const [currentCaption, setCurrentCaption] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported, setIsSupported] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null);
  const [targetLanguage, setTargetLanguage] = useState('es');
  const [speakingId, setSpeakingId] = useState<string | null>(null);
  const [aiModal, setAiModal] = useState<{
    isOpen: boolean;
    response: AIResponse | null;
    isLoading: boolean;
  }>({
    isOpen: false,
    response: null,
    isLoading: false
  });
  const [customPrompt, setCustomPrompt] = useState('');
  const [showCustomPrompt, setShowCustomPrompt] = useState(false);
  const [translationStatus, setTranslationStatus] = useState(getTranslationState());
  const [progressState, setProgressState] = useState<ProgressState | undefined>(undefined);
  const [showProgressToast, setShowProgressToast] = useState(false);
  const [progressToastComplete, setProgressToastComplete] = useState(false);
  const [lastProgressUpdate, setLastProgressUpdate] = useState<number>(0);
  
  const recognitionRef = useRef<SpeechRecognition | null>(null);
  const captionEndRef = useRef<HTMLDivElement>(null);
  const editInputRef = useRef<HTMLTextAreaElement>(null);

  // Set up translation update callback
  useEffect(() => {
    setTranslationUpdateCallback((captionId: string, translation: string) => {
      setCaptions(prev => prev.map(caption => 
        caption.id === captionId 
          ? { ...caption, translatedText: translation, isTranslating: false }
          : caption
      ));
    });
  }, []);

  // Poll translation state periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const newState = getTranslationState();
      setTranslationStatus(newState);
      
      const newProgressState = getCurrentProgressState();
      
      // Only show progress if actively loading
      if (newState.isInitializing && newProgressState.status !== 'Idle') {
        setProgressState(newProgressState);
        setShowProgressToast(true);
        setProgressToastComplete(false);
        setLastProgressUpdate(Date.now());
      } 
      // Model finished loading successfully
      else if (newState.isReady && !newState.isInitializing && showProgressToast) {
        setProgressState(undefined);
        setProgressToastComplete(true);
        
        // Auto-dismiss after 2 seconds when complete
        setTimeout(() => {
          setShowProgressToast(false);
          setProgressToastComplete(false);
        }, 2000);
      }
      // Model failed or idle - hide progress
      else if (!newState.isInitializing && !newState.isReady) {
        setProgressState(undefined);
        setShowProgressToast(false);
        setProgressToastComplete(false);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [showProgressToast]);

  // Reset translation status when language changes
  useEffect(() => {
    console.log(`Language changed to: ${targetLanguage}`);
    
    // Reset UI state when language changes
    setTranslationStatus({
      isInitializing: false,
      isReady: false,
      error: null
    });
    
    setProgressState(undefined);
    setShowProgressToast(false);
    setProgressToastComplete(false);
  }, [targetLanguage]);

  useEffect(() => {
    // Check browser support
    if (!('webkitSpeechRecognition' in window) && !('SpeechRecognition' in window)) {
      setIsSupported(false);
      setError('Speech recognition not supported in this browser');
      return;
    }

    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition = new SpeechRecognition();
    
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    
    recognition.onstart = () => {
      setIsListening(true);
      setError(null);
    };
    
    recognition.onend = () => {
      setIsListening(false);
    };
    
    recognition.onerror = (event: any) => {
      setError(`Speech recognition error: ${event.error}`);
      setIsListening(false);
    };
    
    recognition.onresult = (event: any) => {
      let interimTranscript = '';
      let finalTranscript = '';
      
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const transcript = event.results[i][0].transcript;
        
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }
      
      if (finalTranscript) {
        const newCaption: Caption = {
          id: Date.now().toString(),
          originalText: finalTranscript,
          translatedText: '',
          timestamp: new Date(),
          isFinal: true,
          isTranslating: true
        };
        
        setCaptions(prev => [...prev, newCaption]);
        setCurrentCaption('');
        
        // Translate the text
        if (isTranslationSupported(targetLanguage)) {
          translateText(finalTranscript, targetLanguage, newCaption.id).then(translated => {
            setCaptions(prev => prev.map(caption => 
              caption.id === newCaption.id 
                ? { ...caption, translatedText: translated, isTranslating: false }
                : caption
            ));
          }).catch(err => {
            console.error('Translation error:', err);
            setCaptions(prev => prev.map(caption => 
              caption.id === newCaption.id 
                ? { ...caption, translatedText: 'Translation failed', isTranslating: false }
                : caption
            ));
          });
        } else {
          setCaptions(prev => prev.map(caption => 
            caption.id === newCaption.id 
              ? { ...caption, translatedText: `[${targetLanguage.toUpperCase()}] ${finalTranscript}`, isTranslating: false }
              : caption
          ));
        }
      } else if (interimTranscript) {
        setCurrentCaption(interimTranscript);
      }
    };
    
    recognitionRef.current = recognition;
    
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
    };
  }, [targetLanguage]);

  useEffect(() => {
    // Auto-scroll to bottom when new captions are added
    if (captionEndRef.current) {
      captionEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [captions, currentCaption]);

  useEffect(() => {
    // Focus edit input when editing starts
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  const startListening = () => {
    if (recognitionRef.current && !isListening) {
      try {
        recognitionRef.current.start();
      } catch (error) {
        setError('Failed to start speech recognition');
      }
    }
  };

  const stopListening = () => {
    if (recognitionRef.current && isListening) {
      recognitionRef.current.stop();
    }
  };

  const clearCaptions = () => {
    setCaptions([]);
    setCurrentCaption('');
    setEditingId(null);
  };

  const exportCaptions = () => {
    const text = captions.map(caption => 
      `[${caption.timestamp.toLocaleTimeString()}]\nOriginal: ${caption.originalText}\nTranslated: ${caption.translatedText}\n`
    ).join('\n');
    
    const blob = new Blob([text], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `captions-${new Date().toISOString().split('T')[0]}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const copyToClipboard = async (text: string, type: 'full' | 'item' = 'item') => {
    try {
      await navigator.clipboard.writeText(text);
      setCopyFeedback(type === 'full' ? 'Full transcript copied!' : 'Text copied!');
      setTimeout(() => setCopyFeedback(null), 2000);
    } catch (err) {
      setError('Failed to copy to clipboard');
    }
  };

  const copyFullTranscript = () => {
    const fullText = captions.map(caption => 
      `Original: ${caption.originalText}\nTranslated: ${caption.translatedText}`
    ).join('\n\n');
    copyToClipboard(fullText, 'full');
  };

  const deleteCaption = (id: string) => {
    setCaptions(prev => prev.filter(caption => caption.id !== id));
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const startEditing = (caption: Caption) => {
    setEditingId(caption.id);
    setEditText(caption.originalText);
  };

  const saveEdit = async () => {
    if (editingId && editText.trim()) {
      // Update the original text
      setCaptions(prev => prev.map(caption => 
        caption.id === editingId 
          ? { ...caption, originalText: editText.trim(), isTranslating: true }
          : caption
      ));

      // Re-translate the edited text
      try {
        if (isTranslationSupported(targetLanguage)) {
          const translated = await translateText(editText.trim(), targetLanguage, editingId);
          setCaptions(prev => prev.map(caption => 
            caption.id === editingId 
              ? { ...caption, translatedText: translated, isTranslating: false }
              : caption
          ));
        } else {
          setCaptions(prev => prev.map(caption => 
            caption.id === editingId 
              ? { ...caption, translatedText: `[${targetLanguage.toUpperCase()}] ${editText.trim()}`, isTranslating: false }
              : caption
          ));
        }
      } catch (err) {
        console.error('Translation error:', err);
        setCaptions(prev => prev.map(caption => 
          caption.id === editingId 
            ? { ...caption, translatedText: 'Translation failed', isTranslating: false }
            : caption
        ));
      }
    }
    setEditingId(null);
    setEditText('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditText('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    } else if (e.key === 'Escape') {
      cancelEdit();
    }
  };

  const speakTranslation = async (text: string, captionId: string) => {
    if (speakingId) return; // Prevent multiple simultaneous speech
    
    setSpeakingId(captionId);
    try {
      await speakText(text, targetLanguage);
    } catch (err) {
      console.error('Text-to-speech error:', err);
      setError('Text-to-speech failed');
    } finally {
      setSpeakingId(null);
    }
  };

  const handleAIAction = async (type: 'summary' | 'expand' | 'outline' | 'custom') => {
    if (captions.length === 0) {
      setError('No captions available for AI analysis');
      return;
    }

    setAiModal({ isOpen: true, response: null, isLoading: true });
    
    try {
      const response = await generateAIResponse(captions, type, customPrompt);
      setAiModal({ isOpen: true, response, isLoading: false });
      setCustomPrompt('');
      setShowCustomPrompt(false);
    } catch (err) {
      console.error('AI service error:', err);
      setError('AI analysis failed');
      setAiModal({ isOpen: false, response: null, isLoading: false });
    }
  };

  // Simplified preload handler
  const handlePreloadTranslatorSimple = async () => {
    try {
      await preloadTranslator(targetLanguage, (progressState) => {
        setTranslationStatus({
          isInitializing: true,
          isReady: false,
          error: null,
          progress: progressState.progress,
          status: progressState.status,
          modelName: progressState.modelName
        });
      });
      setTranslationStatus({
        isInitializing: false,
        isReady: true,
        error: null,
        progress: 100,
        status: 'Ready!',
        modelName: undefined
      });
    } catch (error) {
      console.error('Failed to preload translator:', error);
    }
  };

  const handlePreloadTranslator = async () => {
    try {
      console.log(`Starting manual preload for ${targetLanguage}`);
      setShowProgressToast(true);
      setProgressToastComplete(false);
      setLastProgressUpdate(Date.now());
      
      await preloadTranslator(targetLanguage, (progress) => {
        setProgressState(progress);
        setLastProgressUpdate(Date.now());
      });
      
      console.log(`Manual preload completed for ${targetLanguage}`);
      
      // Mark as complete and auto-dismiss
      setProgressToastComplete(true);
      setTimeout(() => {
        setShowProgressToast(false);
        setProgressToastComplete(false);
      }, 2000);
      
    } catch (error) {
      console.error('Failed to preload translator:', error);
      // Hide progress on error
      setShowProgressToast(false);
      setProgressToastComplete(false);
    }
  };

  if (!isSupported) {
    return (
      <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 flex items-center justify-center p-4">
        <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 max-w-md text-center">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Browser Not Supported</h2>
          <p className="text-white/80">
            This browser doesn't support speech recognition. Please use Chrome, Edge, or Safari.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gradient-to-br from-purple-900 via-blue-900 to-indigo-900 relative overflow-hidden">
      {/* Copy feedback */}
      {copyFeedback && (
        <div className="fixed top-4 right-4 z-50 bg-green-500/90 backdrop-blur-sm text-white px-4 py-2 rounded-lg shadow-lg animate-fade-in-up">
          {copyFeedback}
        </div>
      )}

      {/* Header */}
      <header className="relative p-4 bg-white/5 backdrop-blur-lg border-b border-white/10" style={{ zIndex: 50 }}>
        <div className="max-w-7xl mx-auto">
          {/* Top row - Title and Language Picker */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl flex items-center justify-center">
                <Mic className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">Live Captioner & Translator</h1>
                <p className="text-white/60 text-xs">Real-time speech recognition with translation</p>
              </div>
            </div>
            
            <div className="flex items-center space-x-4">
              <span className="text-white/60 text-sm">Translate to:</span>
              <LanguagePicker 
                selectedLanguage={targetLanguage}
                onLanguageChange={setTargetLanguage}
              />
              <TranslationStatus
                isInitializing={translationStatus.isInitializing}
                isReady={translationStatus.isReady}
                error={translationStatus.error}
                targetLanguage={targetLanguage}
                onPreload={handlePreloadTranslator}
              />
            </div>
          </div>

          {/* Bottom row - AI Actions */}
          <div className="flex items-center justify-end">
            <div className="flex items-center space-x-3">
              <button
                onClick={copyFullTranscript}
                className="p-2 rounded-xl bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-all duration-200"
                title="Copy full transcript"
                disabled={captions.length === 0}
              >
                <Copy className="w-4 h-4" />
              </button>
              
              <button
                onClick={exportCaptions}
                className="p-2 rounded-xl bg-white/10 text-white hover:bg-white/20 transition-all duration-200"
                title="Export captions"
                disabled={captions.length === 0}
              >
                <Download className="w-4 h-4" />
              </button>
              
              <button
                onClick={clearCaptions}
                className="p-2 rounded-xl bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-all duration-200"
                title="Clear all captions"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main content area */}
      <div className="relative h-[calc(100vh-140px)] max-w-7xl mx-auto p-4 flex flex-col overflow-hidden" style={{ zIndex: 10 }}>
        {/* Caption display */}
        <div className="flex-1 bg-white/5 backdrop-blur-lg rounded-2xl p-6 mb-4 overflow-y-auto overflow-x-hidden" style={{ zIndex: 20 }}>
          {error && (
            <div className="mb-6 p-4 bg-red-500/20 border border-red-500/30 rounded-xl text-red-300 flex items-center space-x-2">
              <AlertCircle className="w-5 h-5" />
              <span>{error}</span>
            </div>
          )}
          
          {captions.length === 0 && !currentCaption && (
            <div className="text-center py-12 text-white/40">
              <Mic className="w-20 h-20 mx-auto mb-6" />
              <p className="text-2xl font-light">Start speaking to see live captions and translations</p>
            </div>
          )}
          
          <div className="space-y-8">
            {captions.map((caption, index) => (
              <div
                key={caption.id}
                className="group animate-fade-in-up hover:bg-white/5 rounded-xl p-4 transition-all duration-200"
                style={{ animationDelay: `${index * 0.05}s` }}
              >
                <div className="flex items-start justify-between mb-4">
                  <span className="text-sm text-white/40 font-mono">
                    {caption.timestamp.toLocaleTimeString()}
                  </span>
                  
                  {/* Action buttons */}
                  <div className="flex items-center space-x-2 opacity-0 group-hover:opacity-100 transition-opacity duration-200">
                    <button
                      onClick={() => copyToClipboard(caption.originalText)}
                      className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all duration-200"
                      title="Copy original text"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                      onClick={() => startEditing(caption)}
                      className="p-1.5 rounded-lg bg-white/10 text-white/60 hover:text-white hover:bg-white/20 transition-all duration-200"
                      title="Edit text"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                    </button>
                    
                    <button
                      onClick={() => deleteCaption(caption.id)}
                      className="p-1.5 rounded-lg bg-red-500/20 text-red-400 hover:text-red-300 hover:bg-red-500/30 transition-all duration-200"
                      title="Delete"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
                
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  {/* Original text */}
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide">Original</h3>
                    {editingId === caption.id ? (
                      <div className="space-y-3">
                        <textarea
                          ref={editInputRef}
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={handleKeyDown}
                          className="w-full bg-white/10 border border-white/20 rounded-lg p-3 text-white text-lg font-light leading-relaxed resize-none focus:outline-none focus:border-blue-400 transition-colors duration-200"
                          rows={Math.max(2, Math.ceil(editText.length / 50))}
                        />
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={saveEdit}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-green-500/20 text-green-400 hover:bg-green-500/30 rounded-lg transition-all duration-200"
                          >
                            <Check className="w-4 h-4" />
                            <span className="text-sm">Save</span>
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="flex items-center space-x-1 px-3 py-1.5 bg-gray-500/20 text-gray-400 hover:bg-gray-500/30 rounded-lg transition-all duration-200"
                          >
                            <X className="w-4 h-4" />
                            <span className="text-sm">Cancel</span>
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-white text-lg font-light leading-relaxed cursor-pointer"
                         onClick={() => startEditing(caption)}>
                        {caption.originalText}
                      </p>
                    )}
                  </div>

                  {/* Translated text */}
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide">Translation</h3>
                      {caption.translatedText && !caption.isTranslating && (
                        <button
                          onClick={() => speakTranslation(caption.translatedText, caption.id)}
                          className={`p-1.5 rounded-lg transition-all duration-200 ${
                            speakingId === caption.id
                              ? 'bg-blue-500/30 text-blue-300'
                              : 'bg-white/10 text-white/60 hover:text-white hover:bg-white/20'
                          }`}
                          title="Speak translation"
                          disabled={speakingId !== null}
                        >
                          <Volume2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                    
                    <div className="min-h-[2rem] flex items-start">
                      {caption.isTranslating ? (
                        <div className="flex items-center space-x-2 text-white/60">
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span className="text-sm">Translating...</span>
                        </div>
                      ) : (
                        <p className="text-white/90 text-lg font-light leading-relaxed transition-opacity duration-300">
                          {caption.translatedText || 'Translation not available'}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
            
            {currentCaption && (
              <div className="p-4">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="text-sm text-white/40 font-mono">
                        {new Date().toLocaleTimeString()}
                      </span>
                      <span className="text-sm font-medium text-white/60 uppercase tracking-wide">Live</span>
                    </div>
                    <p className="text-white/90 text-lg font-light leading-relaxed">
                      {currentCaption}
                      <span className="inline-block w-1 h-6 bg-blue-400 ml-2 opacity-75"></span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h3 className="text-sm font-medium text-white/60 uppercase tracking-wide">Translation</h3>
                    <p className="text-white/60 text-lg font-light leading-relaxed italic">
                      Waiting for final text...
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          
          <div ref={captionEndRef} />
        </div>

        {/* Recording controls - fixed at bottom */}
        <div className="flex-shrink-0 flex items-center justify-center space-x-6 pb-4">
          <button
            onClick={isListening ? stopListening : startListening}
            className={`relative p-6 rounded-full transition-all duration-300 transform hover:scale-105 ${
              isListening
                ? 'bg-red-500 hover:bg-red-600 shadow-lg shadow-red-500/50'
                : 'bg-blue-500 hover:bg-blue-600 shadow-lg shadow-blue-500/50'
            }`}
          >
            {isListening ? (
              <MicOff className="w-8 h-8 text-white" />
            ) : (
              <Mic className="w-8 h-8 text-white" />
            )}
          </button>
          
          <div className="text-center">
            <p className="text-white/60 text-lg font-medium">
              {isListening ? 'Recording...' : 'Click to start'}
            </p>
            {isListening && (
              <div className="flex items-center justify-center space-x-1 mt-3 h-8">
                <div className="w-1.5 h-6 bg-red-400 rounded-full opacity-60 animate-pulse"></div>
                <div className="w-1.5 h-8 bg-red-400 rounded-full opacity-80 animate-pulse" style={{ animationDelay: '0.1s' }}></div>
                <div className="w-1.5 h-4 bg-red-400 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '0.2s' }}></div>
                <div className="w-1.5 h-7 bg-red-400 rounded-full opacity-70 animate-pulse" style={{ animationDelay: '0.3s' }}></div>
                <div className="w-1.5 h-5 bg-red-400 rounded-full opacity-60 animate-pulse" style={{ animationDelay: '0.4s' }}></div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* AI Modal */}
      <AIModal
        isOpen={aiModal.isOpen}
        onClose={() => setAiModal({ isOpen: false, response: null, isLoading: false })}
        response={aiModal.response}
        isLoading={aiModal.isLoading}
      />

      {/* Progress Toast */}
      <ProgressToast
        isVisible={showProgressToast}
        progressState={progressState}
        isComplete={progressToastComplete}
        error={translationStatus.error}
        onDismiss={() => {
          setShowProgressToast(false);
          setProgressToastComplete(false);
        }}
      />
    </div>
  );
}

export default App;