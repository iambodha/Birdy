export interface AircraftState {
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

export interface MapStats {
  totalAircraft: number;
  airborneAircraft: number;
  groundAircraft: number;
  trackedCountries: number;
}

// Generate mock live aircraft data
function generateMockLiveAircraft(): AircraftState[] {
  const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada', 'Australia', 'Japan', 'Netherlands', 'Spain', 'Italy'];
  const airlines = ['AAL', 'UAL', 'DAL', 'SWA', 'BAW', 'DLH', 'AFR', 'KLM', 'IBE', 'AZA'];
  
  const aircraft: AircraftState[] = [];
  
  for (let i = 0; i < 75; i++) {
    const isAirborne = Math.random() > 0.3;
    const lat = (Math.random() - 0.5) * 160; // -80 to 80
    const lon = (Math.random() - 0.5) * 360; // -180 to 180
    
    aircraft.push({
      icao24: Math.random().toString(16).substr(2, 6),
      callsign: Math.random() > 0.2 ? airlines[Math.floor(Math.random() * airlines.length)] + Math.floor(Math.random() * 9999).toString().padStart(3, '0') : null,
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
  
  return aircraft;
}

export const mockLiveAircraft = generateMockLiveAircraft();

export function getLiveAircraftData(): {
  aircraft: AircraftState[];
  stats: MapStats;
  timestamp: string;
  authenticated: boolean;
  dataSource: string;
  fromCache: boolean;
} {
  const aircraft = mockLiveAircraft;
  const airborne = aircraft.filter(a => !a.on_ground).length;
  const ground = aircraft.filter(a => a.on_ground).length;
  const countries = new Set(aircraft.map(a => a.origin_country).filter(Boolean)).size;

  return {
    aircraft,
    stats: {
      totalAircraft: aircraft.length,
      airborneAircraft: airborne,
      groundAircraft: ground,
      trackedCountries: countries
    },
    timestamp: new Date().toISOString(),
    authenticated: false,
    dataSource: 'mock',
    fromCache: false
  };
}