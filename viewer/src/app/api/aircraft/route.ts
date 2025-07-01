import { NextRequest, NextResponse } from 'next/server';

interface AircraftMetadata {
  id: number;
  icao24: string;
  registration: string | null;
  manufacturer_name: string | null;
  model: string | null;
  typecode: string | null;
  operator: string | null;
  operator_callsign: string | null;
  owner: string | null;
  category_description: string | null;
  built: string | null;
  first_flight_date: string | null;
  engines: string | null;
  seat_configuration: string | null;
  updated_at: string;
}

// Mock aircraft data generator
function generateMockAircraft(): AircraftMetadata[] {
  const manufacturers = ['Boeing', 'Airbus', 'Bombardier', 'Embraer', 'Cessna', 'McDonnell Douglas', 'ATR', 'Beechcraft'];
  const models = [
    'Boeing 737-800', 'Boeing 777-300ER', 'Boeing 787-9', 'Boeing 747-8F',
    'Airbus A320', 'Airbus A350-900', 'Airbus A380-800', 'Airbus A330-300',
    'Embraer E175', 'Embraer E190', 'Bombardier CRJ900', 'ATR 72-600'
  ];
  const operators = [
    'Southwest Airlines', 'American Airlines', 'Delta Air Lines', 'United Airlines',
    'Lufthansa', 'British Airways', 'Air France', 'KLM', 'Emirates', 'Qatar Airways',
    'Singapore Airlines', 'Turkish Airlines', 'Cathay Pacific', 'Japan Airlines'
  ];
  const countries = ['USA', 'DEU', 'GBR', 'FRA', 'CAN', 'AUS', 'JPN', 'NLD', 'CHE', 'SGP'];
  
  const aircraft: AircraftMetadata[] = [];
  
  for (let i = 1; i <= 500; i++) {
    const manufacturer = manufacturers[Math.floor(Math.random() * manufacturers.length)];
    const model = models[Math.floor(Math.random() * models.length)];
    const operator = operators[Math.floor(Math.random() * operators.length)];
    const icao24 = Math.random().toString(16).substr(2, 6).toUpperCase();
    const registration = `N${Math.floor(Math.random() * 99999).toString().padStart(5, '0')}`;
    const built = (2000 + Math.floor(Math.random() * 24)).toString();
    
    aircraft.push({
      id: i,
      icao24: icao24,
      registration: Math.random() > 0.1 ? registration : null,
      manufacturer_name: manufacturer,
      model: model,
      typecode: model.replace(/[^A-Z0-9]/g, '').substr(0, 4),
      operator: Math.random() > 0.1 ? operator : null,
      operator_callsign: Math.random() > 0.3 ? operator.replace(/[^A-Z]/g, '').substr(0, 3) : null,
      owner: Math.random() > 0.2 ? operator : null,
      category_description: Math.random() > 0.5 ? 'Large Transport' : 'Medium Transport',
      built: built,
      first_flight_date: `${built}-${String(Math.floor(Math.random() * 12) + 1).padStart(2, '0')}-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
      engines: Math.random() > 0.5 ? '2' : '4',
      seat_configuration: `${Math.floor(Math.random() * 300) + 50}`,
      updated_at: new Date(Date.now() - Math.floor(Math.random() * 30 * 24 * 60 * 60 * 1000)).toISOString()
    });
  }
  
  return aircraft;
}

const mockAircraft = generateMockAircraft();

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const page = parseInt(searchParams.get('page') || '1');
  const limit = parseInt(searchParams.get('limit') || '20');
  const search = searchParams.get('search') || '';
  const offset = (page - 1) * limit;

  // Simulate some delay
  await new Promise(resolve => setTimeout(resolve, 200));

  let filteredAircraft = mockAircraft;

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredAircraft = mockAircraft.filter(aircraft => 
      aircraft.icao24.toLowerCase().includes(searchLower) ||
      aircraft.registration?.toLowerCase().includes(searchLower) ||
      aircraft.manufacturer_name?.toLowerCase().includes(searchLower) ||
      aircraft.model?.toLowerCase().includes(searchLower) ||
      aircraft.operator?.toLowerCase().includes(searchLower)
    );
  }

  const total = filteredAircraft.length;
  const paginatedAircraft = filteredAircraft.slice(offset, offset + limit);

  return NextResponse.json({
    aircraft: paginatedAircraft,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
}