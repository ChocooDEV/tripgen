'use client';

import { useState } from 'react';
import { Trip, ItineraryDay, TripPlace } from '@/lib/types';
import { isRestaurantType, isLodgingType, isActivityType } from '@/lib/place-types';

function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  return `/api/places/photo?photo_reference=${encodeURIComponent(photoReference)}&maxwidth=${maxWidth}`;
}

interface TripResultsProps {
  trip: Trip;
  onBack?: () => void;
}

export default function TripResults({ trip, onBack }: TripResultsProps) {
  const placesMap = new Map(trip.places?.map(p => [p.place_id, p]) || []);
  
  // Categorize places with strict separation (using shared type checking functions)
  const restaurants = trip.places?.filter(p => {
    const types = p.types || [];
    return isRestaurantType(types) && !isLodgingType(types);
  }) || [];
  
  const stays = trip.places?.filter(p => {
    const types = p.types || [];
    // Must have lodging/hotel type
    if (!isLodgingType(types)) return false;
    
    // Exclude if it's primarily a restaurant/cafe/bar (but be less strict)
    if (isRestaurantType(types)) {
      // Check the first type - if it's a restaurant type, exclude it
      const firstType = types[0]?.toLowerCase() || '';
      if (firstType === 'restaurant' || firstType === 'cafe' || firstType === 'bar' || firstType === 'night_club') {
        return false;
      }
      
      // Also exclude if night_club or bar is in the first 2 types
      const firstTwoTypes = types.slice(0, 2).map(t => t.toLowerCase());
      if (firstTwoTypes.includes('night_club') || firstTwoTypes.includes('bar')) {
        return false;
      }
    }
    return true;
  }) || [];
  
  const activities = trip.places?.filter(p => {
    const types = p.types || [];
    return isActivityType(types) && !isRestaurantType(types) && !isLodgingType(types);
  }) || [];

  const [selectedDay, setSelectedDay] = useState(0);
  const [selectedPlace, setSelectedPlace] = useState<TripPlace | null>(null);
  const [isStaysOpen, setIsStaysOpen] = useState(true);
  const [isActivitiesOpen, setIsActivitiesOpen] = useState(true);
  const [isRestaurantsOpen, setIsRestaurantsOpen] = useState(true);

  // Find the best photo for the banner - prefer activities/attractions with high ratings
  const getBannerPhoto = (): string | null => {
    // First, try to find a high-rated activity/attraction with a photo
    const photoPlace = activities
      .filter(p => p.photo_reference && p.rating && p.rating >= 4.0)
      .sort((a, b) => (b.rating || 0) - (a.rating || 0))[0];
    
    if (photoPlace?.photo_reference) {
      return getPhotoUrl(photoPlace.photo_reference, 1920);
    }
    
    // Fallback to any activity with a photo
    const anyActivityPhoto = activities.find(p => p.photo_reference);
    if (anyActivityPhoto?.photo_reference) {
      return getPhotoUrl(anyActivityPhoto.photo_reference, 1920);
    }
    
    // Fallback to any place with a photo
    const anyPlacePhoto = trip.places?.find(p => p.photo_reference);
    if (anyPlacePhoto?.photo_reference) {
      return getPhotoUrl(anyPlacePhoto.photo_reference, 1920);
    }
    
    return null;
  };

  const bannerPhoto = getBannerPhoto();

  // Function to export itinerary to Google Maps
  const handleAddToGoogleMaps = () => {
    if (!trip.itinerary || trip.itinerary.length === 0) {
      alert('No itinerary available to export');
      return;
    }

    // Collect all places from the itinerary in order with their coordinates
    const places: Array<{ place_id: string; lat: number; lng: number; name: string }> = [];
    trip.itinerary.forEach(day => {
      if (day.items) {
        day.items.forEach(item => {
          if (item.trip_place_id) {
            const place = placesMap.get(item.trip_place_id);
            if (place && place.lat && place.lng) {
              // Avoid duplicates
              if (!places.find(p => p.place_id === item.trip_place_id)) {
                places.push({
                  place_id: item.trip_place_id,
                  lat: place.lat,
                  lng: place.lng,
                  name: place.name
                });
              }
            }
          }
        });
      }
    });

    if (places.length === 0) {
      alert('No places found in itinerary');
      return;
    }

    // Google Maps Directions API supports up to 25 waypoints
    // If we have more, we'll use the first 25
    const placesToUse = places.slice(0, 25);
    
    if (placesToUse.length === 1) {
      // Single place - just open it
      const place = placesToUse[0];
      const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${place.lat},${place.lng}`;
      window.open(mapsUrl, '_blank');
    } else {
      // Multiple places - create a route with waypoints
      const destination = placesToUse[placesToUse.length - 1];
      const waypoints = placesToUse.slice(0, -1);
      
      // Build waypoints string: lat1,lng1|lat2,lng2|...
      const waypointsStr = waypoints.map(p => `${p.lat},${p.lng}`).join('|');
      
      // Create directions URL
      const mapsUrl = `https://www.google.com/maps/dir/?api=1&destination=${destination.lat},${destination.lng}&waypoints=${encodeURIComponent(waypointsStr)}`;
      
      window.open(mapsUrl, '_blank');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-orange-50/30 to-rose-50/40">
      {/* Hero Header Section - Full Width */}
      <div className="relative w-full bg-gradient-to-br from-orange-500 via-rose-500 to-pink-500 overflow-hidden">
        {/* Background Image */}
        {bannerPhoto && (
          <div 
            className="absolute inset-0 bg-cover bg-center"
            style={{
              backgroundImage: `url(${bannerPhoto})`,
            }}
          >
            <div className="absolute inset-0 bg-gradient-to-br from-orange-600/80 via-rose-600/80 to-pink-600/80"></div>
          </div>
        )}
        
        {/* Overlay for better text readability */}
        <div className="absolute inset-0 bg-black/30"></div>
        <div className="absolute inset-0" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255,255,255,0.1) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255,255,255,0.1) 0%, transparent 50%)'
        }}></div>
        
        <div className="relative w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 sm:py-12 lg:py-16">
          {/* Back Button */}
          {onBack && (
            <button
              onClick={onBack}
              className="flex items-center gap-2 text-white/90 hover:text-white transition-all font-medium mb-6 sm:mb-8 group backdrop-blur-sm bg-white/10 px-4 py-2 rounded-full"
            >
              <svg className="w-5 h-5 transform group-hover:-translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              <span>Back to Search</span>
            </button>
          )}
          
          {/* Hero Content */}
          <div className="flex flex-col lg:flex-row lg:justify-between lg:items-start gap-6 lg:gap-8">
            <div className="flex-1">
              <h1 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-extrabold text-white mb-6 leading-tight drop-shadow-lg">
                {trip.destination}
              </h1>
              <div className="flex flex-wrap items-center gap-4 sm:gap-6 mb-6">
                {trip.duration_days && (
                  <div className="flex items-center text-white/95 text-base sm:text-lg backdrop-blur-sm bg-white/20 px-4 py-2 rounded-full">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-semibold">{trip.duration_days} day{trip.duration_days > 1 ? 's' : ''}</span>
                  </div>
                )}
                {trip.start_date && trip.end_date && (
                  <div className="flex items-center text-white/95 text-base sm:text-lg backdrop-blur-sm bg-white/20 px-4 py-2 rounded-full">
                    <svg className="w-5 h-5 mr-2 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <span className="font-medium">{new Date(trip.start_date).toLocaleDateString()} - {new Date(trip.end_date).toLocaleDateString()}</span>
                  </div>
                )}
              </div>
              {trip.interests && trip.interests.length > 0 && (
                <div className="flex flex-wrap gap-2 sm:gap-3">
                  {trip.interests.map(interest => {
                    const interestLabels: Record<string, string> = {
                      food: 'Food',
                      museums: 'History',
                      nature: 'Nature',
                      history: 'Culture',
                      nightlife: 'Nightlife',
                      beach: 'Beach',
                      kids: 'Beach',
                    };
                    const label = interestLabels[interest.toLowerCase()] || interest;
                    return (
                      <span
                        key={interest}
                        className="px-4 py-2 bg-white/25 backdrop-blur-md text-white rounded-full text-sm font-bold shadow-lg border border-white/30"
                      >
                        {label}
                      </span>
                    );
                  })}
                </div>
              )}
            </div>
            <button
              onClick={handleAddToGoogleMaps}
              className="w-full lg:w-auto bg-white text-orange-600 px-8 py-4 rounded-2xl font-bold hover:bg-orange-50 transition-all duration-200 transform hover:scale-105 shadow-2xl hover:shadow-3xl text-lg sm:text-xl flex items-center gap-2"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              <span>Add to Google Maps</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width */}
      <div className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-12 2xl:px-16 py-8 sm:py-12 lg:py-16">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-8 lg:gap-12">
          {/* Recommendations Section - Takes 8 columns on xl screens */}
          <div className="xl:col-span-8 space-y-8 lg:space-y-12">
            {/* Recommended Stays */}
            {stays.length > 0 ? (
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-orange-500 to-rose-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
                    </svg>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex-1">Recommended Stays</h2>
                  <button
                    onClick={() => setIsStaysOpen(!isStaysOpen)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <svg 
                      className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${isStaysOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {isStaysOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    {stays.slice(0, Math.max(5, stays.length)).map(place => (
                      <StayCard key={place.place_id} place={place} onClick={() => setSelectedPlace(place)} />
                    ))}
                  </div>
                )}
              </section>
            ) : null}

            {/* Recommended Activities */}
            {activities.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-blue-500 to-purple-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5" />
                    </svg>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex-1">Activities & Attractions</h2>
                  <button
                    onClick={() => setIsActivitiesOpen(!isActivitiesOpen)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <svg 
                      className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${isActivitiesOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {isActivitiesOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    {activities.slice(0, Math.max(6, activities.length)).map(place => (
                      <ActivityCard key={place.place_id} place={place} onClick={() => setSelectedPlace(place)} />
                    ))}
                  </div>
                )}
              </section>
            )}

            {/* Recommended Restaurants */}
            {restaurants.length > 0 && (
              <section>
                <div className="flex items-center gap-4 mb-6">
                  <div className="w-14 h-14 bg-gradient-to-br from-emerald-500 to-teal-500 rounded-2xl flex items-center justify-center shadow-lg">
                    <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                    </svg>
                  </div>
                  <h2 className="text-3xl sm:text-4xl font-extrabold text-gray-900 flex-1">Restaurants & Dining</h2>
                  <button
                    onClick={() => setIsRestaurantsOpen(!isRestaurantsOpen)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-gray-100 transition-colors cursor-pointer"
                  >
                    <svg 
                      className={`w-6 h-6 text-gray-600 transition-transform duration-300 ${isRestaurantsOpen ? 'rotate-180' : ''}`}
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>
                </div>
                {isRestaurantsOpen && (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in slide-in-from-top-4 duration-300">
                    {restaurants.slice(0, Math.max(6, restaurants.length)).map(place => (
                      <RestaurantCard key={place.place_id} place={place} onClick={() => setSelectedPlace(place)} />
                    ))}
                  </div>
                )}
              </section>
            )}
          </div>

          {/* Itinerary Section - Takes 4 columns on xl screens */}
          {trip.itinerary && trip.itinerary.length > 0 && (
            <div className="xl:col-span-4">
              <div className="bg-white/80 backdrop-blur-xl rounded-3xl shadow-2xl p-6 sm:p-8 border border-white/50 xl:sticky xl:top-8 xl:h-fit xl:max-h-[calc(100vh-4rem)] xl:overflow-y-auto">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-14 h-14 bg-gradient-to-br from-purple-500 to-pink-500 rounded-2xl flex items-center justify-center shadow-lg">
                  <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h2 className="text-2xl sm:text-3xl font-extrabold text-gray-900">
                    {trip.duration_days || trip.itinerary.length} Day Itinerary
                  </h2>
                  <p className="text-sm text-gray-600 mt-1">Day {selectedDay + 1} of {trip.itinerary.length}</p>
                </div>
              </div>
              
              {/* Day Tabs */}
              <div className="flex flex-wrap gap-2 sm:gap-3 mb-6 sm:mb-8 pb-4 sm:pb-6 border-b-2 border-gray-200">
                {trip.itinerary.map((day, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedDay(idx)}
                    className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl font-semibold text-sm sm:text-base transition-all duration-200 transform ${
                      selectedDay === idx
                        ? 'bg-gradient-to-r from-orange-500 to-rose-500 text-white shadow-lg scale-105'
                        : 'bg-gray-100 text-gray-700 hover:bg-gray-200 hover:scale-105'
                    }`}
                  >
                    Day {idx + 1}
                  </button>
                ))}
              </div>

              {/* Selected Day Content */}
              <DayItinerary 
                day={trip.itinerary[selectedDay]} 
                placesMap={placesMap} 
                dayNumber={selectedDay + 1}
                onPlaceClick={(place) => setSelectedPlace(place)}
              />
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Place Detail Modal */}
      {selectedPlace && (
        <PlaceDetailModal place={selectedPlace} onClose={() => setSelectedPlace(null)} />
      )}
    </div>
  );
}

function StayCard({ place, onClick }: { place: TripPlace; onClick: () => void }) {
  const photoUrl = place.photo_reference ? getPhotoUrl(place.photo_reference, 500) : null;
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-orange-300"
    >
      {photoUrl && (
        <div className="relative h-48 overflow-hidden">
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
        </div>
      )}
      <div className="p-5">
        <h4 className="font-bold text-gray-900 text-lg mb-3 leading-tight line-clamp-2">{place.name}</h4>
        {place.rating && (
          <div className="flex flex-wrap items-center gap-3 mb-3">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span className="text-base font-bold text-gray-900">{place.rating.toFixed(1)}</span>
            </div>
            {place.price_level !== undefined && (
              <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-3 py-1 rounded-full">
                {'$'.repeat(place.price_level + 1)}/night
              </span>
            )}
          </div>
        )}
        {place.address && (
          <p className="text-sm text-gray-500 line-clamp-2">{place.address}</p>
        )}
      </div>
    </div>
  );
}

function ActivityCard({ place, onClick }: { place: TripPlace; onClick: () => void }) {
  const photoUrl = place.photo_reference ? getPhotoUrl(place.photo_reference, 500) : null;
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-blue-300"
    >
      {photoUrl && (
        <div className="relative h-40 overflow-hidden">
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
        </div>
      )}
      <div className="p-5">
        <h4 className="font-bold text-gray-900 text-lg mb-3 leading-tight line-clamp-2">{place.name}</h4>
        {place.rating && (
          <div className="flex items-center gap-1 mb-2">
            <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
              <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
            </svg>
            <span className="text-base font-bold text-gray-900">{place.rating.toFixed(1)}</span>
          </div>
        )}
        {place.address && (
          <p className="text-sm text-gray-500 line-clamp-2">{place.address}</p>
        )}
      </div>
    </div>
  );
}

function RestaurantCard({ place, onClick }: { place: TripPlace; onClick: () => void }) {
  const photoUrl = place.photo_reference ? getPhotoUrl(place.photo_reference, 500) : null;
  
  return (
    <div 
      onClick={onClick}
      className="group relative bg-white rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all duration-300 cursor-pointer border border-gray-100 hover:border-emerald-300"
    >
      {photoUrl && (
        <div className="relative h-40 overflow-hidden">
          <img
            src={photoUrl}
            alt={place.name}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-black/0 to-transparent"></div>
        </div>
      )}
      <div className="p-5">
        <h4 className="font-bold text-gray-900 text-lg mb-3 leading-tight line-clamp-2">{place.name}</h4>
        <div className="flex flex-wrap items-center gap-3 mb-2">
          {place.rating && (
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20">
                <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
              </svg>
              <span className="text-base font-bold text-gray-900">{place.rating.toFixed(1)}</span>
            </div>
          )}
          {place.price_level !== undefined && (
            <span className="text-sm text-gray-600 font-semibold bg-gray-100 px-3 py-1 rounded-full">
              {'$'.repeat(place.price_level + 1)}
            </span>
          )}
        </div>
        {place.address && (
          <p className="text-sm text-gray-500 line-clamp-2">{place.address}</p>
        )}
      </div>
    </div>
  );
}

function DayItinerary({ day, placesMap, dayNumber, onPlaceClick }: { day: ItineraryDay; placesMap: Map<string, TripPlace>; dayNumber: number; onPlaceClick: (place: TripPlace) => void }) {
  // Filter out stays (lodging) from itinerary items
  const filteredItems = day.items.filter(item => {
    const place = placesMap.get(item.trip_place_id);
    if (!place) return false;
    const types = place.types || [];
    const isLodging = types.some(t => t === 'lodging' || t === 'hotel');
    return !isLodging; // Exclude stays
  });

  return (
    <div>
      {day.theme && (
        <div className="mb-4 sm:mb-6">
          <span className="px-4 py-2 bg-gradient-to-r from-orange-100 to-rose-100 text-orange-800 rounded-full text-sm font-semibold shadow-sm">
            {day.theme}
          </span>
        </div>
      )}
      <div className="space-y-3 sm:space-y-4">
        {filteredItems.map((item, idx) => {
          const place = placesMap.get(item.trip_place_id);
          if (!place) return null;
          
          const photoUrl = place.photo_reference ? getPhotoUrl(place.photo_reference, 300) : null;
          
          return (
            <div 
              key={idx} 
              onClick={() => onPlaceClick(place)}
              className="flex gap-3 sm:gap-4 p-3 sm:p-4 bg-gradient-to-r from-gray-50 to-white rounded-xl hover:shadow-lg transition-all duration-300 cursor-pointer border border-gray-100 hover:border-orange-300 group"
            >
              {photoUrl && (
                <img
                  src={photoUrl}
                  alt={place.name}
                  className="w-16 h-16 sm:w-20 sm:h-20 object-cover rounded-lg flex-shrink-0 shadow-md group-hover:scale-105 transition-transform duration-300"
                />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1">
                    <h5 className="font-bold text-gray-900 text-sm sm:text-base mb-1.5 leading-tight">{place.name}</h5>
                    {item.start_time && item.end_time && (
                      <div className="flex items-center text-xs sm:text-sm text-gray-600 mb-2">
                        <svg className="w-4 h-4 mr-1.5 text-orange-500 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-semibold">{item.start_time} - {item.end_time}</span>
                      </div>
                    )}
                    {place.address && (
                      <p className="text-xs text-gray-500 line-clamp-1">{place.address}</p>
                    )}
                  </div>
                  <svg className="w-4 h-4 sm:w-5 sm:h-5 text-gray-400 group-hover:text-orange-500 flex-shrink-0 transition-colors mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function PlaceDetailModal({ place, onClose }: { place: TripPlace; onClose: () => void }) {
  const photoUrl = place.photo_reference ? getPhotoUrl(place.photo_reference, 600) : null;
  const isHotel = place.types?.some(t => t === 'lodging' || t === 'hotel') || false;
  
  // Generate Google Maps URL
  const mapsUrl = place.place_id 
    ? `https://www.google.com/maps/place/?q=place_id:${place.place_id}`
    : `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.lat)},${encodeURIComponent(place.lng)}`;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-black/70 backdrop-blur-sm"
      onClick={onClose}
    >
      <div 
        className="relative bg-white rounded-3xl shadow-2xl max-w-2xl w-full max-h-[90vh] sm:max-h-[95vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 z-10 p-2.5 bg-white/95 rounded-full hover:bg-white transition-all shadow-xl hover:scale-110"
        >
          <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Photo */}
        {photoUrl && (
          <div className="relative w-full h-48 sm:h-64 md:h-80 bg-gray-200 rounded-t-3xl overflow-hidden">
            <img
              src={photoUrl}
              alt={place.name}
              className="w-full h-full object-cover"
            />
          </div>
        )}

        {/* Content */}
        <div className="p-6 sm:p-8 md:p-10">
          {/* Title and Rating */}
          <div className="mb-6">
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight">{place.name}</h2>
            <div className="flex flex-wrap items-center gap-4 sm:gap-6">
              {place.rating && (
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 sm:w-6 sm:h-6 text-yellow-500 fill-current" viewBox="0 0 20 20">
                    <path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" />
                  </svg>
                  <span className="text-lg sm:text-xl font-bold text-gray-900">{place.rating.toFixed(1)}</span>
                </div>
              )}
              {place.price_level !== undefined && (
                <div className="flex items-center gap-1">
                  <span className="text-lg sm:text-xl font-bold text-gray-700">
                    {isHotel ? 'Per night: ' : ''}{'$'.repeat(place.price_level + 1)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Address */}
          {place.address && (
            <div className="mb-6 sm:mb-8 flex items-start gap-3 sm:gap-4">
              <svg className="w-5 h-5 sm:w-6 sm:h-6 text-gray-400 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-sm sm:text-base text-gray-600 flex-1 leading-relaxed">{place.address}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6 sm:mb-8">
            {/* Google Maps */}
            <a
              href={mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-5 py-3.5 sm:py-4 bg-gradient-to-r from-orange-500 to-rose-500 text-white rounded-xl font-semibold hover:from-orange-600 hover:to-rose-600 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
              </svg>
              View on Maps
            </a>

            {/* Website or Search for Hotels */}
            {isHotel ? (
              place.website ? (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Book Now
                </a>
              ) : (
                <a
                  href={`https://www.google.com/search?q=${encodeURIComponent(place.name + (place.address ? ' ' + place.address : '') + ' hotel booking')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 sm:py-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-xl font-semibold hover:from-blue-700 hover:to-blue-800 transition-all duration-200 transform hover:scale-105 shadow-lg hover:shadow-xl text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  Search Booking
                </a>
              )
            ) : (
              place.website && (
                <a
                  href={place.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 px-5 py-3.5 sm:py-4 bg-white border-2 border-orange-500 text-orange-600 rounded-xl font-semibold hover:bg-orange-50 transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9" />
                  </svg>
                  Visit Website
                </a>
              )
            )}

            {/* Phone */}
            {place.phone_number && (
              <a
                href={`tel:${place.phone_number}`}
                className="flex items-center justify-center gap-2 px-5 py-3.5 sm:py-4 bg-white border-2 border-gray-300 text-gray-700 rounded-xl font-semibold hover:bg-gray-50 transition-all duration-200 transform hover:scale-105 text-sm sm:text-base"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                </svg>
                {place.phone_number}
              </a>
            )}
          </div>

          {/* Types */}
          {place.types && place.types.length > 0 && (
            <div className="flex flex-wrap gap-2 sm:gap-3">
              {place.types.slice(0, 5).map((type, idx) => (
                <span
                  key={idx}
                  className="px-3 sm:px-4 py-1.5 bg-gray-100 text-gray-700 rounded-full text-xs sm:text-sm font-medium shadow-sm"
                >
                  {type.replace(/_/g, ' ')}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
