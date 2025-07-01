import { NextRequest, NextResponse } from 'next/server';
import fs from 'fs';
import path from 'path';

interface AircraftState {
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  time_position: number | null;
  last_contact: number;
  longitude: number | null;
  latitude: number | null;
  baro_altitude: number | null;
  on_ground: boolean;
  velocity: number | null;
  true_track: number | null;
  vertical_rate: number | null;
  geo_altitude: number | null;
  squawk: string | null;
}

interface CacheEntry {
  data: any;
  timestamp: number;
  source: string;
}

// In-memory cache with rate limiting
const cache = new Map<string, CacheEntry>();
const CACHE_DURATION = 2 * 60 * 1000; // 2 minute cache for better API usage
const RATE_LIMIT_DURATION = 10 * 60 * 1000; // 10 minutes between requests after rate limit
let lastRateLimitTime = 0;
let lastSuccessfulRequest = 0;
const MIN_REQUEST_INTERVAL = 60 * 1000; // Minimum 60 seconds between requests

// Mock data generator for development/fallback
function generateMockAircraftData(): AircraftState[] {
  const mockAircraft: AircraftState[] = [];
  const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia', 'Japan', 'Netherlands'];
  const airlines = ['AAL', 'UAL', 'DAL', 'SWA', 'BAW', 'DLH', 'AFR', 'KLM'];
  
  for (let i = 0; i < 50; i++) {
    const isAirborne = Math.random() > 0.3;
    const lat = (Math.random() - 0.5) * 160; // -80 to 80
    const lon = (Math.random() - 0.5) * 360; // -180 to 180
    
    mockAircraft.push({
      icao24: Math.random().toString(16).substr(2, 6),
      callsign: Math.random() > 0.2 ? airlines[Math.floor(Math.random() * airlines.length)] + Math.floor(Math.random() * 9999) : null,
      origin_country: countries[Math.floor(Math.random() * countries.length)],
      time_position: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 60),
      last_contact: Math.floor(Date.now() / 1000),
      longitude: lon,
      latitude: lat,
      baro_altitude: isAirborne ? Math.floor(Math.random() * 40000) + 5000 : null,
      on_ground: !isAirborne,
      velocity: isAirborne ? Math.floor(Math.random() * 500) + 200 : Math.floor(Math.random() * 50),
      true_track: Math.floor(Math.random() * 360),
      vertical_rate: isAirborne ? (Math.random() - 0.5) * 3000 : 0,
      geo_altitude: isAirborne ? Math.floor(Math.random() * 40000) + 5000 : null,
      squawk: Math.floor(Math.random() * 10000).toString().padStart(4, '0')
    });
  }
  
  return mockAircraft;
}

