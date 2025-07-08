export interface Caption {
  id: string;
  originalText: string;
  translatedText: string;
  timestamp: Date;
  isFinal: boolean;
  isTranslating?: boolean;
}

export interface Language {
  code: string;
  name: string;
  flag: string;
}

export interface AIResponse {
  type: 'summary' | 'expand' | 'outline' | 'custom';
  content: string;
  timestamp: Date;
}