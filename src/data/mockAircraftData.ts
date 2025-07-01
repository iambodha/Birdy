export interface AircraftMetadata {
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

export const mockAircraftMetadata: AircraftMetadata[] = [
  {
    id: 1,
    icao24: "a8f4b2",
    registration: "N747BA",
    manufacturer_name: "Boeing",
    model: "747-400",
    typecode: "B744",
    operator: "British Airways",
    operator_callsign: "BAW",
    owner: "British Airways",
    category_description: "Large Commercial Aircraft",
    built: "1995",
    first_flight_date: "1995-03-15",
    engines: "4 x Rolls-Royce RB211",
    seat_configuration: "First: 14, Business: 86, Economy: 245",
    updated_at: "2024-12-01T10:30:00Z"
  },
  {
    id: 2,
    icao24: "a12c45",
    registration: "N320AA",
    manufacturer_name: "Airbus",
    model: "A320-200",
    typecode: "A320",
    operator: "American Airlines",
    operator_callsign: "AAL",
    owner: "American Airlines",
    category_description: "Medium Commercial Aircraft",
    built: "2010",
    first_flight_date: "2010-08-22",
    engines: "2 x CFM56-5B",
    seat_configuration: "First: 12, Economy: 138",
    updated_at: "2024-11-28T14:15:00Z"
  },
  {
    id: 3,
    icao24: "3c6444",
    registration: "D-ABYC",
    manufacturer_name: "Airbus",
    model: "A380-800",
    typecode: "A388",
    operator: "Lufthansa",
    operator_callsign: "DLH",
    owner: "Lufthansa",
    category_description: "Heavy Commercial Aircraft",
    built: "2012",
    first_flight_date: "2012-05-10",
    engines: "4 x Rolls-Royce Trent 900",
    seat_configuration: "First: 8, Business: 78, Premium: 52, Economy: 371",
    updated_at: "2024-11-30T09:45:00Z"
  },
  {
    id: 4,
    icao24: "4ca7a8",
    registration: "C-GTSY",
    manufacturer_name: "Boeing",
    model: "777-300ER",
    typecode: "B773",
    operator: "Air Canada",
    operator_callsign: "ACA",
    owner: "Air Canada",
    category_description: "Large Commercial Aircraft",
    built: "2018",
    first_flight_date: "2018-09-14",
    engines: "2 x General Electric GE90-115B",
    seat_configuration: "Business: 40, Premium: 24, Economy: 259",
    updated_at: "2024-12-02T16:20:00Z"
  },
  {
    id: 5,
    icao24: "06a124",
    registration: "F-HZUA",
    manufacturer_name: "Airbus",
    model: "A220-300",
    typecode: "A223",
    operator: "Air France",
    operator_callsign: "AFR",
    owner: "Air France",
    category_description: "Small Commercial Aircraft",
    built: "2021",
    first_flight_date: "2021-04-02",
    engines: "2 x Pratt & Whitney PW1500G",
    seat_configuration: "Business: 12, Economy: 136",
    updated_at: "2024-11-29T11:30:00Z"
  },
  {
    id: 6,
    icao24: "4ac92b",
    registration: "PH-BVA",
    manufacturer_name: "Boeing",
    model: "777-300ER",
    typecode: "B773",
    operator: "KLM",
    operator_callsign: "KLM",
    owner: "KLM Royal Dutch Airlines",
    category_description: "Large Commercial Aircraft",
    built: "2016",
    first_flight_date: "2016-11-18",
    engines: "2 x General Electric GE90-115B",
    seat_configuration: "Business: 34, Premium: 40, Economy: 294",
    updated_at: "2024-12-01T08:15:00Z"
  },
  {
    id: 7,
    icao24: "86084b",
    registration: "JA829J",
    manufacturer_name: "Boeing",
    model: "787-8",
    typecode: "B788",
    operator: "Japan Airlines",
    operator_callsign: "JAL",
    owner: "Japan Airlines",
    category_description: "Large Commercial Aircraft",
    built: "2019",
    first_flight_date: "2019-07-25",
    engines: "2 x Rolls-Royce Trent 1000",
    seat_configuration: "Business: 38, Premium: 35, Economy: 176",
    updated_at: "2024-11-27T13:45:00Z"
  },
  {
    id: 8,
    icao24: "a6edfe",
    registration: "A6-EUU",
    manufacturer_name: "Airbus",
    model: "A380-800",
    typecode: "A388",
    operator: "Emirates",
    operator_callsign: "UAE",
    owner: "Emirates",
    category_description: "Heavy Commercial Aircraft",
    built: "2015",
    first_flight_date: "2015-02-28",
    engines: "4 x Rolls-Royce Trent 900",
    seat_configuration: "First: 14, Business: 76, Economy: 427",
    updated_at: "2024-12-01T12:00:00Z"
  },
  {
    id: 9,
    icao24: "c06a22",
    registration: "C-FVLQ",
    manufacturer_name: "Boeing",
    model: "767-300ER",
    typecode: "B763",
    operator: "WestJet",
    operator_callsign: "WJA",
    owner: "WestJet",
    category_description: "Medium Commercial Aircraft",
    built: "2013",
    first_flight_date: "2013-12-05",
    engines: "2 x General Electric CF6-80C2",
    seat_configuration: "Premium: 24, Economy: 238",
    updated_at: "2024-11-26T15:30:00Z"
  },
  {
    id: 10,
    icao24: "780c26",
    registration: "9V-SKA",
    manufacturer_name: "Airbus",
    model: "A380-800",
    typecode: "A388",
    operator: "Singapore Airlines",
    operator_callsign: "SIA",
    owner: "Singapore Airlines",
    category_description: "Heavy Commercial Aircraft",
    built: "2017",
    first_flight_date: "2017-10-12",
    engines: "4 x Rolls-Royce Trent 900",
    seat_configuration: "Suites: 6, Business: 78, Premium: 44, Economy: 343",
    updated_at: "2024-12-02T07:45:00Z"
  },
  {
    id: 11,
    icao24: "ab1234",
    registration: "N737SW",
    manufacturer_name: "Boeing",
    model: "737-800",
    typecode: "B738",
    operator: "Southwest Airlines",
    operator_callsign: "SWA",
    owner: "Southwest Airlines",
    category_description: "Medium Commercial Aircraft",
    built: "2014",
    first_flight_date: "2014-06-15",
    engines: "2 x CFM56-7B",
    seat_configuration: "Economy: 175",
    updated_at: "2024-11-25T10:20:00Z"
  },
  {
    id: 12,
    icao24: "440123",
    registration: "G-STBA",
    manufacturer_name: "Airbus",
    model: "A321-200",
    typecode: "A321",
    operator: "British Airways",
    operator_callsign: "BAW",
    owner: "British Airways",
    category_description: "Medium Commercial Aircraft",
    built: "2016",
    first_flight_date: "2016-03-28",
    engines: "2 x IAE V2500",
    seat_configuration: "Business: 23, Economy: 168",
    updated_at: "2024-12-01T14:30:00Z"
  },
  {
    id: 13,
    icao24: "c02468",
    registration: "C-GHLM",
    manufacturer_name: "Bombardier",
    model: "CRJ-900",
    typecode: "CRJ9",
    operator: "Air Canada Express",
    operator_callsign: "QK",
    owner: "Jazz Aviation",
    category_description: "Regional Aircraft",
    built: "2018",
    first_flight_date: "2018-11-20",
    engines: "2 x General Electric CF34-8C5",
    seat_configuration: "Business: 12, Economy: 64",
    updated_at: "2024-11-28T09:15:00Z"
  },
  {
    id: 14,
    icao24: "a98765",
    registration: "N789DL",
    manufacturer_name: "Boeing",
    model: "787-9",
    typecode: "B789",
    operator: "Delta Air Lines",
    operator_callsign: "DAL",
    owner: "Delta Air Lines",
    category_description: "Large Commercial Aircraft",
    built: "2020",
    first_flight_date: "2020-01-15",
    engines: "2 x General Electric GEnx-1B",
    seat_configuration: "Business: 28, Premium: 48, Economy: 180",
    updated_at: "2024-12-02T11:45:00Z"
  },
  {
    id: 15,
    icao24: "484d40",
    registration: "OO-SNA",
    manufacturer_name: "Airbus",
    model: "A320-200",
    typecode: "A320",
    operator: "Brussels Airlines",
    operator_callsign: "BEL",
    owner: "Brussels Airlines",
    category_description: "Medium Commercial Aircraft",
    built: "2011",
    first_flight_date: "2011-05-08",
    engines: "2 x IAE V2500",
    seat_configuration: "Business: 21, Economy: 123",
    updated_at: "2024-11-30T16:00:00Z"
  }
];

// Helper function to filter aircraft data with pagination
export function getAircraftPage(
  page: number = 1,
  limit: number = 20,
  search: string = ''
): {
  aircraft: AircraftMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
} {
  let filtered = mockAircraftMetadata;

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filtered = filtered.filter(aircraft =>
      aircraft.icao24.toLowerCase().includes(searchLower) ||
      aircraft.registration?.toLowerCase().includes(searchLower) ||
      aircraft.manufacturer_name?.toLowerCase().includes(searchLower) ||
      aircraft.model?.toLowerCase().includes(searchLower) ||
      aircraft.operator?.toLowerCase().includes(searchLower)
    );
  }

  const total = filtered.length;
  const totalPages = Math.ceil(total / limit);
  const offset = (page - 1) * limit;
  const aircraft = filtered.slice(offset, offset + limit);

  return {
    aircraft,
    pagination: {
      page,
      limit,
      total,
      totalPages
    }
  };
}