async function fetchFromFlightAware(apiKey: string): Promise<AircraftState[]> {
  const response = await fetch('https://aeroapi.flightaware.com/aeroapi/flights/search', {
    method: 'GET',
    headers: {
      'x-apikey': apiKey,
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`FlightAware API error: ${response.status} ${response.statusText}`);
  }

  const data = await response.json();
  const flights = data.flights || [];

  // Transform FlightAware data to our format
  return flights.map((flight: any) => ({
    icao24: flight.ident_icao || flight.ident || Math.random().toString(16).substr(2, 6),
    callsign: flight.ident,
    origin_country: flight.origin?.country_code || 'Unknown',
    time_position: Math.floor(Date.now() / 1000),
    last_contact: Math.floor(Date.now() / 1000),
    longitude: flight.last_position?.longitude || null,
    latitude: flight.last_position?.latitude || null,
    baro_altitude: flight.last_position?.altitude || null,
    on_ground: flight.status === 'Scheduled' || flight.status === 'Departed',
    velocity: flight.last_position?.groundspeed || null,
    true_track: flight.last_position?.heading || null,
    vertical_rate: null,
    geo_altitude: flight.last_position?.altitude || null,
    squawk: null
  })).filter((aircraft: AircraftState) => aircraft.longitude !== null && aircraft.latitude !== null);
}

async function fetchFromAviationEdge(apiKey: string): Promise<AircraftState[]> {
  const response = await fetch(`https://aviation-edge.com/v2/public/flights?key=${apiKey}&limit=100`, {
    method: 'GET',
    headers: {
      'Accept': 'application/json'
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw new Error(`Aviation Edge API error: ${response.status} ${response.statusText}`);
  }

  const flights = await response.json();

  // Transform Aviation Edge data to our format
  return flights.map((flight: any) => ({
    icao24: flight.aircraft?.icaoCode || flight.flight?.icaoNumber || Math.random().toString(16).substr(2, 6),
    callsign: flight.flight?.iataNumber || flight.flight?.icaoNumber,
    origin_country: flight.departure?.country || 'Unknown',
    time_position: Math.floor(Date.now() / 1000),
    last_contact: Math.floor(Date.now() / 1000),
    longitude: parseFloat(flight.geography?.longitude) || null,
    latitude: parseFloat(flight.geography?.latitude) || null,
    baro_altitude: parseInt(flight.geography?.altitude) || null,
    on_ground: flight.status === 'scheduled' || flight.status === 'active',
    velocity: parseInt(flight.speed?.horizontal) || null,
    true_track: parseInt(flight.geography?.direction) || null,
    vertical_rate: parseInt(flight.speed?.vertical) || null,
    geo_altitude: parseInt(flight.geography?.altitude) || null,
    squawk: null
  })).filter((aircraft: AircraftState) => aircraft.longitude !== null && aircraft.latitude !== null);
}

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    const cacheKey = 'aircraft_states';
    
    // Check if we're still in rate limit cooldown
    if (lastRateLimitTime > 0 && (now - lastRateLimitTime) < RATE_LIMIT_DURATION) {
      const waitTime = Math.ceil((RATE_LIMIT_DURATION - (now - lastRateLimitTime)) / 1000);
      console.log(`Still in rate limit cooldown. ${waitTime} seconds remaining.`);
      
      // Return cached data if available
      const cached = cache.get(cacheKey);
      if (cached) {
        return NextResponse.json({
          ...cached.data,
          fromCache: true,
          rateLimited: true,
          waitTime,
          message: `Rate limited. Using cached data. Try again in ${waitTime} seconds.`
        });
      }
    }

    // Check if we need to respect minimum interval
    if (lastSuccessfulRequest > 0 && (now - lastSuccessfulRequest) < MIN_REQUEST_INTERVAL) {
      const cached = cache.get(cacheKey);
      if (cached) {
        console.log('Using cached data due to minimum request interval');
        return NextResponse.json({
          ...cached.data,
          fromCache: true,
          message: 'Using cached data to respect rate limits'
        });
      }
    }

    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached && (now - cached.timestamp) < CACHE_DURATION) {
      console.log(`Serving from cache (source: ${cached.source})`);
      return NextResponse.json({
        ...cached.data,
        fromCache: true
      });
    }

    // Load credentials
    const credentialsPath = path.join(process.cwd(), 'credentials.json');
    let credentials = null;
    
    if (fs.existsSync(credentialsPath)) {
      const credentialsData = fs.readFileSync(credentialsPath, 'utf8');
      credentials = JSON.parse(credentialsData);
    }

    let aircraftData: AircraftState[] = [];
    let dataSource = 'mock';
    let isAuthenticated = false;

    try {
      // Try FlightAware first if API key is available
      if (credentials?.flightAwareApiKey) {
        console.log('Attempting FlightAware API...');
        aircraftData = await fetchFromFlightAware(credentials.flightAwareApiKey);
        dataSource = 'flightaware';
        isAuthenticated = true;
      }
      // Try Aviation Edge if FlightAware fails or isn't available
      else if (credentials?.aviationEdgeApiKey) {
        console.log('Attempting Aviation Edge API...');
        aircraftData = await fetchFromAviationEdge(credentials.aviationEdgeApiKey);
        dataSource = 'aviationedge';
        isAuthenticated = true;
      }
      // Fallback to mock data if no API keys available
      else {
        console.log('No API keys found, using mock data');
        aircraftData = generateMockAircraftData();
        dataSource = 'mock';
      }

      // Reset rate limit tracking on successful request
      lastRateLimitTime = 0;
      lastSuccessfulRequest = now;

    } catch (apiError) {
      console.error(`API error from ${dataSource}:`, apiError);
      
      // Handle rate limiting
      if (apiError instanceof Error && apiError.message.includes('429')) {
        lastRateLimitTime = now;
        console.log('Rate limited - setting cooldown period');
        
        // Return cached data if available
        const cached = cache.get(cacheKey);
        if (cached) {
          return NextResponse.json({
            ...cached.data,
            fromCache: true,
            rateLimited: true,
            message: 'Rate limited. Using cached data.',
            waitTime: Math.ceil(RATE_LIMIT_DURATION / 1000)
          });
        }
      }

      // Fallback to mock data on any API error
      console.log('API failed, falling back to mock data');
      aircraftData = generateMockAircraftData();
      dataSource = 'mock';
      isAuthenticated = false;
    }

    // Calculate statistics
    const airborne = aircraftData.filter(a => !a.on_ground).length;
    const ground = aircraftData.filter(a => a.on_ground).length;
    const countries = new Set(aircraftData.map(a => a.origin_country).filter(Boolean)).size;

    const responseData = {
      aircraft: aircraftData,
      stats: {
        totalAircraft: aircraftData.length,
        airborneAircraft: airborne,
        groundAircraft: ground,
        trackedCountries: countries
      },
      timestamp: new Date().toISOString(),
      authenticated: isAuthenticated,
      dataSource,
      fromCache: false,
      credentialsFound: !!(credentials?.flightAwareApiKey || credentials?.aviationEdgeApiKey)
    };

    // Cache the response
    cache.set(cacheKey, {
      data: responseData,
      timestamp: now,
      source: dataSource
    });

    console.log(`Successfully fetched ${aircraftData.length} aircraft from ${dataSource}`);

    return NextResponse.json(responseData);

  } catch (error) {
    console.error('Failed to fetch live aircraft data:', error);
    
    // Try to return cached data even on error
    const cached = cache.get('aircraft_states');
    if (cached) {
      return NextResponse.json({
        ...cached.data,
        fromCache: true,
        error: 'API error - using cached data',
        message: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }

    // Final fallback to mock data
    const mockData = generateMockAircraftData();
    const airborne = mockData.filter(a => !a.on_ground).length;
    const ground = mockData.filter(a => a.on_ground).length;
    const countries = new Set(mockData.map(a => a.origin_country).filter(Boolean)).size;

    return NextResponse.json({
      aircraft: mockData,
      stats: {
        totalAircraft: mockData.length,
        airborneAircraft: airborne,
        groundAircraft: ground,
        trackedCountries: countries
      },
      timestamp: new Date().toISOString(),
      authenticated: false,
      dataSource: 'mock',
      fromCache: false,
      error: 'All APIs failed - using mock data',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}