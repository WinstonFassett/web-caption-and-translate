// Simplified model mapping - focus on models that actually work
const OPUS_MT_MODELS: Record<string, string> = {
  'es': 'Xenova/opus-mt-en-es',
  'fr': 'Xenova/opus-mt-en-fr', 
  'de': 'Xenova/opus-mt-en-de',
  'it': 'Xenova/opus-mt-en-it',
  'pt': 'Xenova/opus-mt-en-pt',
  'ru': 'Xenova/opus-mt-en-ru',
  'zh': 'Xenova/opus-mt-en-zh',
  'ar': 'Xenova/opus-mt-en-ar',
  'nl': 'Xenova/opus-mt-en-nl',
  'pl': 'Xenova/opus-mt-en-pl',
  'tr': 'Xenova/opus-mt-en-tr',
  'ja': 'Xenova/opus-mt-en-jap',
  'ko': 'Xenova/opus-mt-en-ko',
  'hi': 'Xenova/opus-mt-en-hi',
  'th': 'Xenova/opus-mt-en-th',
  'vi': 'Xenova/opus-mt-en-vi',
};

// Safe environment detection
const isBrowser = () => {
  try {
    return typeof window !== 'undefined';
  } catch {
    return false;
  }
};

// Translation state
interface TranslationState {
  worker: Worker | null;
  isReady: boolean;
  isInitializing: boolean;
  currentModel: string | null;
  currentLanguage: string | null;
  error: string | null;
}

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

// Global state
let translationState: TranslationState = {
  worker: null,
  isReady: false,
  isInitializing: false,
  currentModel: null,
  currentLanguage: null,
  error: null
};

let progressCallbacks: Map<string, (progress: ProgressState) => void> = new Map();
let progressId = 0;
let currentProgressState: ProgressState = {
  files: new Map(),
  overallProgress: 0,
  status: 'Idle',
  modelName: ''
};

// Track initialization promises to prevent duplicates
let initializationPromises: Map<string, Promise<void>> = new Map();

let translationQueue: Array<{
  text: string;
  targetLanguage: string;
  captionId: string;
  timestamp: number;
}> = [];

let translationUpdateCallback: ((captionId: string, translation: string) => void) | null = null;

// Set callback for translation updates
export const setTranslationUpdateCallback = (callback: (captionId: string, translation: string) => void) => {
  translationUpdateCallback = callback;
};

// Queue translation for later processing
export const queueTranslation = (text: string, targetLanguage: string, captionId: string) => {
  const existing = translationQueue.find(
    item => item.text === text && item.targetLanguage === targetLanguage && item.captionId === captionId
  );
  
  if (!existing) {
    console.log(`Queueing translation: "${text}" for ${targetLanguage}`);
    translationQueue.push({
      text,
      targetLanguage,
      captionId,
      timestamp: Date.now()
    });
  }
};

// Process queued translations
const processTranslationQueue = async () => {
  if (!translationState.isReady || translationQueue.length === 0) return;

  const currentLanguageQueue = translationQueue.filter(
    item => item.targetLanguage === translationState.currentLanguage
  );

  translationQueue = translationQueue.filter(
    item => item.targetLanguage !== translationState.currentLanguage
  );

  console.log(`Processing ${currentLanguageQueue.length} queued translations for ${translationState.currentLanguage}`);

  for (const queuedItem of currentLanguageQueue) {
    try {
      const result = await performActualTranslation(queuedItem.text, queuedItem.targetLanguage);
      
      if (translationUpdateCallback) {
        setTimeout(() => {
          translationUpdateCallback!(queuedItem.captionId, result);
        }, 100);
      }
    } catch (error) {
      console.error('Failed to process queued translation:', error);
    }
  }
};

// Reset translation state completely
const resetTranslationState = () => {
  console.log('Resetting translation state');
  
  // Terminate existing worker
  if (translationState.worker) {
    translationState.worker.terminate();
    translationState.worker = null;
  }

  // Reset state
  translationState.isReady = false;
  translationState.isInitializing = false;
  translationState.currentModel = null;
  translationState.currentLanguage = null;
  translationState.error = null;

  // Reset progress
  currentProgressState = {
    files: new Map(),
    overallProgress: 0,
    status: 'Idle',
    modelName: ''
  };

  // Clear any pending initialization promises
  initializationPromises.clear();
  
  broadcastProgress();
};

