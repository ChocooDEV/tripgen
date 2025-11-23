# Setup Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Google Places API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable APIs:
     - Places API
     - Geocoding API
   - Create API key (restrict it for production)

3. **Create `.env.local` file**
   ```env
   GOOGLE_PLACES_API_KEY=your-google-api-key
   ```

4. **Run the app**
   ```bash
   npm run dev
   ```

## Environment Variables

### Required
- `GOOGLE_PLACES_API_KEY` - Server-side Google Places API key

**Note**: The Google Places API key is kept server-side only. Photo URLs are proxied through `/api/places/photo` to avoid exposing the key to the client.

## Troubleshooting

### "GOOGLE_PLACES_API_KEY is not set"
- Make sure `.env.local` exists in the root directory
- Restart the dev server after adding environment variables
- Check that variable names match exactly (case-sensitive)

### No results from Google Places
- Verify API key is valid
- Check that Places API and Geocoding API are enabled
- Check API quotas/billing in Google Cloud Console

