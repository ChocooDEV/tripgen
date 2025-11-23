import { geocodeAddress, searchPlaces, getPlaceDetails, textSearchPlaces } from './google-places';
import { TripSearchParams, TripPlace, ItineraryDay, ItineraryItem, Trip } from './types';
import { isFoodPlace, isActivityPlace, getPlaceCategory, isLodgingType } from './place-types';

// Helper function to enrich places with details (website, phone, opening hours, reviews)
// Also filters by city after enrichment (since enriched addresses are more complete)
async function enrichPlacesWithDetails(places: any[], cityName: string): Promise<any[]> {
  // Fetch details for all places in parallel (with rate limiting)
  const enrichedPlaces = await Promise.all(
    places.map(async (place, index) => {
      // Add small delay to avoid rate limiting
      if (index > 0 && index % 5 === 0) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
      try {
        const details = await getPlaceDetails(place.place_id);
        if (details) {
          const enriched = {
            ...place,
            website: details.website || place.website,
            formatted_phone_number: details.formatted_phone_number || place.formatted_phone_number,
            formatted_address: details.formatted_address || place.formatted_address,
            opening_hours: details.opening_hours || place.opening_hours,
            user_ratings_total: details.user_ratings_total || place.user_ratings_total,
            reviews: details.reviews || place.reviews,
            editorial_summary: details.editorial_summary || place.editorial_summary,
          };
          
          // Re-check city after enrichment (enriched address is more complete)
          if (!isInSameCity(enriched, cityName)) {
            return null; // Filter out if not in same city
          }
          
          return enriched;
        }
        
        // If no details, still check city with existing address
        if (!isInSameCity(place, cityName)) {
          return null;
        }
        
        return place;
      } catch (error) {
        console.error(`Error fetching details for ${place.place_id}:`, error);
        // On error, still check city with existing address
        if (!isInSameCity(place, cityName)) {
          return null;
        }
        return place;
      }
    })
  );
  
  // Filter out null values (places not in same city)
  return enrichedPlaces.filter(p => p !== null);
}

// Check if a place is open at a given time (day of week and time)
function isPlaceOpenAtTime(place: any, dayOfWeek: number, time: string): boolean {
  if (!place.opening_hours || !place.opening_hours.periods) {
    return true; // If no opening hours data, assume open
  }
  
  const periods = place.opening_hours.periods;
  const [hours, minutes] = time.split(':').map(Number);
  const timeMinutes = hours * 60 + minutes;
  
  // Find period for this day
  const dayPeriod = periods.find((p: any) => p.open.day === dayOfWeek);
  if (!dayPeriod || !dayPeriod.close) {
    return true; // Open 24/7 or no close time
  }
  
  const [openHours, openMinutes] = dayPeriod.open.time.match(/.{2}/g)!.map(Number);
  const openTimeMinutes = openHours * 60 + openMinutes;
  
  const [closeHours, closeMinutes] = dayPeriod.close.time.match(/.{2}/g)!.map(Number);
  const closeTimeMinutes = closeHours * 60 + closeMinutes;
  
  // Handle overnight hours (e.g., closes at 2 AM next day)
  if (closeTimeMinutes < openTimeMinutes) {
    return timeMinutes >= openTimeMinutes || timeMinutes < closeTimeMinutes;
  }
  
  return timeMinutes >= openTimeMinutes && timeMinutes < closeTimeMinutes;
}

// Get day of week (0 = Sunday, 1 = Monday, etc.) from a date string
function getDayOfWeek(dateString: string): number {
  const date = new Date(dateString);
  return date.getDay();
}

// Type checking functions are now imported from './place-types'

// Helper function to check if a place is in the same city
function isInSameCity(place: any, cityName: string): boolean {
  if (!cityName) return true; // If no city name, don't filter
  
  const address = (place.formatted_address || place.address || '').toLowerCase();
  const cityLower = cityName.toLowerCase();
  
  // Check if city name appears in the address
  // Also check for common variations (e.g., "Fribourg" vs "Fribourg, Switzerland")
  return address.includes(cityLower) || 
         address.split(',').some((part: string) => part.trim().toLowerCase() === cityLower);
}

