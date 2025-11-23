const GOOGLE_PLACES_API_KEY = process.env.GOOGLE_PLACES_API_KEY;
const GOOGLE_PLACES_API_BASE = 'https://maps.googleapis.com/maps/api';

export interface GeocodeResult {
  lat: number;
  lng: number;
  formatted_address: string;
  city?: string; // Extracted city name
}

export async function geocodeAddress(address: string): Promise<GeocodeResult | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const url = `${GOOGLE_PLACES_API_BASE}/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const result = data.results[0];
      
      // Extract city name from address components
      let city: string | undefined;
      if (result.address_components) {
        // Look for locality (city) or administrative_area_level_2
        const cityComponent = result.address_components.find((comp: any) => 
          comp.types.includes('locality') || 
          comp.types.includes('administrative_area_level_2') ||
          comp.types.includes('administrative_area_level_1')
        );
        city = cityComponent?.long_name;
      }
      
      // Fallback: extract city from formatted_address (usually first part before comma)
      if (!city && result.formatted_address) {
        const parts = result.formatted_address.split(',');
        city = parts[0]?.trim();
      }
      
      return {
        lat: result.geometry.location.lat,
        lng: result.geometry.location.lng,
        formatted_address: result.formatted_address,
        city: city || result.formatted_address.split(',')[0]?.trim(),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Geocoding error:', error);
    return null;
  }
}

export interface PlaceSearchParams {
  location: string; // "lat,lng"
  radius?: number; // in meters, default 5000
  type?: string; // lodging, restaurant, tourist_attraction, etc.
  keyword?: string;
  minPrice?: number;
  maxPrice?: number;
}

export interface OpeningHours {
  open_now?: boolean;
  weekday_text?: string[];
  periods?: Array<{
    open: { day: number; time: string };
    close?: { day: number; time: string };
  }>;
}

export interface GooglePlace {
  place_id: string;
  name: string;
  types: string[];
  rating?: number;
  price_level?: number;
  geometry: {
    location: {
      lat: number;
      lng: number;
    };
  };
  formatted_address?: string;
  photos?: Array<{
    photo_reference: string;
  }>;
  website?: string;
  formatted_phone_number?: string;
  user_ratings_total?: number;
  opening_hours?: OpeningHours;
  editorial_summary?: string;
  reviews?: Array<{
    author_name: string;
    rating: number;
    text: string;
  }>;
}

export async function searchPlaces(params: PlaceSearchParams): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const { location, radius = 5000, type, keyword, minPrice, maxPrice } = params;
  const allResults: GooglePlace[] = [];
  let nextPageToken: string | null = null;
  let requestCount = 0;
  const maxRequests = 3; // Get up to 60 results (20 per page)

  do {
    let url = `${GOOGLE_PLACES_API_BASE}/place/nearbysearch/json?location=${location}&radius=${radius}&key=${GOOGLE_PLACES_API_KEY}`;
    
    if (type) {
      url += `&type=${type}`;
    }
    
    if (keyword) {
      url += `&keyword=${encodeURIComponent(keyword)}`;
    }
    
    if (minPrice !== undefined) {
      url += `&minprice=${minPrice}`;
    }
    
    if (maxPrice !== undefined) {
      url += `&maxprice=${maxPrice}`;
    }

    if (nextPageToken) {
      url += `&pagetoken=${nextPageToken}`;
    }

    try {
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.status === 'OK' && data.results) {
        const places = data.results.map((place: any) => ({
          place_id: place.place_id,
          name: place.name,
          types: place.types || [],
          rating: place.rating,
          price_level: place.price_level,
          geometry: place.geometry,
          formatted_address: place.vicinity || place.formatted_address,
          photos: place.photos,
          user_ratings_total: place.user_ratings_total,
        }));
        allResults.push(...places);
      }

      // Check for next page
      nextPageToken = data.next_page_token || null;
      requestCount++;

      // If there's a next page, wait a bit (Google requires a delay between page requests)
      if (nextPageToken && requestCount < maxRequests) {
        await new Promise(resolve => setTimeout(resolve, 2000)); // 2 second delay
      } else {
        nextPageToken = null; // Stop pagination
      }
    } catch (error) {
      console.error('Places search error:', error);
      break;
    }
  } while (nextPageToken && requestCount < maxRequests);
  
  return allResults;
}

export async function getPlaceDetails(placeId: string): Promise<GooglePlace | null> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  const fields = 'place_id,name,types,rating,price_level,geometry,formatted_address,photos,website,formatted_phone_number,user_ratings_total,opening_hours,editorial_summary,reviews';
  const url = `${GOOGLE_PLACES_API_BASE}/place/details/json?place_id=${placeId}&fields=${fields}&key=${GOOGLE_PLACES_API_KEY}`;
  
  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.result) {
      const place = data.result;
      return {
        place_id: place.place_id,
        name: place.name,
        types: place.types || [],
        rating: place.rating,
        price_level: place.price_level,
        geometry: place.geometry,
        formatted_address: place.formatted_address,
        photos: place.photos,
        website: place.website,
        formatted_phone_number: place.formatted_phone_number,
        user_ratings_total: place.user_ratings_total,
        opening_hours: place.opening_hours ? {
          open_now: place.opening_hours.open_now,
          weekday_text: place.opening_hours.weekday_text,
          periods: place.opening_hours.periods,
        } : undefined,
        editorial_summary: place.editorial_summary?.overview,
        reviews: place.reviews?.slice(0, 3).map((r: any) => ({
          author_name: r.author_name,
          rating: r.rating,
          text: r.text,
        })),
      };
    }
    
    return null;
  } catch (error) {
    console.error('Place details error:', error);
    return null;
  }
}

// Google Places Text Search for better interest-based results
export async function textSearchPlaces(query: string, location: string, type?: string): Promise<GooglePlace[]> {
  if (!GOOGLE_PLACES_API_KEY) {
    throw new Error('GOOGLE_PLACES_API_KEY is not set');
  }

  let url = `${GOOGLE_PLACES_API_BASE}/place/textsearch/json?query=${encodeURIComponent(query)}&location=${location}&key=${GOOGLE_PLACES_API_KEY}`;
  
  if (type) {
    url += `&type=${type}`;
  }

  try {
    const response = await fetch(url);
    const data = await response.json();
    
    if (data.status === 'OK' && data.results) {
      return data.results.map((place: any) => ({
        place_id: place.place_id,
        name: place.name,
        types: place.types || [],
        rating: place.rating,
        price_level: place.price_level,
        geometry: place.geometry,
        formatted_address: place.formatted_address,
        photos: place.photos,
        user_ratings_total: place.user_ratings_total,
      }));
    }
    
    return [];
  } catch (error) {
    console.error('Text search error:', error);
    return [];
  }
}

export function getPhotoUrl(photoReference: string, maxWidth: number = 400): string {
  if (!GOOGLE_PLACES_API_KEY) {
    return '';
  }
  return `${GOOGLE_PLACES_API_BASE}/place/photo?maxwidth=${maxWidth}&photo_reference=${photoReference}&key=${GOOGLE_PLACES_API_KEY}`;
}

