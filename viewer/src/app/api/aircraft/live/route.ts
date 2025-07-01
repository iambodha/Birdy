import { NextRequest, NextResponse } from 'next/server';

// Required for static export
export const dynamic = 'force-dynamic';

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

// Enhanced mock data generator for more realistic aircraft distribution
function generateMockAircraftData(): AircraftState[] {
  const mockAircraft: AircraftState[] = [];
  const countries = [
    'United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia', 
    'Japan', 'Netherlands', 'Switzerland', 'Sweden', 'Norway', 'Spain', 'Italy',
    'Brazil', 'Mexico', 'India', 'China', 'South Korea', 'Singapore', 'UAE'
  ];
  const airlines = [
    'AAL', 'UAL', 'DAL', 'SWA', 'BAW', 'DLH', 'AFR', 'KLM', 'EZY', 'RYR',
    'LUV', 'JBU', 'VIR', 'EIN', 'SAS', 'FIN', 'THY', 'QTR', 'EK', 'SIA',
    'JAL', 'ANA', 'CPA', 'EVA', 'TAM', 'GOL', 'AMX', 'ACA', 'WJA'
  ];
  
  // Generate more aircraft for a realistic demo
  const numAircraft = Math.floor(Math.random() * 300) + 200; // 200-500 aircraft
  
  for (let i = 0; i < numAircraft; i++) {
    const isAirborne = Math.random() > 0.25; // 75% airborne, 25% on ground
    
    // More realistic geographic distribution
    let lat, lon;
    if (Math.random() > 0.3) {
      // 70% concentrated around major flight corridors
      const corridors = [
        { lat: 40, lon: -75 }, // US East Coast
        { lat: 34, lon: -118 }, // US West Coast
        { lat: 51, lon: 0 }, // UK/Europe
        { lat: 49, lon: 2 }, // France/Central Europe
        { lat: 52, lon: 5 }, // Netherlands/Northern Europe
        { lat: 35, lon: 139 }, // Japan
        { lat: 1, lon: 103 }, // Singapore
        { lat: 25, lon: 55 }, // UAE
        { lat: -33, lon: 151 }, // Australia East
        { lat: 45, lon: -73 }, // Canada East
      ];
      
      const corridor = corridors[Math.floor(Math.random() * corridors.length)];
      lat = corridor.lat + (Math.random() - 0.5) * 20; // ±10 degrees
      lon = corridor.lon + (Math.random() - 0.5) * 30; // ±15 degrees
    } else {
      // 30% scattered globally
      lat = (Math.random() - 0.5) * 160; // -80 to 80
      lon = (Math.random() - 0.5) * 360; // -180 to 180
    }
    
    // Ensure coordinates are within valid bounds
    lat = Math.max(-85, Math.min(85, lat));
    lon = Math.max(-180, Math.min(180, lon));
    
    const altitude = isAirborne ? 
      Math.floor(Math.random() * 35000) + 5000 : // 5,000-40,000 ft for airborne
      Math.floor(Math.random() * 100); // 0-100 ft for ground
    
    const velocity = isAirborne ?
      Math.floor(Math.random() * 400) + 200 : // 200-600 kt for airborne
      Math.floor(Math.random() * 50); // 0-50 kt for ground
    
    const verticalRate = isAirborne ?
      (Math.random() - 0.5) * 4000 : // ±2000 ft/min for airborne
      0; // 0 for ground
    
    mockAircraft.push({
      icao24: Math.random().toString(16).substr(2, 6).toLowerCase(),
      callsign: Math.random() > 0.15 ? 
        airlines[Math.floor(Math.random() * airlines.length)] + Math.floor(Math.random() * 9999).toString().padStart(4, '0') : 
        null,
      origin_country: countries[Math.floor(Math.random() * countries.length)],
      time_position: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 60),
      last_contact: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 30),
      longitude: parseFloat(lon.toFixed(4)),
      latitude: parseFloat(lat.toFixed(4)),
      baro_altitude: altitude,
      on_ground: !isAirborne,
      velocity: velocity,
      true_track: Math.floor(Math.random() * 360),
      vertical_rate: Math.round(verticalRate),
      geo_altitude: altitude + Math.floor(Math.random() * 200) - 100, // Slight variation from baro
      squawk: Math.random() > 0.3 ? 
        Math.floor(Math.random() * 10000).toString().padStart(4, '0') : 
        null
    });
  }
  
  return mockAircraft;
}

// Cache for consistent data across requests
let cachedData: {
  aircraft: AircraftState[];
  timestamp: number;
  stats: any;
} | null = null;

const CACHE_DURATION = 30 * 1000; // 30 seconds cache

export async function GET(request: NextRequest) {
  try {
    const now = Date.now();
    
    // Check if we have valid cached data
    if (cachedData && (now - cachedData.timestamp) < CACHE_DURATION) {
      return NextResponse.json({
        ...cachedData,
        fromCache: true,
        message: 'Demo mode - using mock data'
      });
    }
    
    // Generate new mock data
    const aircraftData = generateMockAircraftData();
    
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
      authenticated: false,
      dataSource: 'mock',
      fromCache: false,
      message: 'Demo mode - using realistic mock data'
    };
    
    // Cache the response
    cachedData = {
      aircraft: aircraftData,
      timestamp: now,
      stats: responseData.stats
    };
    
    // Simulate some loading time for realism
    await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
    
    return NextResponse.json(responseData);
    
  } catch (error) {
    console.error('Failed to generate mock aircraft data:', error);
    
    // Fallback to minimal mock data
    const fallbackData = [];
    for (let i = 0; i < 10; i++) {
      fallbackData.push({
        icao24: Math.random().toString(16).substr(2, 6),
        callsign: `DEMO${i.toString().padStart(3, '0')}`,
        origin_country: 'Demo Country',
        time_position: Math.floor(Date.now() / 1000),
        last_contact: Math.floor(Date.now() / 1000),
        longitude: (Math.random() - 0.5) * 360,
        latitude: (Math.random() - 0.5) * 160,
        baro_altitude: Math.floor(Math.random() * 40000),
        on_ground: false,
        velocity: Math.floor(Math.random() * 500) + 200,
        true_track: Math.floor(Math.random() * 360),
        vertical_rate: 0,
        geo_altitude: Math.floor(Math.random() * 40000),
        squawk: null
      });
    }
    
    return NextResponse.json({
      aircraft: fallbackData,
      stats: {
        totalAircraft: fallbackData.length,
        airborneAircraft: fallbackData.length,
        groundAircraft: 0,
        trackedCountries: 1
      },
      timestamp: new Date().toISOString(),
      authenticated: false,
      dataSource: 'fallback',
      fromCache: false,
      error: 'Failed to generate mock data - using fallback',
      message: error instanceof Error ? error.message : 'Unknown error occurred'
    });
  }
}