// Handle worker messages and update progress
const handleWorkerMessage = (
  data: any, 
  expectedModel: string, 
  expectedLanguage: string,
  resolve: () => void,
  reject: (error: Error) => void
) => {
  // Only process messages for the current model/language
  if (translationState.currentLanguage !== expectedLanguage) {
    return;
  }

  if (data.status === 'initiate') {
    currentProgressState.status = `Starting ${getModelDisplayName(expectedModel)}`;
    currentProgressState.overallProgress = 0;
    currentProgressState.files.clear(); // Clear previous files
    broadcastProgress();
  } 
  else if (data.status === 'progress') {
    const fileName = data.file || 'model';
    const progress = Math.max(0, Math.min(100, data.progress || 0));
    const totalFiles = data.totalFiles || 1;
    const completedFiles = data.completedFiles || 0;
    
    // Update individual file progress
    currentProgressState.files.set(fileName, {
      fileName,
      progress: Math.round(progress),
      status: `Loading ${fileName}`
    });

    // Calculate overall progress more accurately
    const fileProgresses = Array.from(currentProgressState.files.values());
    
    if (fileProgresses.length > 0 && totalFiles > 0) {
      // Use a weighted approach: completed files count as 100%, current file uses its actual progress
      const totalProgress = fileProgresses.reduce((sum, file) => sum + file.progress, 0);
      const averageProgress = totalProgress / fileProgresses.length;
      
      // Ensure progress never goes backwards
      const newProgress = Math.round(Math.max(currentProgressState.overallProgress, averageProgress));
      currentProgressState.overallProgress = newProgress;
    } else {
      currentProgressState.overallProgress = Math.round(progress);
    }
    
    currentProgressState.status = `Loading ${getModelDisplayName(expectedModel)} (${fileProgresses.length}/${totalFiles} files)`;
    broadcastProgress();
  } 
  else if (data.status === 'ready') {
    // Mark all files as complete
    currentProgressState.files.forEach((file, fileName) => {
      currentProgressState.files.set(fileName, {
        ...file,
        progress: 100,
        status: `Loaded ${fileName}`
      });
    });
    
    console.log(`Model ready for ${expectedLanguage}`);
    
    translationState.isReady = true;
    translationState.isInitializing = false;
    translationState.error = null;
    
    currentProgressState.overallProgress = 100;
    currentProgressState.status = 'Ready!';
    broadcastProgress();
    
    // Process queued translations
    setTimeout(() => processTranslationQueue(), 100);
    
    resolve();
  } 
  else if (data.status === 'error') {
    console.error(`Model initialization failed for ${expectedLanguage}:`, data.error);
    
    translationState.isInitializing = false;
    translationState.isReady = false;
    translationState.error = data.error || 'Unknown error';
    
    currentProgressState.status = 'Error loading model';
    currentProgressState.overallProgress = 0;
    broadcastProgress();
    
    reject(new Error(data.error || 'Unknown error'));
  }
};

// Initialize worker for language
const initializeWorkerForLanguage = async (targetLanguage: string): Promise<void> => {
  const modelName = OPUS_MT_MODELS[targetLanguage];
  
  if (!modelName) {
    throw new Error(`Translation not supported for language: ${targetLanguage}`);
  }

  console.log(`initializeWorkerForLanguage called for ${targetLanguage} (model: ${modelName})`);
  console.log(`Current state: ready=${translationState.isReady}, lang=${translationState.currentLanguage}, model=${translationState.currentModel}`);

  // Check if we already have the exact model ready
  if (translationState.isReady && 
      translationState.currentLanguage === targetLanguage && 
      translationState.currentModel === modelName &&
      translationState.worker) {
    console.log(`Model already ready for ${targetLanguage}`);
    return;
  }

  // Check if we're already initializing this exact language
  if (initializationPromises.has(targetLanguage)) {
    console.log(`Already initializing ${targetLanguage}, waiting...`);
    return initializationPromises.get(targetLanguage);
  }

  // Create initialization promise
  const initPromise = new Promise<void>(async (resolve, reject) => {
    try {
      console.log(`Starting initialization for ${targetLanguage}`);

      // Reset state completely when switching languages
      resetTranslationState();

      // Set new state
      translationState.isInitializing = true;
      translationState.currentLanguage = targetLanguage;
      translationState.currentModel = modelName;
      translationState.error = null;

      // Reset and set progress
      currentProgressState = {
        files: new Map(),
        overallProgress: 0,
        status: `Initializing ${getModelDisplayName(modelName)}`,
        modelName: getModelDisplayName(modelName)
      };
      broadcastProgress();

      // Create worker
      if (!isBrowser()) {
        throw new Error('Browser environment required');
      }

      translationState.worker = new Worker(
        new URL('../workers/translation.worker.ts', import.meta.url),
        { type: 'module' }
      );

      // Handle worker messages
      const handleMessage = (event: MessageEvent) => {
        const data = event.data;
        
        // Only process messages for the current language being initialized
        if (translationState.currentLanguage !== targetLanguage) {
          console.log(`Ignoring message for ${targetLanguage}, current language is ${translationState.currentLanguage}`);
          return;
        }
        
        handleWorkerMessage(data, modelName, targetLanguage, resolve, reject);
      };

      const handleError = (error: ErrorEvent) => {
        console.error(`Worker error for ${targetLanguage}:`, error);
        translationState.isInitializing = false;
        translationState.error = `Worker error: ${error.message}`;
        broadcastProgress();
        reject(error);
      };

      translationState.worker.addEventListener('message', handleMessage);
      translationState.worker.addEventListener('error', handleError);

      // Initialize the worker
      translationState.worker.postMessage({ 
        action: 'initialize', 
        modelName: modelName,
        targetLanguage: targetLanguage
      });

    } catch (error) {
      console.error(`Failed to create worker for ${targetLanguage}:`, error);
      translationState.isInitializing = false;
      translationState.error = `Failed to create worker: ${error}`;
      broadcastProgress();
      reject(error);
    }
  });

  // Store the promise
  initializationPromises.set(targetLanguage, initPromise);

  try {
    await initPromise;
  } finally {
    // Clean up the promise
    initializationPromises.delete(targetLanguage);
  }
};

