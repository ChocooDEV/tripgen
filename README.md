# TripGen - Powered Trip Planner

A Next.js application that helps users plan trips by recommending stays, restaurants, and activities based on their preferences. Built with Next.js, TypeScript, Tailwind CSS, and Google Places API.

## Features

- 🔍 **Smart Search**: Enter a destination and get personalized recommendations
- 🏨 **Accommodation Recommendations**: Find hotels based on location and interests
- 🍽️ **Restaurant Suggestions**: Discover restaurants matching your interests
- 🎯 **Activity Planning**: Get curated tourist attractions and activities (minimum 3 per day)
- 📅 **Day-by-Day Itinerary**: Automatically generated itinerary with time slots
- 🗺️ **Google Maps Integration**: Export your itinerary directly to Google Maps with waypoints

## Tech Stack

- **Frontend**: Next.js, React, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes
- **External APIs**: Google Places API, Google Maps
- **Image Optimization**: Next.js Image with WebP/AVIF support

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd tripgen
```

### 2. Install dependencies

```bash
npm install
```

### 3. Optimize Images (Optional but Recommended)

For faster loading, optimize the landing page image:

```bash
npm install sharp --save-dev
npm run optimize-image
```

This will create optimized versions of the landing page image.

### 4. Set up Google Places API

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Enable the following APIs:
   - Places API
   - Geocoding API
4. Create an API key and restrict it to your domain (for production)

### 5. Configure environment variables

Create a `.env.local` file in the root directory:

```env
GOOGLE_PLACES_API_KEY=your_google_places_api_key
```

**Note**: The Google Places API key is kept server-side only. Photo URLs are proxied through `/api/places/photo` to avoid exposing the key to the client.

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Image Optimization

The landing page uses a large background image. For best performance:

1. **Automatic Optimization**: Next.js automatically optimizes images using the `next/image` component
2. **Manual Optimization**: Run `npm run optimize-image` to create compressed versions
3. **Format Support**: Next.js serves WebP/AVIF formats when supported by the browser
4. **Lazy Loading**: Images below the fold are lazy-loaded automatically


## Project Structure

```
tripgen/
├── app/
│   ├── api/
│   │   ├── places/        # Places API (autocomplete, photos)
│   │   └── trips/         # Trip generation
│   ├── page.tsx           # Main page
│   └── layout.tsx         # Root layout
├── components/
│   ├── LandingPage.tsx    # Landing page with hero section
│   ├── SearchForm.tsx     # Trip search form
│   └── TripResults.tsx    # Results and itinerary display
├── lib/
│   ├── google-places.ts   # Google Places API utilities
│   ├── trip-generator.ts  # Trip generation logic
│   ├── place-types.ts     # Place type checking utilities
│   └── types.ts           # TypeScript type definitions
└── scripts/
    └── optimize-image.js  # Image optimization script
```

## Usage

1. **Search for a Trip**:
   - Enter a destination city (with autocomplete suggestions)
   - Set start and end dates (or the system will calculate duration)
   - Select your interests (food, museums, nature, history, nightlife, beach)
   - Click "Generate Trip"

2. **Review Recommendations**:
   - Browse recommended hotels (3-5 options), restaurants (up to 10), and activities
   - View the day-by-day itinerary with time slots
   - Each day includes at least 3 activities plus lunch and dinner
   - Collapsible sections for easy navigation

3. **Export to Google Maps**:
   - Click "Add to Google Maps" button in the trip header
   - All places from your itinerary will be added as waypoints
   - Google Maps will open in a new tab with a route showing all your planned stops
   - Supports up to 25 waypoints (Google Maps limit)

## API Endpoints

### Trip Generation
- `POST /api/trips/generate` - Generate a trip based on search parameters

### Places
- `GET /api/places/autocomplete` - Get destination autocomplete suggestions
- `GET /api/places/photo` - Proxy for Google Places photos (server-side only)

## Trip Generation Logic

The app ensures comprehensive trip planning:

- **Minimum Activities**: At least 3 activities per day (never just restaurants)
- **Activity Variety**: Diverse activities including museums, parks, shopping, entertainment
- **No Duplicates**: Each activity is used only once across all days
- **Smart Distribution**: Activities are distributed evenly across all days
- **Opening Hours**: Considers place opening hours when scheduling
- **Interest Matching**: Prioritizes places that match your selected interests

## License

MIT