export async function generateTrip(params: TripSearchParams): Promise<Trip> {
  // Step 1: Geocode destination
  const geocodeResult = await geocodeAddress(params.destination);
  if (!geocodeResult) {
    throw new Error('Could not find location for destination');
  }

  const { lat, lng, city } = geocodeResult;
  const location = `${lat},${lng}`;
  const cityName = city || params.destination.split(',')[0].trim();

  // Step 2: Search for places with interest-based keywords
  const interestKeywords = buildInterestKeywords(params.interests);
  
  // Search for attractions based on interests - do multiple searches for different interest types
  const attractionSearches: Promise<any[]>[] = [];
  
  params.interests.forEach(interest => {
    const interestLower = interest.toLowerCase();
    let searchType = 'tourist_attraction';
    let keyword: string | undefined;
    
    // Map interests to specific place types and keywords
    if (interestLower === 'nightlife') {
      // For nightlife, do multiple searches for variety: nightclubs, shopping, entertainment, etc.
      // Search 1: Nightclubs and bars
      attractionSearches.push(searchPlaces({
        location,
        type: 'night_club' as any,
        radius: 8000,
        keyword: 'nightclub bar entertainment',
      }));
      
      // Search 2: Shopping malls and stores
      attractionSearches.push(searchPlaces({
        location,
        type: 'shopping_mall' as any,
        radius: 8000,
        keyword: 'shopping mall store',
      }));
      
      // Search 3: Entertainment venues (theaters, game centers, etc.)
      attractionSearches.push(searchPlaces({
        location,
        type: 'tourist_attraction' as any,
        radius: 8000,
        keyword: 'entertainment game center arcade theater',
      }));
      
      // Search 4: Casinos and amusement parks
      attractionSearches.push(searchPlaces({
        location,
        type: 'casino' as any,
        radius: 8000,
      }));
      
      attractionSearches.push(searchPlaces({
        location,
        type: 'amusement_park' as any,
        radius: 8000,
      }));
      
      return; // Skip the default search for nightlife
    } else if (interestLower === 'beach') {
      searchType = 'tourist_attraction';
      keyword = 'beach coast seaside waterfront';
    } else if (interestLower === 'nature') {
      searchType = 'park';
      keyword = 'park nature reserve garden';
    } else if (interestLower === 'museums' || interestLower === 'history') {
      searchType = 'museum';
      keyword = interestLower === 'museums' ? 'museum art gallery' : 'historic monument heritage';
    } else if (interestLower === 'food') {
      searchType = 'tourist_attraction';
      keyword = 'food market culinary';
    } else {
      keyword = interestKeywords.attraction;
    }
    
    attractionSearches.push(searchPlaces({
      location,
      type: searchType as any,
      radius: 8000, // Reduced radius to keep in same city
      keyword,
    }));
  });
  
  // Search for hotels and restaurants (reduced radius to keep in same city)
  const allSearches = [
    searchPlaces({
      location,
      type: 'lodging',
      radius: 8000, // Reduced radius to keep in same city
      keyword: interestKeywords.hotel,
    }),
    searchPlaces({
      location,
      type: 'restaurant',
      radius: 8000, // Reduced radius to keep in same city
      keyword: interestKeywords.restaurant,
    }),
    ...attractionSearches,
  ];
  
  const [hotelsRaw, restaurantsRaw, ...attractionResults] = await Promise.all(allSearches);
  
  // Filter hotels and restaurants by city
  const hotels = hotelsRaw.filter(h => isInSameCity(h, cityName));
  const restaurants = restaurantsRaw.filter(r => isInSameCity(r, cityName));
  
  // Combine all attraction results and remove duplicates, filter by city
  const attractionsMap = new Map();
  attractionResults.forEach(attractionList => {
    attractionList.forEach(attraction => {
      if (!attractionsMap.has(attraction.place_id) && isInSameCity(attraction, cityName)) {
        attractionsMap.set(attraction.place_id, attraction);
      }
    });
  });
  const attractions = Array.from(attractionsMap.values());

  // Step 3: Filter and rank places (now with interests)
  // Minimum rating is 3.8 - no exceptions
  let allHotels = hotels;
  let rankedHotels = rankHotels(allHotels, lat, lng, params.interests, 3.8);
  
  // If we don't have at least 3 hotels with 3.8+ rating, do additional searches (still in same city)
  if (rankedHotels.length < 3) {
    // Try additional search with slightly larger radius but still filter by city
    const additionalHotelsRaw = await searchPlaces({
      location,
      type: 'lodging',
      radius: 10000, // Keep radius reasonable
    });
    
    const additionalHotels = additionalHotelsRaw.filter(h => isInSameCity(h, cityName));
    
    // Combine hotels, removing duplicates
    const hotelsMap = new Map();
    allHotels.forEach(h => hotelsMap.set(h.place_id, h));
    additionalHotels.forEach(h => hotelsMap.set(h.place_id, h));
    allHotels = Array.from(hotelsMap.values());
    
    // Re-rank all hotels with 3.8+ rating requirement
    rankedHotels = rankHotels(allHotels, lat, lng, params.interests, 3.8);
  }
  
  // If still not enough, try one more search (still in same city)
  if (rankedHotels.length < 3) {
    const moreHotelsRaw = await searchPlaces({
      location,
      type: 'lodging',
      radius: 12000, // Keep radius reasonable for city
    });
    
    const moreHotels = moreHotelsRaw.filter(h => isInSameCity(h, cityName));
    
    // Combine all hotels (already filtered by city)
    const hotelsMap = new Map();
    allHotels.forEach(h => hotelsMap.set(h.place_id, h));
    moreHotels.forEach(h => hotelsMap.set(h.place_id, h));
    allHotels = Array.from(hotelsMap.values());
    
    rankedHotels = rankHotels(allHotels, lat, lng, params.interests, 3.8);
  }
  
  // Select at least 3 hotels (or all available if less than 3)
  // Select up to 7-8 to account for potential filtering during enrichment, then cap at 5 after
  const selectedHotels = rankedHotels.length >= 3 
    ? rankedHotels.slice(0, Math.min(8, rankedHotels.length)) // Select up to 8 to ensure we have enough after enrichment
    : rankedHotels;
  // Step 3: Filter and rank attractions - ensure at least 3
  let rankedAttractions = rankAttractions(attractions, params.interests, lat, lng);
  
  // If we don't have at least 3 attractions, do additional searches with text search for better results
  if (rankedAttractions.length < 3) {
    const textSearchQueries: string[] = [];
    
    params.interests.forEach(interest => {
      const interestLower = interest.toLowerCase();
      const queries: Record<string, string[]> = {
        nightlife: [
          `best nightlife ${cityName}`,
          `shopping malls ${cityName}`,
          `game centers entertainment ${cityName}`,
          `casinos ${cityName}`,
          `amusement parks ${cityName}`,
        ],
        beach: [`best beaches ${cityName}`],
        nature: [`best parks nature ${cityName}`],
        museums: [`best museums ${cityName}`],
        history: [`best historic sites ${cityName}`],
        food: [`best food markets ${cityName}`],
      };
      
      if (queries[interestLower]) {
        textSearchQueries.push(...queries[interestLower]);
      } else {
        textSearchQueries.push(`best attractions ${cityName}`);
      }
    });
    
    // Do text searches for better results
    const textSearchResults = await Promise.all(
      textSearchQueries.map(query => textSearchPlaces(query, location))
    );
    
    // Also do nearby search as fallback (filter by city)
    const additionalAttractionsRaw = await searchPlaces({
      location,
      type: 'tourist_attraction',
      radius: 10000, // Reduced radius
    });
    
    const additionalAttractions = additionalAttractionsRaw.filter(a => isInSameCity(a, cityName));
    
    // Combine all attractions (filter by city)
    const attractionsMap = new Map();
    attractions.forEach(a => {
      if (isInSameCity(a, cityName)) {
        attractionsMap.set(a.place_id, a);
      }
    });
    textSearchResults.forEach(resultList => {
      resultList.forEach(a => {
        if (isInSameCity(a, cityName) && !attractionsMap.has(a.place_id)) {
          attractionsMap.set(a.place_id, a);
        }
      });
    });
    additionalAttractions.forEach(a => {
      if (!attractionsMap.has(a.place_id)) {
        attractionsMap.set(a.place_id, a);
      }
    });
    const allAttractions = Array.from(attractionsMap.values());
    
    rankedAttractions = rankAttractions(allAttractions, params.interests, lat, lng);
  }
  
  // Calculate duration early to know how many activities we need
  const duration = params.duration || (params.startDate && params.endDate
    ? Math.ceil((new Date(params.endDate).getTime() - new Date(params.startDate).getTime()) / (1000 * 60 * 60 * 24))
    : 3);
  
  // CRITICAL: We need at least (duration * 3) activities for the itinerary, plus buffer
  // Select enough activities for the itinerary, but limit display to 15
  const minActivitiesNeeded = duration * 3 + 10; // 3 per day + 10 buffer for variety
  const activitiesForItinerary = Math.max(minActivitiesNeeded, 15); // At least 15, or more if needed
  
  // Select attractions: enough for itinerary, but display will be limited to 15
  const selectedAttractions = rankedAttractions.length >= 3
    ? rankedAttractions.slice(0, Math.max(activitiesForItinerary, Math.min(15, rankedAttractions.length)))
    : rankedAttractions;
  
  // Step 3: Filter and rank restaurants - ensure at least 3
  let rankedRestaurants = rankRestaurants(restaurants, params.interests, lat, lng);
  
  // If we don't have at least 3 restaurants, do additional searches with text search
  if (rankedRestaurants.length < 3) {
    // Use text search for better restaurant recommendations (with city name)
    const restaurantQueries = [
      `best restaurants ${cityName}`,
      `top rated restaurants ${cityName}`,
    ];
    
    if (params.interests.includes('food')) {
      restaurantQueries.push(`best food ${cityName}`);
    }
    if (params.interests.includes('nightlife')) {
      restaurantQueries.push(`best bars restaurants ${cityName}`);
    }
    
    const textSearchResults = await Promise.all(
      restaurantQueries.map(query => textSearchPlaces(query, location, 'restaurant'))
    );
    
    // Also do nearby search as fallback (filter by city)
    const additionalRestaurantsRaw = await searchPlaces({
      location,
      type: 'restaurant',
      radius: 10000, // Reduced radius
    });
    
    const additionalRestaurants = additionalRestaurantsRaw.filter(r => isInSameCity(r, cityName));
    
    // Combine restaurants (filter by city)
    const restaurantsMap = new Map();
    restaurants.forEach(r => restaurantsMap.set(r.place_id, r));
    textSearchResults.forEach(resultList => {
      resultList.forEach(r => {
        if (isInSameCity(r, cityName) && !restaurantsMap.has(r.place_id)) {
          restaurantsMap.set(r.place_id, r);
        }
      });
    });
    additionalRestaurants.forEach(r => {
      if (!restaurantsMap.has(r.place_id)) {
        restaurantsMap.set(r.place_id, r);
      }
    });
    const allRestaurants = Array.from(restaurantsMap.values());
    
    rankedRestaurants = rankRestaurants(allRestaurants, params.interests, lat, lng);
  }
  
  // Select at least 3 restaurants (or all available), but limit to maximum 10
  const selectedRestaurantsList = rankedRestaurants.length >= 3
    ? rankedRestaurants.slice(0, Math.min(10, rankedRestaurants.length))
    : rankedRestaurants;

  // Step 3.5: Enrich places with details (website, phone, opening hours) - important for all
  // Also filters by city after enrichment (enriched addresses are more complete)
  let enrichedHotels = await enrichPlacesWithDetails(selectedHotels, cityName);
  
  // CRITICAL: Ensure we always have at least 3 hotels after enrichment, but cap at maximum 5
  // If enrichment filtered some out, try to get more from ranked list
  if (enrichedHotels.length < 3 && rankedHotels.length > selectedHotels.length) {
    const additionalHotels = rankedHotels.slice(selectedHotels.length, selectedHotels.length + 5);
    const additionalEnriched = await enrichPlacesWithDetails(additionalHotels, cityName);
    enrichedHotels = [...enrichedHotels, ...additionalEnriched].slice(0, Math.min(5, Math.max(3, enrichedHotels.length + additionalEnriched.length)));
  }
  
  // If still less than 3, try with lower rating threshold
  if (enrichedHotels.length < 3) {
    const lowerRatedHotels = rankHotels(allHotels, lat, lng, params.interests, 3.5);
    const additionalHotels = lowerRatedHotels
      .filter(h => !enrichedHotels.some(eh => eh.place_id === h.place_id))
      .slice(0, 5);
    if (additionalHotels.length > 0) {
      const additionalEnriched = await enrichPlacesWithDetails(additionalHotels, cityName);
      enrichedHotels = [...enrichedHotels, ...additionalEnriched].slice(0, Math.min(5, Math.max(3, enrichedHotels.length + additionalEnriched.length)));
    }
  }
  
  // Final selection: take at least 3 (or all available if less than 3), but maximum 5
  enrichedHotels = enrichedHotels.slice(0, Math.min(5, Math.max(3, enrichedHotels.length)));
  // Enrich attractions and restaurants with opening hours for itinerary building
  // Enrich more attractions for longer trips (up to 30 for 6+ day trips)
  const enrichCount = Math.min(30, Math.max(15, duration * 5)); // Scale with duration
  const enrichedAttractions = await enrichPlacesWithDetails(selectedAttractions.slice(0, enrichCount), cityName);
  const remainingAttractions = selectedAttractions.slice(enrichCount).filter(a => isInSameCity(a, cityName));
  const allSelectedAttractions = [...enrichedAttractions, ...remainingAttractions];
  
  const enrichedRestaurants = await enrichPlacesWithDetails(selectedRestaurantsList.slice(0, 10), cityName); // Enrich top 10 for itinerary
  const remainingRestaurants = selectedRestaurantsList.slice(10).filter(r => isInSameCity(r, cityName));
  const allSelectedRestaurants = [...enrichedRestaurants, ...remainingRestaurants];

  // Step 4: Validate we have enough activities before building itinerary
  const minActivitiesForItinerary = duration * 3 + 10; // 3 per day + 10 buffer
  
  // If we don't have enough activities, try to get more from ranked list
  if (allSelectedAttractions.length < minActivitiesForItinerary) {
    const additionalNeeded = minActivitiesForItinerary - allSelectedAttractions.length;
    
    // First, try to get more from ranked list
    if (rankedAttractions.length > selectedAttractions.length) {
      const additionalAttractions = rankedAttractions
        .slice(selectedAttractions.length, selectedAttractions.length + additionalNeeded + 20)
        .filter(a => isInSameCity(a, cityName));
      
      if (additionalAttractions.length > 0) {
        allSelectedAttractions.push(...additionalAttractions);
      }
    }
    
    // If still not enough, do additional text searches for activities
    if (allSelectedAttractions.length < minActivitiesForItinerary) {
      console.warn(`Only ${allSelectedAttractions.length} activities found, need ${minActivitiesForItinerary}. Doing additional searches...`);
      
      const additionalActivityQueries = [
        `things to do ${cityName}`,
        `attractions ${cityName}`,
        `tourist attractions ${cityName}`,
        `places to visit ${cityName}`,
        `sights ${cityName}`,
      ];
      
      // Add interest-specific queries
      if (params.interests.includes('museums')) {
        additionalActivityQueries.push(`museums ${cityName}`, `art galleries ${cityName}`);
      }
      if (params.interests.includes('nature')) {
        additionalActivityQueries.push(`parks ${cityName}`, `nature ${cityName}`);
      }
      if (params.interests.includes('nightlife')) {
        additionalActivityQueries.push(`entertainment ${cityName}`, `shopping ${cityName}`, `casinos ${cityName}`);
      }
      
      const additionalTextSearchResults = await Promise.all(
        additionalActivityQueries.map(query => textSearchPlaces(query, location, 'tourist_attraction'))
      );
      
      // Combine and filter
      const additionalActivitiesMap = new Map();
      allSelectedAttractions.forEach(a => additionalActivitiesMap.set(a.place_id, a));
      
      additionalTextSearchResults.forEach(resultList => {
        resultList.forEach(a => {
          if (isInSameCity(a, cityName) && !additionalActivitiesMap.has(a.place_id)) {
            // Only add if it's an activity, not a restaurant
            if (!isFoodPlace(a, true) && isActivityPlace(a)) {
              additionalActivitiesMap.set(a.place_id, a);
            }
          }
        });
      });
      
      const additionalActivities = Array.from(additionalActivitiesMap.values())
        .filter(a => !allSelectedAttractions.some(existing => existing.place_id === a.place_id));
      
      if (additionalActivities.length > 0) {
        // Rank and add the best ones
        const rankedAdditional = rankAttractions(additionalActivities, params.interests, lat, lng);
        const needed = minActivitiesForItinerary - allSelectedAttractions.length;
        allSelectedAttractions.push(...rankedAdditional.slice(0, needed + 10));
        console.log(`Added ${Math.min(needed + 10, rankedAdditional.length)} additional activities from text search`);
      }
    }
  }
  
  // Final check: if we still don't have enough, log a warning
  if (allSelectedAttractions.length < minActivitiesForItinerary) {
    console.warn(`WARNING: Only ${allSelectedAttractions.length} activities available for ${duration} days. Need at least ${minActivitiesForItinerary}. Some days may be incomplete.`);
  }

  const itinerary = buildItinerary(
    enrichedHotels[0] || null,
    allSelectedAttractions,
    allSelectedRestaurants,
    duration,
    params.interests,
    params.startDate
  );

  // Step 5: Convert to TripPlace format
  const allPlaces: TripPlace[] = [
    ...enrichedHotels.map(convertToTripPlace),
    ...selectedAttractions.map(convertToTripPlace),
    ...allSelectedRestaurants.map(convertToTripPlace),
  ];

  // Step 6: Create trip object
  const trip: Trip = {
    destination: params.destination,
    destination_lat: lat,
    destination_lng: lng,
    start_date: params.startDate,
    end_date: params.endDate,
    duration_days: duration,
    interests: params.interests,
    places: allPlaces,
    itinerary,
  };

  return trip;
}