// Broadcast progress to listeners
const broadcastProgress = () => {
  progressCallbacks.forEach(callback => {
    callback({ ...currentProgressState });
  });
};

// Get display name for model
const getModelDisplayName = (modelName: string): string => {
  if (modelName.includes('opus-mt-en-')) {
    const lang = modelName.split('-').pop();
    const langNames: Record<string, string> = {
      'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
      'pt': 'Portuguese', 'ru': 'Russian', 'zh': 'Chinese', 'ar': 'Arabic',
      'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish', 'jap': 'Japanese',
      'ko': 'Korean', 'hi': 'Hindi', 'th': 'Thai', 'vi': 'Vietnamese'
    };
    return `English→${langNames[lang || ''] || lang?.toUpperCase()} Model`;
  }
  return 'Translation Model';
};

// Perform actual translation
const performActualTranslation = async (text: string, targetLanguage: string): Promise<string> => {
  if (!translationState.worker || !translationState.isReady || translationState.currentLanguage !== targetLanguage) {
    throw new Error('Translation model not ready');
  }

  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Translation timeout'));
    }, 15000);

    const handleMessage = (event: MessageEvent) => {
      const data = event.data;
      
      if (data.status === 'complete' && data.translationId === text) {
        clearTimeout(timeout);
        translationState.worker?.removeEventListener('message', handleMessage);
        
        if (Array.isArray(data.output) && data.output.length > 0 && data.output[0].translation_text) {
          resolve(data.output[0].translation_text);
        } else if (data.output && typeof data.output === 'object' && 'translation_text' in data.output) {
          resolve(data.output.translation_text);
        } else {
          reject(new Error('Invalid translation output'));
        }
      } else if (data.status === 'error' && data.translationId === text) {
        clearTimeout(timeout);
        translationState.worker?.removeEventListener('message', handleMessage);
        reject(new Error(data.error || 'Translation failed'));
      }
    };

    translationState.worker.addEventListener('message', handleMessage);
    
    translationState.worker.postMessage({
      action: 'translate',
      text,
      translationId: text,
      targetLanguage
    });
  });
};

