import React from 'react';
import { ChevronDown } from 'lucide-react';
import { Language } from '../types';
import { LANGUAGES } from '../utils/languages';

interface LanguagePickerProps {
  selectedLanguage: string;
  onLanguageChange: (languageCode: string) => void;
}

export const LanguagePicker: React.FC<LanguagePickerProps> = ({
  selectedLanguage,
  onLanguageChange
}) => {
  const [isOpen, setIsOpen] = React.useState(false);
  const selectedLang = LANGUAGES.find(lang => lang.code === selectedLanguage);

  return (
    <div className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center space-x-2 px-4 py-2 bg-white/10 backdrop-blur-sm rounded-xl text-white hover:bg-white/20 transition-all duration-200 border border-white/20"
      >
        <span className="text-lg">{selectedLang?.flag}</span>
        <span className="font-medium">{selectedLang?.name}</span>
        <ChevronDown className={`w-4 h-4 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <>
          {/* Backdrop to close dropdown */}
          <div 
            className="fixed inset-0 z-[100]" 
            onClick={() => setIsOpen(false)}
          />
          
          {/* Dropdown menu */}
          <div className="absolute top-full left-0 mt-2 w-64 bg-gray-900/95 backdrop-blur-xl rounded-xl border border-white/30 shadow-2xl z-[101] max-h-80 overflow-y-auto">
            {LANGUAGES.map((language) => (
              <button
                key={language.code}
                onClick={() => {
                  onLanguageChange(language.code);
                  setIsOpen(false);
                }}
                className={`w-full flex items-center space-x-3 px-4 py-3 text-left hover:bg-white/20 transition-colors duration-200 first:rounded-t-xl last:rounded-b-xl ${
                  selectedLanguage === language.code ? 'bg-white/25' : ''
                }`}
              >
                <span className="text-lg">{language.flag}</span>
                <span className="text-white font-medium">{language.name}</span>
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
};