function rankHotels(hotels: any[], centerLat: number, centerLng: number, interests: string[] = [], minRating: number = 3.8): any[] {
  const interestKeywords: Record<string, string[]> = {
    nature: ['nature', 'eco', 'green', 'park', 'garden', 'resort'],
    beach: ['beach', 'seaside', 'coastal', 'ocean', 'waterfront'],
    museums: ['boutique', 'historic', 'heritage', 'cultural'],
    history: ['historic', 'heritage', 'traditional', 'classic'],
    nightlife: ['boutique', 'downtown', 'city center', 'central'],
  };

  return hotels
    .filter(hotel => {
      // Rating filter - strict minimum (default 3.8)
      if (!hotel.rating || hotel.rating < minRating) return false;
      
      // Exclude places that are primarily restaurants/cafes/bars (but be lenient)
      const types = hotel.types || [];
      const isLodging = isLodgingType(types);
      
      // Must have lodging type
      if (!isLodging) return false;
      
      // Only exclude if it's clearly NOT a hotel (restaurant/bar is the first type)
      const firstType = (types[0] as string)?.toLowerCase() || '';
      if (firstType === 'restaurant' || firstType === 'cafe' || firstType === 'bar' || firstType === 'night_club') {
        return false;
      }
      
      // Exclude if night_club is in first 2 types (clearly a nightclub, not a hotel)
      if (types.length >= 2) {
        const firstTwoTypes = types.slice(0, 2).map((t: string) => t.toLowerCase());
        if (firstTwoTypes.includes('night_club') && !firstTwoTypes.includes('lodging') && !firstTwoTypes.includes('hotel')) {
          return false;
        }
      }
      
      return true;
    })
    .map(hotel => {
      const distance = calculateDistance(
        centerLat,
        centerLng,
        hotel.geometry.location.lat,
        hotel.geometry.location.lng
      );
      let score = (hotel.rating || 0) * 2;
      score -= distance / 1000; // Penalize distance
      
      // Boost score based on interests
      const nameLower = hotel.name.toLowerCase();
      const typesLower = (hotel.types || []).join(' ').toLowerCase();
      interests.forEach(interest => {
        const keywords = interestKeywords[interest.toLowerCase()] || [];
        if (keywords.some(keyword => nameLower.includes(keyword) || typesLower.includes(keyword))) {
          score += 2; // Strong boost for matching interests
        }
      });
      
      return { ...hotel, score, distance };
    })
    .sort((a, b) => b.score - a.score);
}

