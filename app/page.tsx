'use client';

import { useState } from 'react';
import LandingPage from '@/components/LandingPage';
import TripResults from '@/components/TripResults';
import { Trip } from '@/lib/types';

export default function Home() {
  const [trip, setTrip] = useState<Trip | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const handleSearch = async (searchData: {
    destination: string;
    startDate?: string;
    endDate?: string;
    duration?: number;
    interests: string[];
  }) => {
    setIsGenerating(true);
    try {
      const response = await fetch('/api/trips/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(searchData),
      });

      if (!response.ok) {
        const error = await response.json();
        alert(error.error || 'Failed to generate trip');
        return;
      }

      const data = await response.json();
      setTrip(data.trip);
    } catch (error) {
      console.error('Error generating trip:', error);
      alert('An error occurred while generating your trip');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="min-h-screen">
      {!trip ? (
        <LandingPage onSearch={handleSearch} isLoading={isGenerating} />
      ) : (
        <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100">       
          <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <TripResults
              trip={trip}
              onBack={() => setTrip(null)}
            />
          </main>
        </div>
      )}
    </div>
  );
}
