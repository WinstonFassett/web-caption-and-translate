import { pipeline, env } from '@huggingface/transformers';

// Simple, robust environment configuration
env.allowLocalModels = false;
env.allowRemoteModels = true;
env.useBrowserCache = true;
env.useCustomCache = false;
env.backends.onnx.wasm.proxy = false;

// Global state
let translator: any = null;
let isInitializing = false;
let currentModelName: string | null = null;

// Track file progress to avoid duplicates and ensure accuracy
let fileProgressMap = new Map<string, number>();
let totalFiles = 0;

// Simple error handler
const handleError = (error: any, context: string) => {
  console.error(`${context}:`, error);
  
  let message = error?.message || 'Unknown error';
  
  // Simplify error messages
  if (message.includes('fetch') || message.includes('network')) {
    message = 'Network connection failed';
  } else if (message.includes('memory') || message.includes('allocation')) {
    message = 'Insufficient memory';
  } else if (message.includes('WASM') || message.includes('WebAssembly')) {
    message = 'Browser not supported';
  }
  
  return message;
};

// Worker message handler
self.addEventListener('message', async (event) => {
  const { action, text, translationId, modelName } = event.data;

  if (action === 'initialize') {
    // Prevent duplicate initialization
    if (isInitializing && currentModelName === modelName) {
      return;
    }
    
    // Clean up previous model and reset progress tracking
    if (currentModelName && currentModelName !== modelName) {
      translator = null;
      currentModelName = null;
    }
    
    // Reset progress tracking
    fileProgressMap.clear();
    totalFiles = 0;
    
    isInitializing = true;
    currentModelName = modelName;
    
    self.postMessage({ status: 'initiate' });

    try {
      console.log(`Loading model: ${modelName}`);
      
      // Simple, reliable configuration with better progress tracking
      translator = await pipeline('translation', modelName, {
        progress_callback: (progress: any) => {
          const fileName = progress.file || modelName;
          const progressPercent = Math.round(Math.max(0, Math.min(100, progress.progress || 0)));
          
          // Track unique files
          if (!fileProgressMap.has(fileName)) {
            totalFiles++;
          }
          
          // Update file progress (only if it's actually progressing)
          const currentProgress = fileProgressMap.get(fileName) || 0;
          if (progressPercent >= currentProgress) {
            fileProgressMap.set(fileName, progressPercent);
            
            console.log(`File progress: ${fileName} = ${progressPercent}%`);
            
            self.postMessage({
              status: 'progress',
              progress: progressPercent,
              file: fileName,
              totalFiles: totalFiles,
              completedFiles: Array.from(fileProgressMap.values()).filter(p => p === 100).length
            });
          }
        },
        device: 'wasm',
        dtype: 'fp32'
      });
      
      isInitializing = false;
      console.log(`Model ready: ${modelName}`);
      
      // Mark all files as complete
      fileProgressMap.forEach((_, fileName) => {
        fileProgressMap.set(fileName, 100);
      });
      
      self.postMessage({
        status: 'ready',
        modelName: modelName,
        totalFiles: totalFiles
      });

    } catch (error) {
      isInitializing = false;
      currentModelName = null;
      fileProgressMap.clear();
      totalFiles = 0;
      
      const errorMessage = handleError(error, 'Model loading failed');
      self.postMessage({
        status: 'error',
        error: errorMessage
      });
    }
  }

  if (action === 'translate') {
    try {
      if (!translator) {
        throw new Error('Model not ready');
      }

      console.log(`Translating: "${text}"`);
      
      const result = await translator(text, {
        max_length: 256,
        num_beams: 2
      });
      
      self.postMessage({
        status: 'complete',
        translationId: translationId,
        output: Array.isArray(result) ? result : [result]
      });

    } catch (error) {
      const errorMessage = handleError(error, 'Translation failed');
      self.postMessage({
        status: 'error',
        translationId: translationId,
        error: errorMessage
      });
    }
  }
});

// Global error handlers
self.addEventListener('error', (error) => {
  console.error('Worker error:', error);
  self.postMessage({
    status: 'error',
    error: 'Worker crashed'
  });
});

self.addEventListener('unhandledrejection', (event) => {
  console.error('Unhandled rejection:', event.reason);
  event.preventDefault();
  self.postMessage({
    status: 'error',
    error: 'Unexpected error'
  });
});