function rankAttractions(attractions: any[], interests: string[], centerLat: number, centerLng: number): any[] {
  const interestKeywords: Record<string, string[]> = {
    museums: ['museum', 'art', 'gallery', 'exhibition', 'collection', 'cultural center'],
    history: ['historic', 'monument', 'castle', 'palace', 'church', 'cathedral', 'heritage', 'archaeological', 'historical'],
    nature: ['park', 'garden', 'nature', 'hiking', 'trail', 'reserve', 'wildlife', 'botanical', 'forest', 'lake'],
    nightlife: ['nightclub', 'bar', 'pub', 'entertainment', 'club', 'music', 'theater', 'show', 'dance', 'night', 'venue', 'concert', 'shopping', 'mall', 'game', 'arcade', 'casino', 'amusement'],
    beach: ['beach', 'coast', 'seaside', 'waterfront', 'marina', 'pier', 'boardwalk', 'promenade', 'seaside', 'ocean'],
    food: ['market', 'food', 'culinary', 'cooking', 'tasting', 'marketplace', 'bazaar'],
  };
  
  const interestTypes: Record<string, string[]> = {
    nightlife: ['night_club', 'bar', 'casino', 'amusement_park', 'shopping_mall', 'store', 'theater', 'movie_theater', 'tourist_attraction', 'point_of_interest'],
    beach: ['beach', 'marina', 'tourist_attraction'],
    nature: ['park', 'zoo', 'aquarium'],
    museums: ['museum', 'art_gallery'],
    history: ['church', 'mosque', 'synagogue', 'hindu_temple', 'tourist_attraction'],
    food: ['tourist_attraction', 'point_of_interest'],
  };

  return attractions
    .filter(attraction => attraction.rating && attraction.rating >= 3.5)
    .map(attraction => {
      const distance = calculateDistance(
        centerLat,
        centerLng,
        attraction.geometry.location.lat,
        attraction.geometry.location.lng
      );
      // Base score from rating (weighted more heavily)
      let score = (attraction.rating || 0) * 3;
      
      // Distance penalty (closer is better)
      score -= distance / 500; // More penalty for distance
      
      // Boost for highly rated places (4.5+ is exceptional)
      if (attraction.rating && attraction.rating >= 4.5) {
        score += 3;
      } else if (attraction.rating && attraction.rating >= 4.0) {
        score += 1.5;
      }

      // Strong boost if matches interests - prioritize matching attractions
      const nameLower = attraction.name.toLowerCase();
      const types = attraction.types || [];
      const typesLower = types.join(' ').toLowerCase();
      let interestMatches = 0;
      
      interests.forEach(interest => {
        const interestLower = interest.toLowerCase();
        const keywords = interestKeywords[interestLower] || [];
        const typeMatches = interestTypes[interestLower] || [];
        
        // Check if name or types match keywords
        const keywordMatch = keywords.some(keyword => 
          nameLower.includes(keyword) || typesLower.includes(keyword)
        );
        
        // Check if types match interest-specific types
        const typeMatch = typeMatches.some(type => 
          types.includes(type)
        );
        
        if (keywordMatch || typeMatch) {
          interestMatches++;
          score += 5; // Very strong boost for matching interests
        }
      });
      
      // Extra boost if multiple interests match
      if (interestMatches > 1) {
        score += 3;
      }
      
      // Penalize if no interests match (but don't exclude)
      if (interestMatches === 0) {
        score -= 5;
      }
      
      // Boost if has many reviews (popularity indicator)
      if (attraction.user_ratings_total) {
        if (attraction.user_ratings_total > 1000) {
          score += 2; // Very popular attraction
        } else if (attraction.user_ratings_total > 500) {
          score += 1.2;
        } else if (attraction.user_ratings_total > 100) {
          score += 0.5;
        }
      }

      return { ...attraction, score, distance, interestMatches };
    })
    .sort((a, b) => {
      // First sort by interest matches (highest first), then by score
      if (a.interestMatches !== b.interestMatches) {
        return b.interestMatches - a.interestMatches;
      }
      return b.score - a.score;
    });
}

