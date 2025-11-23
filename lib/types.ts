export interface TripSearchParams {
  destination: string;
  startDate?: string;
  endDate?: string;
  duration?: number;
  interests: string[];
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

export interface TripPlace {
  id?: string;
  trip_id?: string;
  place_id: string;
  name: string;
  types: string[];
  rating?: number;
  price_level?: number;
  lat: number;
  lng: number;
  address?: string;
  photo_reference?: string;
  website?: string;
  phone_number?: string;
  opening_hours?: OpeningHours;
  user_ratings_total?: number;
}

export interface ItineraryDay {
  id?: string;
  trip_id?: string;
  day_index: number;
  theme?: string;
  items: ItineraryItem[];
}

export interface ItineraryItem {
  id?: string;
  day_id?: string;
  trip_place_id: string;
  start_time?: string;
  end_time?: string;
  notes?: string;
  order_index?: number;
  place?: TripPlace;
}

export interface Trip {
  id?: string;
  user_id?: string;
  destination: string;
  destination_lat?: number;
  destination_lng?: number;
  start_date?: string;
  end_date?: string;
  duration_days?: number;
  interests?: string[];
  places?: TripPlace[];
  itinerary?: ItineraryDay[];
}

export interface TripGenerationResult {
  trip: Trip;
  places: TripPlace[];
  itinerary: ItineraryDay[];
}

