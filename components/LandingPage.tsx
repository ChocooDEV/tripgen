'use client';

import { useState, useEffect, useRef } from 'react';
import Image from 'next/image';

interface LandingPageProps {
  onSearch: (data: {
    destination: string;
    startDate?: string;
    endDate?: string;
    duration?: number;
    interests: string[];
  }) => void;
  isLoading?: boolean;
}

const INTEREST_OPTIONS = [
  { id: 'food', label: 'Food' },
  { id: 'museums', label: 'History' },
  { id: 'nature', label: 'Nature' },
  { id: 'history', label: 'Culture' },
  { id: 'nightlife', label: 'Nightlife' },
  { id: 'beach', label: 'Beach' },
];

export default function LandingPage({ onSearch, isLoading }: LandingPageProps) {
  const [destination, setDestination] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [interests, setInterests] = useState<string[]>([]);
  const [suggestions, setSuggestions] = useState<Array<{ description: string; place_id: string; structured_formatting?: { main_text?: string; secondary_text?: string } }>>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedIndex, setSelectedIndex] = useState(-1);
  const [scrollY, setScrollY] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleScroll = () => setScrollY(window.scrollY);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

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
    }, 300);

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

  const handleSuggestionSelect = (suggestion: { description: string; place_id: string; structured_formatting?: { main_text?: string; secondary_text?: string } }) => {
    // Use just the city name
    const cityName = suggestion.structured_formatting?.main_text || suggestion.description.split(',')[0].trim();
    setDestination(cityName);
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
    if (!startDate || !endDate) {
      alert('Please select both start and end dates');
      return;
    }
    onSearch({
      destination: destination.trim(),
      startDate: startDate,
      endDate: endDate,
      duration: undefined,
      interests,
    });
  };

  return (
    <div className="min-h-screen">
      {/* Hero Section with Background Image */}
      <div className="relative min-h-screen flex flex-col overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/landing.JPG"
            alt="Beautiful travel destination"
            fill
            className="object-cover transition-transform duration-700 ease-out"
            style={{ transform: `scale(${1 + scrollY * 0.0005})` }}
            priority
            quality={75}
            sizes="100vw"
            loading="eager"
            fetchPriority="high"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/50 to-black/60"></div>
          <div className="absolute inset-0 opacity-30">
            <div className="absolute top-20 left-10 w-2 h-2 bg-white rounded-full animate-pulse"></div>
            <div className="absolute top-40 right-20 w-3 h-3 bg-blue-300 rounded-full animate-pulse delay-300"></div>
            <div className="absolute bottom-40 left-1/4 w-2 h-2 bg-white rounded-full animate-pulse delay-700"></div>
            <div className="absolute bottom-20 right-1/3 w-2 h-2 bg-blue-300 rounded-full animate-pulse delay-1000"></div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="relative z-10 w-full backdrop-blur-sm bg-black/20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            <div className="flex justify-between items-center">
              <h1 className="text-2xl md:text-3xl font-bold text-white drop-shadow-lg">TripGen</h1>
              <div className="hidden md:flex items-center space-x-6">
                <a href="#how-it-works" className="text-white hover:text-blue-200 transition-colors font-medium">How it Works</a>
                <a href="#features" className="text-white hover:text-blue-200 transition-colors font-medium">Features</a>
              </div>
              <button className="md:hidden text-white">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>
          </div>
        </nav>

        {/* Hero Content */}
        <div className="relative z-10 flex-1 flex items-center justify-center px-4 sm:px-6 lg:px-8 py-12 md:py-20">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8 md:mb-12 animate-fade-in">
              <h2 className="text-5xl md:text-6xl lg:text-7xl font-extrabold text-white mb-6 drop-shadow-2xl">
                Plan Your Next Adventure
              </h2>
              <p className="text-xl md:text-2xl text-white/95 drop-shadow-lg font-light">
                Generate a personalized itinerary for your trip
              </p>
              <div className="mt-6 flex items-center justify-center space-x-8 text-white/80">
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">Google Places Data</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path d="M10.394 2.08a1 1 0 00-.788 0l-7 3a1 1 0 000 1.84L5.25 8.051a.999.999 0 01.356-.257l4-1.714a1 1 0 11.788 1.838L7.667 9.088l1.94.831a1 1 0 01.557 1.28l1.536 3.644a1 1 0 01-.286 1.205l-1.532 1.533a1 1 0 01-1.414 0l-3.644-3.644a1 1 0 010-1.414l1.531-1.532a1 1 0 011.205-.286l3.644 1.536a1 1 0 011.28.557l.83 1.94-1.714 4a1 1 0 01-1.838.788l-7-3a1 1 0 010-1.84l7-3a1 1 0 01.788 0z" />
                  </svg>
                  <span className="text-sm font-medium">Instant Results</span>
                </div>
                <div className="flex items-center space-x-2">
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M2.166 4.999A11.954 11.954 0 0010 1.944 11.954 11.954 0 0017.834 5c.11.65.166 1.32.166 2.001 0 5.225-3.34 9.67-8 11.317C5.34 16.67 2 12.225 2 7c0-.682.057-1.35.166-2.001zm11.541 3.708a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm font-medium">100% Free</span>
                </div>
              </div>
            </div>

            {/* Search Form Card */}
            <div className="bg-white/95 backdrop-blur-xl rounded-3xl shadow-2xl p-6 md:p-8 border border-white/20 transform transition-all duration-300 hover:shadow-3xl">
              <form onSubmit={handleSubmit} className="space-y-4 md:space-y-6">
                <div className="relative">
                  <label htmlFor="destination" className="block text-sm font-semibold text-gray-700 mb-2">
                    Destination
                  </label>
                  <div className="relative">
                    <div className="absolute left-3 top-1/2 transform -translate-y-1/2">
                      <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
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
                      placeholder="Where do you want to go?"
                      className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-gray-900 bg-white transition-all"
                      required
                    />
                  </div>
                  
                  {showSuggestions && suggestions.length > 0 && (
                    <div
                      ref={suggestionsRef}
                      className="absolute z-50 w-full mt-1 bg-white border-2 border-gray-200 rounded-xl shadow-xl max-h-60 overflow-y-auto"
                    >
                      {suggestions.map((suggestion, index) => (
                        <button
                          key={suggestion.place_id}
                          type="button"
                          onClick={() => handleSuggestionSelect(suggestion)}
                          className={`w-full text-left px-4 py-3 hover:bg-orange-50 focus:bg-orange-50 focus:outline-none transition-colors ${
                            index === selectedIndex ? 'bg-orange-50' : ''
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

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Date Range
                  </label>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-gray-900 bg-white transition-all"
                        required
                      />
                    </div>
                    <div className="relative">
                      <div className="absolute left-3 top-1/2 transform -translate-y-1/2 z-10">
                        <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        min={startDate || undefined}
                        className="w-full pl-10 pr-4 py-3 border-2 border-gray-200 rounded-xl focus:ring-2 focus:ring-orange-400 focus:border-orange-400 text-gray-900 bg-white transition-all"
                        required
                      />
                    </div>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">
                    Interests
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {INTEREST_OPTIONS.map(option => (
                      <button
                        key={option.id}
                        type="button"
                        onClick={() => handleInterestToggle(option.id)}
                        className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all duration-200 transform hover:scale-105 ${
                          interests.includes(option.id)
                            ? 'bg-gradient-to-r from-orange-400 to-rose-500 text-white shadow-lg'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading}
                  className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white py-4 px-6 rounded-xl font-bold text-lg hover:from-orange-600 hover:to-rose-600 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all duration-200 transform hover:scale-[1.02] active:scale-[0.98] shadow-xl hover:shadow-2xl"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center">
                      <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Generating Itinerary...
                    </span>
                  ) : (
                    'Generate Itinerary'
                  )}
                </button>
              </form>
            </div>
          </div>
        </div>

        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 z-10 animate-bounce">
          <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
          </svg>
        </div>
      </div>

      {/* How It Works Section */}
      <section id="how-it-works" className="bg-white py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12 md:mb-16">
            <h2 className="text-4xl md:text-5xl font-bold text-gray-900 mb-4">How It Works</h2>
            <p className="text-xl text-gray-600 max-w-2xl mx-auto">
              Plan your perfect trip in just three simple steps
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="text-center transform transition-all duration-300 hover:scale-105">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-200 to-rose-300 rounded-full mb-6 shadow-lg">
                <span className="text-3xl font-bold text-orange-800">1</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Enter Your Details</h3>
              <p className="text-gray-600">
                Tell us where you want to go, when, and what you're interested in
              </p>
            </div>
            <div className="text-center transform transition-all duration-300 hover:scale-105">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-200 to-rose-300 rounded-full mb-6 shadow-lg">
                <span className="text-3xl font-bold text-orange-800">2</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">TripGen Generates Plan</h3>
              <p className="text-gray-600">
                TripGen analyzes millions of options to create your perfect itinerary
              </p>
            </div>
            <div className="text-center transform transition-all duration-300 hover:scale-105">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-gradient-to-br from-orange-200 to-rose-300 rounded-full mb-6 shadow-lg">
                <span className="text-3xl font-bold text-orange-800">3</span>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Start Your Adventure</h3>
              <p className="text-gray-600">
                Review your personalized plan and start exploring your destination
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="bg-gray-50 py-16 md:py-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <h2 className="text-4xl md:text-5xl font-bold text-center text-gray-900 mb-12 md:mb-16">
            Top Features
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 md:gap-12">
            <div className="bg-white rounded-2xl p-8 shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-orange-100 to-rose-200 rounded-xl mb-6">
                <svg className="w-8 h-8 text-orange-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Top Recommendations</h3>
              <p className="text-gray-600 leading-relaxed">
                Get the best stays, attractions, and dining options handpicked for you
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-green-100 to-green-200 rounded-xl mb-6">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Custom Itineraries</h3>
              <p className="text-gray-600 leading-relaxed">
                Discover a day-by-day plan tailored to your preferences
              </p>
            </div>

            <div className="bg-white rounded-2xl p-8 shadow-lg transform transition-all duration-300 hover:scale-105 hover:shadow-2xl">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-purple-100 to-purple-200 rounded-xl mb-6">
                <svg className="w-8 h-8 text-purple-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-3">Effortless Planning</h3>
              <p className="text-gray-600 leading-relaxed">
                Save time and hassle with our automatic itinerary generator
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="bg-gradient-to-r from-orange-200 via-rose-200 to-pink-200 py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-4xl md:text-5xl font-bold text-orange-900 mb-6">
            Ready to Plan Your Next Adventure?
          </h2>
          <p className="text-xl text-orange-800 mb-8">
            Join thousands of travelers who trust TripGen for their trip planning
          </p>
          <button
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="bg-white text-orange-600 px-8 py-4 rounded-xl font-bold text-lg hover:bg-orange-50 transition-all duration-200 transform hover:scale-105 shadow-xl"
          >
            Get Started Now
          </button>
        </div>
      </section>
    </div>
  );
}