function rankRestaurants(restaurants: any[], interests: string[], centerLat: number, centerLng: number): any[] {
  const cuisineKeywords: Record<string, string[]> = {
    food: ['restaurant', 'dining', 'cuisine', 'bistro', 'eatery', 'fine dining'],
    nightlife: ['bar', 'pub', 'tavern', 'cocktail', 'wine', 'brewery'],
    history: ['traditional', 'heritage', 'local', 'authentic', 'regional'],
  };

  return restaurants
    .filter(restaurant => {
      // Keep rating filter at 3.8 or higher
      if (restaurant.rating !== undefined && restaurant.rating < 3.8) {
        return false;
      }
      // If no rating but has many reviews, still include it
      if (!restaurant.rating && (!restaurant.user_ratings_total || restaurant.user_ratings_total < 10)) {
        return false;
      }
      return true;
    })
    .map(restaurant => {
      const distance = calculateDistance(
        centerLat,
        centerLng,
        restaurant.geometry.location.lat,
        restaurant.geometry.location.lng
      );
      // Base score from rating (weighted more heavily)
      let score = (restaurant.rating || 3.5) * 3;
      
      // Distance penalty (closer is better)
      score -= distance / 500; // More penalty for distance
      
      // Boost for highly rated restaurants (4.5+ is exceptional)
      if (restaurant.rating && restaurant.rating >= 4.5) {
        score += 3;
      } else if (restaurant.rating && restaurant.rating >= 4.0) {
        score += 1.5;
      }
      
      // Boost based on interests
      const nameLower = restaurant.name.toLowerCase();
      const typesLower = (restaurant.types || []).join(' ').toLowerCase();
      interests.forEach(interest => {
        const keywords = cuisineKeywords[interest.toLowerCase()] || [];
        if (keywords.some(keyword => nameLower.includes(keyword) || typesLower.includes(keyword))) {
          score += 2; // Strong boost for matching interests
        }
      });

      // Boost if has many reviews (popularity indicator)
      if (restaurant.user_ratings_total) {
        if (restaurant.user_ratings_total > 500) {
          score += 1.5; // Very popular
        } else if (restaurant.user_ratings_total > 100) {
          score += 0.8; // Popular
        } else if (restaurant.user_ratings_total > 50) {
          score += 0.3; // Somewhat popular
        }
      }

      return { ...restaurant, score, distance };
    })
    .sort((a, b) => b.score - a.score);
}