// Enhanced mock translation
const enhanceMockTranslation = (text: string, targetLanguage: string): string => {
  const mockTranslations: Record<string, Record<string, string>> = {
    'hello': {
      'es': 'hola', 'fr': 'bonjour', 'de': 'hallo', 'it': 'ciao',
      'pt': 'olá', 'ru': 'привет', 'ja': 'こんにちは', 'ko': '안녕하세요',
      'zh': '你好', 'ar': 'مرحبا', 'hi': 'नमस्ते'
    },
    'thank you': {
      'es': 'gracias', 'fr': 'merci', 'de': 'danke', 'it': 'grazie',
      'pt': 'obrigado', 'ru': 'спасибо', 'ja': 'ありがとう', 'ko': '감사합니다',
      'zh': '谢谢', 'ar': 'شكرا', 'hi': 'धन्यवाद'
    },
    'good morning': {
      'es': 'buenos días', 'fr': 'bonjour', 'de': 'guten Morgen', 'it': 'buongiorno',
      'pt': 'bom dia', 'ru': 'доброе утро', 'ja': 'おはようございます', 'ko': '좋은 아침',
      'zh': '早上好', 'ar': 'صباح الخير', 'hi': 'सुप्रभात'
    }
  };

  const lowerText = text.toLowerCase().trim();
  const exactMatch = mockTranslations[lowerText]?.[targetLanguage];
  
  if (exactMatch) {
    return exactMatch;
  }

  // Simple word substitution
  const wordMap: Record<string, Record<string, string>> = {
    'i': { 'es': 'yo', 'fr': 'je', 'de': 'ich', 'it': 'io', 'pt': 'eu' },
    'you': { 'es': 'tú', 'fr': 'vous', 'de': 'du', 'it': 'tu', 'pt': 'você' },
    'love': { 'es': 'amor', 'fr': 'amour', 'de': 'liebe', 'it': 'amore', 'pt': 'amor' }
  };

  let result = text.toLowerCase();
  let hasTranslations = false;
  
  for (const [english, translations] of Object.entries(wordMap)) {
    if (translations[targetLanguage]) {
      const regex = new RegExp(`\\b${english}\\b`, 'gi');
      if (regex.test(result)) {
        result = result.replace(regex, translations[targetLanguage]);
        hasTranslations = true;
      }
    }
  }

  if (!hasTranslations) {
    const languageNames: Record<string, string> = {
      'es': 'Spanish', 'fr': 'French', 'de': 'German', 'it': 'Italian',
      'pt': 'Portuguese', 'ru': 'Russian', 'ja': 'Japanese', 'ko': 'Korean',
      'zh': 'Chinese', 'ar': 'Arabic', 'hi': 'Hindi', 'th': 'Thai',
      'vi': 'Vietnamese', 'nl': 'Dutch', 'pl': 'Polish', 'tr': 'Turkish'
    };
    
    return `[${languageNames[targetLanguage] || targetLanguage.toUpperCase()}] ${text}`;
  }

  return result.charAt(0).toUpperCase() + result.slice(1);
};

// Main translation function
export const translateText = async (text: string, targetLanguage: string, captionId?: string): Promise<string> => {
  try {
    if (!isBrowser()) {
      return enhanceMockTranslation(text, targetLanguage);
    }

    console.log(`translateText: "${text}" -> ${targetLanguage}`);
    console.log(`Current state: ready=${translationState.isReady}, lang=${translationState.currentLanguage}, initializing=${translationState.isInitializing}`);

    // Check if model is ready and matches target language
    if (translationState.isReady && 
        translationState.currentLanguage === targetLanguage && 
        translationState.worker) {
      
      try {
        console.log(`Using AI translation for ${targetLanguage}`);
        return await performActualTranslation(text, targetLanguage);
      } catch (modelError) {
        console.error('AI translation failed:', modelError);
        // Fall through to mock translation
      }
    }

    // Check if we need to start loading a model
    const needsModel = !translationState.isReady || 
                      translationState.currentLanguage !== targetLanguage;

    if (needsModel && !translationState.isInitializing) {
      console.log(`Starting background model loading for ${targetLanguage}`);
      initializeWorkerForLanguage(targetLanguage).catch(error => {
        console.error('Failed to initialize translator:', error);
      });
    }

    // Return mock translation and queue for later if model is loading
    const mockResult = enhanceMockTranslation(text, targetLanguage);
    
    if (translationState.isInitializing && 
        translationState.currentLanguage === targetLanguage && 
        captionId) {
      queueTranslation(text, targetLanguage, captionId);
    }
    
    return mockResult;

  } catch (error) {
    console.error('Translation error:', error);
    return enhanceMockTranslation(text, targetLanguage);
  }
};

// Manual preload function
export const preloadTranslator = async (
  targetLanguage: string,
  onProgress?: (progress: ProgressState) => void
): Promise<void> => {
  const id = (++progressId).toString();
  
  if (onProgress) {
    progressCallbacks.set(id, onProgress);
  }
  
  try {
    console.log(`Manual preload requested for ${targetLanguage}`);
    await initializeWorkerForLanguage(targetLanguage);
    console.log(`Manual preload completed for ${targetLanguage}`);
  } finally {
    if (onProgress) {
      progressCallbacks.delete(id);
    }
  }
};

// Check if translation is supported
export const isTranslationSupported = (languageCode: string): boolean => {
  return languageCode in OPUS_MT_MODELS;
};

// Get current translation state
export const getTranslationState = () => {
  return {
    isReady: translationState.isReady,
    isInitializing: translationState.isInitializing,
    currentLanguage: translationState.currentLanguage,
    currentModel: translationState.currentModel,
    error: translationState.error
  };
};

// Export progress state
export const getCurrentProgressState = () => currentProgressState;

// Export types
export type { ProgressState, FileProgress };