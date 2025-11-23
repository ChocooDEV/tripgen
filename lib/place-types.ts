import { TripPlace } from './types';

/**
 * Shared utility functions for checking place types
 * Used by both trip-generator.ts and TripResults.tsx
 */

// Food/restaurant type identifiers
const FOOD_TYPES = [
  'restaurant', 'cafe', 'food', 'meal_takeaway', 'bakery',
  'meal_delivery', 'bistro', 'tavern', 'bar', 'dining_restaurant', 
  'dine_in', 'diner', 'pub_restaurant', 'pub_dining'
];

// Activity/attraction type identifiers
const ACTIVITY_TYPES = [
  'tourist_attraction', 'museum', 'art_gallery', 'park', 'zoo', 'aquarium',
  'amusement_park', 'stadium', 'church', 'mosque', 'synagogue', 'hindu_temple',
  'point_of_interest', 'establishment', 'shopping_mall', 'store', 'library',
  'theater', 'movie_theater', 'casino', 'spa', 'gym', 'night_club', 'bar',
  'bowling', 'mini_golf', 'arcade', 'book_store'
];

// Lodging/hotel type identifiers
const LODGING_TYPES = ['lodging', 'hotel'];

/**
 * Check if a place is a food/restaurant type
 * @param types - Array of place type strings
 * @returns true if the place is a food/restaurant type
 */
export function isRestaurantType(types: string[]): boolean {
  return types.some((t: string) => FOOD_TYPES.includes(t));
}

/**
 * Check if a place is a lodging/hotel type
 * @param types - Array of place type strings
 * @returns true if the place is a lodging type
 */
export function isLodgingType(types: string[]): boolean {
  return types.some((t: string) => LODGING_TYPES.includes(t));
}

/**
 * Check if a place is an activity/attraction type
 * @param types - Array of place type strings
 * @returns true if the place is an activity type
 */
export function isActivityType(types: string[]): boolean {
  return types.some((t: string) => ACTIVITY_TYPES.includes(t));
}

/**
 * Check if a place is a food/restaurant type (for itinerary context)
 * For nightlife, bars and nightclubs can be activities if they're primarily entertainment
 * @param place - Place object with types array
 * @param forItinerary - If true, applies special logic for itinerary building
 * @returns true if the place is a food/restaurant type
 */
export function isFoodPlace(place: { types?: string[] }, forItinerary: boolean = false): boolean {
  const types = place.types || [];
  
  // For itinerary: bars and nightclubs can be activities if they're primarily entertainment
  if (forItinerary) {
    // If it's primarily a bar/nightclub but also has entertainment/activity types, treat as activity
    const hasEntertainmentTypes = types.some((t: string) => 
      t === 'night_club' || t === 'bar' || t === 'establishment'
    );
    const hasActivityTypes = types.some((t: string) => 
      t === 'tourist_attraction' || t === 'point_of_interest' || t === 'amusement_park'
    );
    // If it has both bar/nightclub AND activity types, it's more of an activity
    if (hasEntertainmentTypes && hasActivityTypes) {
      return false; // Treat as activity
    }
  }
  
  return isRestaurantType(types);
}

/**
 * Check if a place is an attraction/activity (not food, not lodging)
 * For nightlife, bars and nightclubs can be activities
 * @param place - Place object with types array
 * @returns true if the place is an activity type
 */
export function isActivityPlace(place: { types?: string[] }): boolean {
  const types = place.types || [];
  
  // For nightlife interests, bars and nightclubs are activities
  // Check if it's primarily an entertainment venue
  const isEntertainment = types.some((type: string) => 
    type === 'night_club' || type === 'bar' || type === 'amusement_park' || type === 'casino'
  );
  
  return isActivityType(types) || isEntertainment;
}

/**
 * Get the category of a place for variety checking
 * @param place - Place object with types array
 * @returns Category: 'food', 'activity', 'lodging', or 'other'
 */
export function getPlaceCategory(place: { types?: string[] }): 'food' | 'activity' | 'lodging' | 'other' {
  const types = place.types || [];
  
  if (isFoodPlace(place, false)) return 'food';
  if (isActivityPlace(place)) return 'activity';
  if (isLodgingType(types)) return 'lodging';
  return 'other';
}