function buildItinerary(
  hotel: any | null,
  attractions: any[],
  restaurants: any[],
  duration: number,
  interests: string[],
  startDate?: string
): ItineraryDay[] {
  const itinerary: ItineraryDay[] = [];
  const usedAttractions = new Set<string>();
  const usedRestaurants = new Set<string>();
  const minActivitiesPerDay = 3; // CRITICAL: Must have at least 3 activities per day

  // Ensure we have enough restaurants for all days (2 per day: lunch + dinner)
  const requiredRestaurants = duration * 2;
  if (restaurants.length < requiredRestaurants) {
    console.warn(`Only ${restaurants.length} restaurants available, but need ${requiredRestaurants} for ${duration} days`);
  }

  // Prioritize attractions that match interests, but ensure variety for nightlife
  const prioritizedAttractions = [...attractions].sort((a, b) => {
    const aMatches = (a.interestMatches || 0);
    const bMatches = (b.interestMatches || 0);
    
    // For nightlife, prioritize variety: don't just pick bars/nightclubs
    if (interests.includes('nightlife')) {
      const aIsBar = (a.types || []).some((t: string) => t === 'bar' || t === 'night_club');
      const bIsBar = (b.types || []).some((t: string) => t === 'bar' || t === 'night_club');
      
      // If one is a bar/nightclub and the other isn't, prefer the non-bar for variety
      if (aIsBar && !bIsBar) return 1;
      if (!aIsBar && bIsBar) return -1;
    }
    
    if (aMatches !== bMatches) return bMatches - aMatches;
    return (b.score || 0) - (a.score || 0);
  });

  // CRITICAL: Check if we have enough activities before starting
  const totalActivitiesNeeded = duration * minActivitiesPerDay;
  const availableActivities = attractions.filter(a => 
    !isFoodPlace(a, true) && isActivityPlace(a)
  ).length;
  
  if (availableActivities < totalActivitiesNeeded) {
    console.warn(`WARNING: Only ${availableActivities} activities available for ${duration} days. Need at least ${totalActivitiesNeeded}. Some days may be incomplete.`);
  }

  for (let day = 0; day < duration; day++) {
    const dayItems: ItineraryItem[] = [];
    let theme = '';
    
    // Track categories used in this day to ensure variety
    const categoriesUsed: Set<string> = new Set();
    
    // Calculate the actual date for this day
    let dayDate: string | undefined;
    let dayOfWeek: number | undefined;
    if (startDate) {
      const start = new Date(startDate);
      start.setDate(start.getDate() + day);
      dayDate = start.toISOString().split('T')[0];
      dayOfWeek = start.getDay();
    }
    
    // CRITICAL: Check remaining activities for remaining days
    const remainingDays = duration - day;
    const remainingActivitiesNeeded = remainingDays * minActivitiesPerDay;
    const unusedActivities = attractions.filter(a => 
      !usedAttractions.has(a.place_id) && !isFoodPlace(a, true) && isActivityPlace(a)
    ).length;
    
    if (unusedActivities < remainingActivitiesNeeded && day > 0) {
      console.warn(`WARNING: Day ${day + 1}: Only ${unusedActivities} unused activities remaining, need ${remainingActivitiesNeeded} for remaining ${remainingDays} days.`);
    }

    // Morning: At least 1-2 attractions (prioritize interest-matching ones, check opening hours)
    // MUST be non-food activities to ensure variety
    // We need at least 3 activities per day total, so morning should have at least 1
    const morningAttractions = prioritizedAttractions
      .filter(a => {
        if (usedAttractions.has(a.place_id)) return false;
        // MUST be an activity, not a food place (for itinerary context)
        if (isFoodPlace(a, true)) return false;
        // For nightlife, we want activities that can work during the day too
        // Check if place is open at morning time (9 AM or 11 AM), but be lenient
        if (dayOfWeek !== undefined && a.opening_hours) {
          const isOpen = isPlaceOpenAtTime(a, dayOfWeek, '09:00') || isPlaceOpenAtTime(a, dayOfWeek, '11:00');
          // If not open, still include if it's a key attraction (high rating or matches interests)
          if (!isOpen && (a.rating >= 4.0 || (a.interestMatches || 0) > 0)) {
            return true; // Include important attractions even if opening hours don't match
          }
          return isOpen;
        }
        return true; // If no opening hours data, include it
      })
      .slice(0, 2); // Can have 1-2 morning activities
    
    // CRITICAL: If we don't have morning attractions, be VERY aggressive (but never reuse)
    if (morningAttractions.length === 0) {
      // First try: any unused activity from prioritized list
      let fallbackMorning = prioritizedAttractions
        .filter(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          return isActivityPlace(a);
        })
        .slice(0, 1);
      
      // Second try: any unused activity from all attractions
      if (fallbackMorning.length === 0) {
        fallbackMorning = attractions
          .filter(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            return isActivityPlace(a);
          })
          .slice(0, 1);
      }
      
      // Third try: be more lenient with activity detection, but still only unused
      if (fallbackMorning.length === 0) {
        fallbackMorning = attractions
          .filter(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            // Accept any place that's not primarily food
            const types = a.types || [];
            const isPrimarilyFood = types[0] === 'restaurant' || types[0] === 'cafe' || types[0] === 'bar';
            return !isPrimarilyFood;
          })
          .slice(0, 1);
      }
      
      morningAttractions.push(...fallbackMorning);
    }
    
    morningAttractions.forEach((attraction, idx) => {
      usedAttractions.add(attraction.place_id);
      
      // Adjust time based on opening hours
      let startTime = idx === 0 ? '09:00' : '11:00';
      let endTime = idx === 0 ? '11:00' : '13:00';
      
      if (dayOfWeek !== undefined && attraction.opening_hours) {
        // Find earliest opening time for this day
        const periods = attraction.opening_hours.periods;
        if (periods) {
          const dayPeriod = periods.find((p: any) => p.open.day === dayOfWeek);
          if (dayPeriod) {
            const openTime = dayPeriod.open.time;
            const [hours, minutes] = openTime.match(/.{2}/g)!.map(Number);
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            // Use opening time if it's later than our default
            if (formattedTime > startTime) {
              startTime = formattedTime;
              // Adjust end time accordingly
              const [startH, startM] = startTime.split(':').map(Number);
              const endH = startH + 2;
              endTime = `${endH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
            }
          }
        }
      }
      
      dayItems.push({
        trip_place_id: attraction.place_id,
        start_time: startTime,
        end_time: endTime,
        order_index: idx,
      });
      
      // Track category
      categoriesUsed.add(getPlaceCategory(attraction));
    });

    // Lunch - ALWAYS include one (check opening hours)
    const availableLunchRestaurants = restaurants.filter(r => {
      if (usedRestaurants.has(r.place_id)) return false;
      // Check if restaurant is open at lunch time (1 PM)
      if (dayOfWeek !== undefined && r.opening_hours) {
        return isPlaceOpenAtTime(r, dayOfWeek, '13:00');
      }
      return true; // If no opening hours data, include it
    });
    
    let lunchRestaurant = availableLunchRestaurants[0];
    
    // If no restaurant is open at lunch, try to find one open around that time
    if (!lunchRestaurant && dayOfWeek !== undefined) {
      lunchRestaurant = restaurants.find(r => {
        if (usedRestaurants.has(r.place_id)) return false;
        if (!r.opening_hours) return true;
        // Check if open between 12-14 (lunch window)
        return isPlaceOpenAtTime(r, dayOfWeek, '12:00') || 
               isPlaceOpenAtTime(r, dayOfWeek, '13:00') || 
               isPlaceOpenAtTime(r, dayOfWeek, '14:00');
      });
    }
    
    // Fallback: use any available restaurant
    if (!lunchRestaurant) {
      lunchRestaurant = restaurants.find(r => !usedRestaurants.has(r.place_id));
    }
    
    if (lunchRestaurant) {
      usedRestaurants.add(lunchRestaurant.place_id);
      
      // Adjust time based on opening hours
      let lunchTime = '13:00';
      if (dayOfWeek !== undefined && lunchRestaurant.opening_hours) {
        const periods = lunchRestaurant.opening_hours.periods;
        if (periods) {
          const dayPeriod = periods.find((p: any) => p.open.day === dayOfWeek);
          if (dayPeriod) {
            const openTime = dayPeriod.open.time;
            const [hours, minutes] = openTime.match(/.{2}/g)!.map(Number);
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            // Use opening time if it's after 1 PM, otherwise use 1 PM
            if (formattedTime > '13:00') {
              lunchTime = formattedTime;
            }
          }
        }
      }
      
      dayItems.push({
        trip_place_id: lunchRestaurant.place_id,
        start_time: lunchTime,
        end_time: '14:30',
        order_index: dayItems.length,
      });
      
      // Track category
      categoriesUsed.add('food');
    }

    // Afternoon: At least 2 more attractions to ensure we have at least 3 activities per day total
    // MUST be non-food activities to ensure variety between meals
    // We need at least 3 activities per day, so if morning has 1, afternoon needs 2
    // If morning has 2, afternoon can have 1-2
    const minAfternoonNeeded = Math.max(2, 3 - morningAttractions.length);
    const afternoonAttractions = prioritizedAttractions
      .filter(a => {
        if (usedAttractions.has(a.place_id)) return false;
        // MUST be an activity, not a food place (we just had lunch)
        if (isFoodPlace(a, true)) return false;
        // Check if place is open at afternoon time (3 PM or 5 PM), but be lenient
        if (dayOfWeek !== undefined && a.opening_hours) {
          const isOpen = isPlaceOpenAtTime(a, dayOfWeek, '15:00') || isPlaceOpenAtTime(a, dayOfWeek, '17:00');
          // If not open, still include if it's a key attraction (high rating or matches interests)
          if (!isOpen && (a.rating >= 4.0 || (a.interestMatches || 0) > 0)) {
            return true; // Include important attractions even if opening hours don't match
          }
          return isOpen;
        }
        return true; // If no opening hours data, include it
      })
      .slice(0, Math.max(minAfternoonNeeded, 2)); // At least minAfternoonNeeded, up to 2
    
    // CRITICAL: If we don't have enough afternoon activities, try MUCH harder (but never reuse)
    if (afternoonAttractions.length === 0) {
      // First try: any unused activity from prioritized list
      let fallbackAttraction = prioritizedAttractions.find(a => {
        if (usedAttractions.has(a.place_id)) return false;
        if (isFoodPlace(a, true)) return false;
        return isActivityPlace(a);
      });
      
      // Second try: any unused activity from all attractions
      if (!fallbackAttraction) {
        fallbackAttraction = attractions.find(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          return isActivityPlace(a);
        });
      }
      
      // Third try: be more lenient with activity detection, but still only unused
      if (!fallbackAttraction) {
        fallbackAttraction = attractions.find(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          // Accept any place that's not primarily food
          const types = a.types || [];
          const isPrimarilyFood = types[0] === 'restaurant' || types[0] === 'cafe' || types[0] === 'bar';
          return !isPrimarilyFood;
        });
      }
      
      if (fallbackAttraction) {
        afternoonAttractions.push(fallbackAttraction);
        usedAttractions.add(fallbackAttraction.place_id);
      }
    }
    
    afternoonAttractions.forEach((attraction, idx) => {
      usedAttractions.add(attraction.place_id);
      
      // Adjust time based on opening hours
      let startTime = idx === 0 ? '15:00' : '17:00';
      let endTime = idx === 0 ? '17:00' : '19:00';
      
      if (dayOfWeek !== undefined && attraction.opening_hours) {
        const periods = attraction.opening_hours.periods;
        if (periods) {
          const dayPeriod = periods.find((p: any) => p.open.day === dayOfWeek);
          if (dayPeriod) {
            const openTime = dayPeriod.open.time;
            const [hours, minutes] = openTime.match(/.{2}/g)!.map(Number);
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            if (formattedTime > startTime) {
              startTime = formattedTime;
              const [startH, startM] = startTime.split(':').map(Number);
              const endH = startH + 2;
              endTime = `${endH.toString().padStart(2, '0')}:${startM.toString().padStart(2, '0')}`;
            }
          }
        }
      }
      
      dayItems.push({
        trip_place_id: attraction.place_id,
        start_time: startTime,
        end_time: endTime,
        order_index: dayItems.length + idx,
      });
      
      // Track category
      categoriesUsed.add(getPlaceCategory(attraction));
    });

    // Dinner - ALWAYS include one (check opening hours)
    const availableDinnerRestaurants = restaurants.filter(r => {
      if (usedRestaurants.has(r.place_id)) return false;
      // Check if restaurant is open at dinner time (7:30 PM)
      if (dayOfWeek !== undefined && r.opening_hours) {
        return isPlaceOpenAtTime(r, dayOfWeek, '19:30') || isPlaceOpenAtTime(r, dayOfWeek, '20:00');
      }
      return true; // If no opening hours data, include it
    });
    
    let dinnerRestaurant = availableDinnerRestaurants[0];
    
    // If no restaurant is open at dinner, try to find one open around that time
    if (!dinnerRestaurant && dayOfWeek !== undefined) {
      dinnerRestaurant = restaurants.find(r => {
        if (usedRestaurants.has(r.place_id)) return false;
        if (!r.opening_hours) return true;
        // Check if open between 18-21 (dinner window)
        return isPlaceOpenAtTime(r, dayOfWeek, '18:00') || 
               isPlaceOpenAtTime(r, dayOfWeek, '19:00') || 
               isPlaceOpenAtTime(r, dayOfWeek, '20:00') ||
               isPlaceOpenAtTime(r, dayOfWeek, '21:00');
      });
    }
    
    // Fallback: use any available restaurant
    if (!dinnerRestaurant) {
      dinnerRestaurant = restaurants.find(r => !usedRestaurants.has(r.place_id));
    }
    
    if (dinnerRestaurant) {
      usedRestaurants.add(dinnerRestaurant.place_id);
      
      // Adjust time based on opening hours
      let dinnerTime = '19:30';
      if (dayOfWeek !== undefined && dinnerRestaurant.opening_hours) {
        const periods = dinnerRestaurant.opening_hours.periods;
        if (periods) {
          const dayPeriod = periods.find((p: any) => p.open.day === dayOfWeek);
          if (dayPeriod) {
            const openTime = dayPeriod.open.time;
            const [hours, minutes] = openTime.match(/.{2}/g)!.map(Number);
            const formattedTime = `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
            // For dinner, if it opens after 7:30 PM, use opening time
            if (formattedTime > '19:30' && formattedTime < '22:00') {
              dinnerTime = formattedTime;
            }
          }
        }
      }
      
      dayItems.push({
        trip_place_id: dinnerRestaurant.place_id,
        start_time: dinnerTime,
        end_time: '21:00',
        order_index: dayItems.length,
      });
      
      // Track category
      categoriesUsed.add('food');
    }
    
    // CRITICAL VALIDATION: We MUST have at least 3 activities per day (not just food)
    // Check what we actually have in the day by looking at the actual places
    const dayPlaces = dayItems.map(item => {
      const attraction = attractions.find(a => a.place_id === item.trip_place_id);
      const restaurant = restaurants.find(r => r.place_id === item.trip_place_id);
      return attraction || restaurant;
    }).filter(Boolean);
    
    const activityCount = dayPlaces.filter(p => p && isActivityPlace(p) && !isFoodPlace(p, false)).length;
    const foodCount = dayPlaces.filter(p => p && isFoodPlace(p, false)).length;
    
    // CRITICAL: We must have at least 3 activities per day (not just food)
    // If we don't have enough activities, be VERY aggressive about finding NEW ones (never reuse)
    if (activityCount < minActivitiesPerDay) {
      const activitiesNeeded = minActivitiesPerDay - activityCount;
      
      // Try to find the needed number of activities
      for (let i = 0; i < activitiesNeeded; i++) {
        let additionalActivity: any = null;
        
        // Try 1: Find any unused activity from prioritized list
        additionalActivity = prioritizedAttractions.find(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          return isActivityPlace(a);
        });
        
        // Try 2: Find any unused activity from all attractions
        if (!additionalActivity) {
          additionalActivity = attractions.find(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            return isActivityPlace(a);
          });
        }
        
        // Try 3: Be more lenient with activity detection, but still only unused
        if (!additionalActivity) {
          additionalActivity = attractions.find(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            // Accept any place that's not primarily food
            const types = a.types || [];
            const isPrimarilyFood = types[0] === 'restaurant' || types[0] === 'cafe' || types[0] === 'bar';
            return !isPrimarilyFood;
          });
        }
        
        if (additionalActivity) {
          usedAttractions.add(additionalActivity.place_id);
          
          // Insert between lunch and dinner (around 16:00 + offset for multiple)
          const lunchIndex = dayItems.findIndex(item => {
            const place = restaurants.find(r => r.place_id === item.trip_place_id);
            return place && isFoodPlace(place, false) && item.start_time && item.start_time >= '13:00' && item.start_time < '15:00';
          });
          
          const insertIndex = lunchIndex >= 0 ? lunchIndex + 1 : Math.max(1, dayItems.length - 1);
          
          // Calculate time slot (spread them out)
          const baseHour = 15 + i; // Start at 15:00, 16:00, 17:00, etc.
          const startTime = `${baseHour.toString().padStart(2, '0')}:00`;
          const endTime = `${(baseHour + 1).toString().padStart(2, '0')}:00`;
          
          dayItems.splice(insertIndex + i, 0, {
            trip_place_id: additionalActivity.place_id,
            start_time: startTime,
            end_time: endTime,
            order_index: insertIndex + i,
          });
        } else {
          // If we can't find more, log a warning
          console.warn(`WARNING: Day ${day + 1} only has ${activityCount} activities, need ${minActivitiesPerDay}. No more unused activities available.`);
          break; // Stop trying if we can't find more
        }
      }
      
      // Update order indices after all insertions
      dayItems.forEach((item, idx) => {
        item.order_index = idx;
      });
    }
    
    // Also ensure we don't have consecutive food places
    // If we have 2+ food places in a row, add an activity between them
    for (let i = 0; i < dayItems.length - 1; i++) {
      const currentPlace = attractions.find(a => a.place_id === dayItems[i].trip_place_id) ||
                          restaurants.find(r => r.place_id === dayItems[i].trip_place_id);
      const nextPlace = attractions.find(a => a.place_id === dayItems[i + 1].trip_place_id) ||
                       restaurants.find(r => r.place_id === dayItems[i + 1].trip_place_id);
      
      if (currentPlace && nextPlace && isFoodPlace(currentPlace, false) && isFoodPlace(nextPlace, false)) {
        // Two food places in a row - add an activity between them
        let activityBetween = prioritizedAttractions.find(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          return true;
        });
        
        // If no activity found, try from all attractions
        if (!activityBetween) {
          activityBetween = attractions.find(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            return isActivityPlace(a);
          });
        }
        
        if (activityBetween) {
          usedAttractions.add(activityBetween.place_id);
          // Calculate time between the two food places
          const currentEnd = dayItems[i].end_time || '14:00';
          const nextStart = dayItems[i + 1].start_time || '19:00';
          
          // Insert activity between them
          dayItems.splice(i + 1, 0, {
            trip_place_id: activityBetween.place_id,
            start_time: currentEnd,
            end_time: nextStart,
            order_index: i + 1,
          });
          
          // Update order indices
          dayItems.forEach((item, idx) => {
            item.order_index = idx;
          });
          
          break; // Only fix one pair at a time
        }
      }
    }

    // FINAL VALIDATION: Double-check we have at least one activity before adding the day
    const finalDayPlaces = dayItems.map(item => {
      const attraction = attractions.find(a => a.place_id === item.trip_place_id);
      const restaurant = restaurants.find(r => r.place_id === item.trip_place_id);
      return attraction || restaurant;
    }).filter(Boolean);
    
    const finalActivityCount = finalDayPlaces.filter(p => {
      if (!p) return false;
      // Must be an activity AND not primarily food
      return isActivityPlace(p) && !isFoodPlace(p, false);
    }).length;
    
    // If we STILL don't have at least 3 activities, this is a critical error
    // Try one more time to find UNUSED activities (never reuse)
    if (finalActivityCount < minActivitiesPerDay && dayItems.length > 0) {
      const activitiesNeeded = minActivitiesPerDay - finalActivityCount;
      console.warn(`CRITICAL: Day ${day + 1} only has ${finalActivityCount} activities, need ${minActivitiesPerDay}. Attempting final search for ${activitiesNeeded} unused activities.`);
      
      // Final attempt: find UNUSED activities
      for (let i = 0; i < activitiesNeeded; i++) {
        let emergencyActivity = attractions.find(a => {
          if (usedAttractions.has(a.place_id)) return false;
          if (isFoodPlace(a, true)) return false;
          return isActivityPlace(a);
        });
        
        // If still nothing, try being more lenient but still only unused
        if (!emergencyActivity) {
          emergencyActivity = attractions.find(a => {
            if (usedAttractions.has(a.place_id)) return false;
            if (isFoodPlace(a, true)) return false;
            const types = a.types || [];
            const isPrimarilyFood = types[0] === 'restaurant' || types[0] === 'cafe' || types[0] === 'bar';
            return !isPrimarilyFood;
          });
        }
        
        if (emergencyActivity) {
          usedAttractions.add(emergencyActivity.place_id);
          // Insert as morning/afternoon activities
          const timeSlot = i === 0 ? { start: '09:00', end: '11:00' } : 
                          i === 1 ? { start: '11:00', end: '13:00' } :
                          { start: '15:00', end: '17:00' };
          
          // Find a good insertion point
          const insertIndex = i < 2 ? i : dayItems.length - 1; // First two go at start, rest before dinner
          
          dayItems.splice(insertIndex, 0, {
            trip_place_id: emergencyActivity.place_id,
            start_time: timeSlot.start,
            end_time: timeSlot.end,
            order_index: insertIndex,
          });
        } else {
          console.error(`ERROR: Day ${day + 1} needs ${activitiesNeeded - i} more activities but no unused activities are available.`);
          break;
        }
      }
      
      // Update all order indices
      dayItems.forEach((item, idx) => {
        item.order_index = idx;
      });
    }

    // Generate theme based on attractions
    if (morningAttractions.length > 0) {
      const firstType = morningAttractions[0].types?.[0] || 'attraction';
      theme = generateTheme(firstType, interests);
    }

    itinerary.push({
      day_index: day,
      theme: theme || `Day ${day + 1}`,
      items: dayItems,
    });
  }

  return itinerary;
}

