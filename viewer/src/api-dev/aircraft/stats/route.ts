import { NextResponse } from 'next/server';

// Required for static export
export const dynamic = 'force-static';
export const revalidate = false;

// Mock data for aircraft statistics
const mockStats = {
  totalAircraft: 15847,
  recentAdditions: 342,
  topManufacturers: [
    { manufacturer_name: 'Boeing', count: 4521 },
    { manufacturer_name: 'Airbus', count: 3892 },
    { manufacturer_name: 'Bombardier', count: 1834 },
    { manufacturer_name: 'Embraer', count: 1456 },
    { manufacturer_name: 'Cessna', count: 1234 },
    { manufacturer_name: 'McDonnell Douglas', count: 987 },
    { manufacturer_name: 'ATR', count: 743 },
    { manufacturer_name: 'Beechcraft', count: 567 },
    { manufacturer_name: 'Piper', count: 432 },
    { manufacturer_name: 'Saab', count: 181 }
  ],
  topOperators: [
    { operator: 'Southwest Airlines', count: 234 },
    { operator: 'American Airlines', count: 187 },
    { operator: 'Delta Air Lines', count: 156 },
    { operator: 'United Airlines', count: 143 },
    { operator: 'Lufthansa', count: 98 },
    { operator: 'British Airways', count: 87 },
    { operator: 'Air France', count: 76 },
    { operator: 'KLM', count: 65 },
    { operator: 'Emirates', count: 54 },
    { operator: 'Qatar Airways', count: 43 }
  ],
  topAircraftTypes: [
    { model: 'Boeing 737-800', count: 1234 },
    { model: 'Airbus A320', count: 987 },
    { model: 'Boeing 777-300ER', count: 654 },
    { model: 'Airbus A350-900', count: 543 },
    { model: 'Boeing 787-9', count: 432 },
    { model: 'Airbus A380-800', count: 321 },
    { model: 'Boeing 747-8F', count: 234 },
    { model: 'Embraer E175', count: 198 },
    { model: 'Bombardier CRJ900', count: 167 },
    { model: 'ATR 72-600', count: 145 }
  ]
};

export async function GET() {
  // Simulate some delay to make it feel more realistic
  await new Promise(resolve => setTimeout(resolve, 100));

  return NextResponse.json(mockStats);
}