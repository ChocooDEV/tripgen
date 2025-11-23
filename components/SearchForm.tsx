'use client';

import { useState, useEffect, useRef } from 'react';

interface SearchFormProps {
  onSubmit: (data: {
    destination: string;
    startDate?: string;
    endDate?: string;
    duration?: number;
    interests: string[];
  }) => void;
  isLoading?: boolean;
}

const INTEREST_OPTIONS = [
  { id: 'food', label: 'Food & Dining' },
  { id: 'museums', label: 'Museums' },
  { id: 'nature', label: 'Nature & Outdoors' },
  { id: 'history', label: 'History & Culture' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'kids', label: 'Family Friendly' },
];

export default function SearchForm({ onSubmit, isLoading }: SearchFormProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [duration, setDuration] = useState(3);
  const [interests, setInterests] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ 
    description: string; 
    place_id: string;
    structured_formatting?: {
      main_text?: string;
      secondary_text?: string;
    };
  }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Fetch autocomplete suggestions
  useEffect(() => {
    if (destination.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const timeoutId = setTimeout(async () => {
      try {
        const response = await fetch(`/api/places/autocomplete?input=${encodeURIComponent(destination)}`);
        const data = await response.json();
        if (data.predictions) {
          setSuggestions(data.predictions);
          setShowSuggestions(true);
        }
      } catch (error) {
        console.error('Autocomplete error:', error);
      }
    }, 300); // Debounce 300ms

    return () => clearTimeout(timeoutId);
  }, [destination]);

  // Handle click outside to close suggestions
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(event.target as Node) &&
        inputRef.current &&
        !inputRef.current.contains(event.target as Node)
      ) {
        setShowSuggestions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleInterestToggle = (interestId: string) => {
    setInterests(prev =>
      prev.includes(interestId)
        ? prev.filter(id => id !== interestId)
        : [...prev, interestId]
    );
  };

  const handleSuggestionSelect = (suggestion: { description: string; place_id: string }) => {
    setDestination(suggestion.description);
    setShowSuggestions(false);
    setSelectedIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
    } else if (e.key === 'Enter' && selectedIndex >= 0) {
      e.preventDefault();
      handleSuggestionSelect(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destination.trim() || interests.length === 0) {
      alert('Please enter a destination and select at least one interest');
      return;
    }
    onSubmit({
      destination: destination.trim(),
      startDate: startDate || undefined,
      endDate: endDate || undefined,
      duration: startDate && endDate ? undefined : duration,
      interests,
    });
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 max-w-md mx-auto">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-xl font-bold text-gray-900">TripGen</h2>
        <button className="p-2 hover:bg-gray-100 rounded-lg">
          <svg className="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
          </svg>
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">Plan your trip</h3>

        <div className="relative">
          <label htmlFor="destination" className="block text-sm font-medium text-gray-700 mb-2">
            Destination
          </label>
          <div className="relative">
            <input
              ref={inputRef}
              type="text"
              id="destination"
              value={destination}
              onChange={(e) => {
                setDestination(e.target.value);
                setSelectedIndex(-1);
              }}
              onFocus={() => destination.length >= 2 && setShowSuggestions(true)}
              onKeyDown={handleKeyDown}
              placeholder="Amsterdam"
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 text-gray-900 bg-white"
              required
            />
            <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
          
          {showSuggestions && suggestions.length > 0 && (
            <div
              ref={suggestionsRef}
              className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-60 overflow-y-auto"
            >
              {suggestions.map((suggestion, index) => (
                <button
                  key={suggestion.place_id}
                  type="button"
                  onClick={() => handleSuggestionSelect(suggestion)}
                  className={`w-full text-left px-4 py-3 hover:bg-gray-100 focus:bg-gray-100 focus:outline-none ${
                    index === selectedIndex ? 'bg-gray-100' : ''
                  }`}
                >
                  <div className="text-gray-900 font-medium">
                    {suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0]}
                  </div>
                  {suggestion.structured_formatting?.secondary_text && (
                    <div className="text-sm text-gray-500">
                      {suggestion.structured_formatting.secondary_text}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        {!startDate && !endDate && (
          <div>
            <label htmlFor="duration" className="block text-sm font-medium text-gray-700 mb-2">
              Duration
            </label>
            <div className="relative">
              <input
                type="text"
                id="duration"
                value={`${duration} days`}
                readOnly
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent pr-10 cursor-pointer text-gray-900 bg-white"
                onClick={() => {
                  const newDuration = prompt('Enter duration (1-14 days):', duration.toString());
                  if (newDuration) {
                    const num = parseInt(newDuration);
                    if (num >= 1 && num <= 14) setDuration(num);
                  }
                }}
              />
              <svg className="absolute right-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
              </svg>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Date range
          </label>
          <div className="grid grid-cols-2 gap-2">
            <div className="relative">
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="Start date"
              />
            </div>
            <div className="relative">
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                min={startDate}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-gray-900 bg-white"
                placeholder="End date"
              />
            </div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Interests
          </label>
          <div className="grid grid-cols-2 gap-2">
            {INTEREST_OPTIONS.map(option => (
              <label
                key={option.id}
                className="flex items-center space-x-2 cursor-pointer p-2 rounded-lg border border-gray-300 hover:bg-gray-50"
              >
                <input
                  type="checkbox"
                  checked={interests.includes(option.id)}
                  onChange={() => handleInterestToggle(option.id)}
                  className="w-4 h-4 text-blue-600 focus:ring-blue-500"
                />
                <span className="text-sm text-gray-700">{option.label}</span>
              </label>
            ))}
          </div>
        </div>

        <button
          type="submit"
          disabled={isLoading}
          className="w-full bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed transition-colors mt-6"
        >
          {isLoading ? 'Generating...' : 'Generate Recommendations'}
        </button>
      </form>
    </div>
  );
}

