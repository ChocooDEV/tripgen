# Setup Guide

## Quick Start

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Set up Supabase**
   - Create account at [supabase.com](https://supabase.com)
   - Create a new project
   - Go to SQL Editor
   - Run the SQL from `supabase/migrations/001_initial_schema.sql`
   - Copy your project URL and anon key from Settings > API

3. **Set up Google Places API**
   - Go to [Google Cloud Console](https://console.cloud.google.com/)
   - Create/select a project
   - Enable APIs:
     - Places API
     - Geocoding API
   - Create API key (restrict it for production)

4. **Create `.env.local` file**
   ```env
   NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
   GOOGLE_PLACES_API_KEY=your-google-api-key
   ```

5. **Run the app**
   ```bash
   npm run dev
   ```

## Database Setup

The migration file creates:
- All necessary tables with proper relationships
- Indexes for performance
- Row Level Security (RLS) policies
- Triggers for updated_at timestamps

Run the migration in Supabase SQL Editor.

## Environment Variables

### Required
- `NEXT_PUBLIC_SUPABASE_URL` - Your Supabase project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` - Your Supabase anon/public key
- `GOOGLE_PLACES_API_KEY` - Server-side Google Places API key
- `NEXT_PUBLIC_GOOGLE_PLACES_API_KEY` - Client-side key for photo URLs

**Note**: In production, consider proxying photo requests through your API to avoid exposing the API key.

## Troubleshooting

### "GOOGLE_PLACES_API_KEY is not set"
- Make sure `.env.local` exists in the root directory
- Restart the dev server after adding environment variables
- Check that variable names match exactly (case-sensitive)

### "Unauthorized" errors
- Verify Supabase credentials are correct
- Check that RLS policies are set up correctly
- Ensure user is logged in when trying to save trips

### No results from Google Places
- Verify API key is valid
- Check that Places API and Geocoding API are enabled
- Check API quotas/billing in Google Cloud Console