function generateTheme(type: string, interests: string[]): string {
  const themes: Record<string, string> = {
    museum: 'Museums & Culture',
    art_gallery: 'Art & Culture',
    park: 'Nature & Outdoors',
    restaurant: 'Food & Dining',
    historic: 'History & Heritage',
  };

  if (interests.includes('food') || interests.includes('dining')) {
    return 'Food & Culture';
  }
  if (interests.includes('museums')) {
    return 'Museums & Culture';
  }
  if (interests.includes('nature')) {
    return 'Nature & Outdoors';
  }

  return themes[type] || 'City Exploration';
}

function convertToTripPlace(place: any): TripPlace {
  return {
    place_id: place.place_id,
    name: place.name,
    types: place.types || [],
    rating: place.rating,
    price_level: place.price_level,
    lat: place.geometry.location.lat,
    lng: place.geometry.location.lng,
    address: place.formatted_address,
    photo_reference: place.photos?.[0]?.photo_reference,
    website: place.website,
    phone_number: place.formatted_phone_number,
    opening_hours: place.opening_hours,
    user_ratings_total: place.user_ratings_total,
  };
}

// Helper function to build interest-based keywords for Google Places search
function buildInterestKeywords(interests: string[]): { hotel: string | undefined; attraction: string | undefined; restaurant: string | undefined } {
  const keywordMap: Record<string, { hotel?: string; attraction?: string; restaurant?: string }> = {
    nature: { hotel: 'nature resort', attraction: 'nature park', restaurant: 'organic' },
    beach: { hotel: 'beach hotel', attraction: 'beach', restaurant: 'seafood' },
    museums: { hotel: 'boutique hotel', attraction: 'museum', restaurant: 'fine dining' },
    history: { hotel: 'historic hotel', attraction: 'historic site', restaurant: 'traditional' },
    nightlife: { hotel: 'downtown hotel', attraction: 'entertainment', restaurant: 'bar restaurant' },
    food: { hotel: undefined, attraction: 'food market', restaurant: 'restaurant' },
  };

  // Combine keywords from all interests
  const hotelKeywords: string[] = [];
  const attractionKeywords: string[] = [];
  const restaurantKeywords: string[] = [];

  interests.forEach(interest => {
    const keywords = keywordMap[interest.toLowerCase()];
    if (keywords) {
      if (keywords.hotel) hotelKeywords.push(keywords.hotel);
      if (keywords.attraction) attractionKeywords.push(keywords.attraction);
      if (keywords.restaurant) restaurantKeywords.push(keywords.restaurant);
    }
  });

  return {
    hotel: hotelKeywords.length > 0 ? hotelKeywords[0] : undefined, // Use first keyword
    attraction: attractionKeywords.length > 0 ? attractionKeywords[0] : undefined,
    restaurant: restaurantKeywords.length > 0 ? restaurantKeywords[0] : undefined,
  };
}

function calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371; // Earth's radius in km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) *
      Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c; // Distance in km
}

