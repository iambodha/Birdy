export interface FlightJourney {
  id: number;
  icao24: string;
  callsign: string | null;
  origin_country: string | null;
  collection_time: string;
  flight_date: string;
  departure_time: string;
  arrival_time: string;
  duration_minutes: number | null;
  start_status: string | null;
  end_status: string | null;
  flight_status: string | null;
  max_altitude: number | null;
  max_velocity: number | null;
  position_count: number | null;
  positions: Position[];
}

export interface Position {
  timestamp: string;
  lon: number;
  lat: number;
  alt_baro?: number;
  alt_geo?: number;
  velocity?: number;
  track?: number;
  vert_rate?: number;
  on_ground?: boolean;
}

export interface Stats {
  totalAircraft: number;
  recentAdditions: number;
  topManufacturers: { manufacturer_name: string; count: number }[];
  topOperators: { operator: string; count: number }[];
  topAircraftTypes: { model: string; count: number }[];
}

// Generate mock flight history for specific aircraft
export function getMockFlightHistory(icao24: string): { flights: FlightJourney[]; total: number } {
  const flights: FlightJourney[] = [];
  const numFlights = Math.floor(Math.random() * 8) + 2; // 2-10 flights
  
  for (let i = 0; i < numFlights; i++) {
    const flightDate = new Date();
    flightDate.setDate(flightDate.getDate() - (i * 2) - Math.floor(Math.random() * 5));
    
    const departureTime = new Date(flightDate);
    departureTime.setHours(Math.floor(Math.random() * 24), Math.floor(Math.random() * 60));
    
    const duration = Math.floor(Math.random() * 480) + 60; // 1-9 hours
    const arrivalTime = new Date(departureTime.getTime() + duration * 60 * 1000);
    
    // Generate some position data
    const positions: Position[] = [];
    const numPositions = Math.floor(Math.random() * 20) + 10;
    for (let j = 0; j < numPositions; j++) {
      const timestamp = new Date(departureTime.getTime() + (j * duration * 60 * 1000) / numPositions);
      positions.push({
        timestamp: timestamp.toISOString(),
        lon: (Math.random() - 0.5) * 360,
        lat: (Math.random() - 0.5) * 160,
        alt_baro: Math.floor(Math.random() * 40000) + 5000,
        velocity: Math.floor(Math.random() * 500) + 200,
        track: Math.floor(Math.random() * 360),
        on_ground: j === 0 || j === numPositions - 1
      });
    }
    
    const callsigns = ['AAL123', 'UAL456', 'DAL789', 'BAW321', 'DLH654', 'AFR987'];
    const countries = ['United States', 'United Kingdom', 'Germany', 'France', 'Canada'];
    const statuses = ['completed', 'active', 'cancelled', 'delayed'];
    
    flights.push({
      id: i + 1,
      icao24,
      callsign: callsigns[Math.floor(Math.random() * callsigns.length)],
      origin_country: countries[Math.floor(Math.random() * countries.length)],
      collection_time: new Date().toISOString(),
      flight_date: flightDate.toISOString().split('T')[0],
      departure_time: departureTime.toISOString(),
      arrival_time: arrivalTime.toISOString(),
      duration_minutes: duration,
      start_status: 'departed',
      end_status: 'arrived',
      flight_status: statuses[Math.floor(Math.random() * statuses.length)],
      max_altitude: Math.max(...positions.map(p => p.alt_baro || 0)),
      max_velocity: Math.max(...positions.map(p => p.velocity || 0)),
      position_count: positions.length,
      positions
    });
  }
  
  return { flights, total: flights.length };
}

// Generate mock statistics
export function getMockStats(): Stats {
  return {
    totalAircraft: 15, // Based on our mock data
    recentAdditions: 3,
    topManufacturers: [
      { manufacturer_name: 'Boeing', count: 8 },
      { manufacturer_name: 'Airbus', count: 6 },
      { manufacturer_name: 'Bombardier', count: 1 }
    ],
    topOperators: [
      { operator: 'British Airways', count: 2 },
      { operator: 'Air Canada', count: 1 },
      { operator: 'Lufthansa', count: 1 },
      { operator: 'American Airlines', count: 1 },
      { operator: 'Air France', count: 1 }
    ],
    topAircraftTypes: [
      { model: 'A380-800', count: 3 },
      { model: '777-300ER', count: 2 },
      { model: 'A320-200', count: 2 },
      { model: '747-400', count: 1 },
      { model: '787-8', count: 1 }
    ]
  };
}