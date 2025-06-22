'use client';

import { useState, useEffect } from 'react';
import { Search, Plane, Users, Building, Calendar, ChevronLeft, ChevronRight, History, X, MapPin, Clock, Gauge, ArrowUp, ArrowDown } from 'lucide-react';

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

interface FlightJourney {
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

interface Position {
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

interface Stats {
  totalAircraft: number;
  recentAdditions: number;
  topManufacturers: { manufacturer_name: string; count: number }[];
  topOperators: { operator: string; count: number }[];
  topAircraftTypes: { model: string; count: number }[];
}

interface ApiResponse {
  aircraft: AircraftMetadata[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export default function Home() {
  const [aircraft, setAircraft] = useState<AircraftMetadata[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [pagination, setPagination] = useState({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0
  });
  
  // Updated state for flight history modal
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftMetadata | null>(null);
  const [flightHistory, setFlightHistory] = useState<FlightJourney[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [showHistoryModal, setShowHistoryModal] = useState(false);

  const fetchAircraft = async (page: number, searchTerm: string = '') => {
    setLoading(true);
    try {
      const response = await fetch(`/api/aircraft?page=${page}&limit=20&search=${encodeURIComponent(searchTerm)}`);
      const data: ApiResponse = await response.json();
      setAircraft(data.aircraft);
      setPagination(data.pagination);
    } catch (error) {
      console.error('Failed to fetch aircraft:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      const response = await fetch('/api/aircraft/stats');
      const data: Stats = await response.json();
      setStats(data);
    } catch (error) {
      console.error('Failed to fetch stats:', error);
    }
  };

  const fetchFlightHistory = async (icao24: string) => {
    setHistoryLoading(true);
    try {
      const response = await fetch(`/api/aircraft/history?icao24=${encodeURIComponent(icao24)}`);
      const data = await response.json();
      setFlightHistory(data.flights || []);
    } catch (error) {
      console.error('Failed to fetch flight history:', error);
      setFlightHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  useEffect(() => {
    fetchAircraft(currentPage, search);
  }, [currentPage, search]);

  useEffect(() => {
    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    fetchAircraft(1, search);
  };

  const handleViewHistory = (aircraft: AircraftMetadata) => {
    setSelectedAircraft(aircraft);
    setShowHistoryModal(true);
    fetchFlightHistory(aircraft.icao24);
  };

  const closeHistoryModal = () => {
    setShowHistoryModal(false);
    setSelectedAircraft(null);
    setFlightHistory([]);
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return 'N/A';
    try {
      return new Date(dateString).toLocaleDateString();
    } catch {
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleString();
    } catch {
      return dateString;
    }
  };

  const formatAltitude = (altitude: number | null) => {
    if (altitude === null) return 'N/A';
    return `${Math.round(altitude)} ft`;
  };

  const formatVelocity = (velocity: number | null) => {
    if (velocity === null) return 'N/A';
    return `${Math.round(velocity)} kt`;
  };

  const formatCoordinates = (lat: number | null, lon: number | null) => {
    if (lat === null || lon === null) return 'N/A';
    return `${lat.toFixed(4)}, ${lon.toFixed(4)}`;
  };

  const formatDuration = (minutes: number | null) => {
    if (!minutes) return 'N/A';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return `${hours}h ${mins}m`;
  };

  const formatFlightStatus = (status: string | null) => {
    if (!status) return 'Unknown';
    return status.charAt(0).toUpperCase() + status.slice(1);
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-6">
            <div className="flex items-center gap-3 mb-6">
              <Plane className="h-8 w-8 text-blue-600" />
              <h1 className="text-3xl font-bold text-gray-900">Birdy Aircraft Viewer</h1>
            </div>

            {/* Stats Cards */}
            {stats && (
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
                <div className="bg-blue-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Plane className="h-5 w-5 text-blue-600" />
                    <span className="text-sm text-blue-600 font-medium">Total Aircraft</span>
                  </div>
                  <p className="text-2xl font-bold text-blue-900">{stats.totalAircraft?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-green-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Calendar className="h-5 w-5 text-green-600" />
                    <span className="text-sm text-green-600 font-medium">Added This Week</span>
                  </div>
                  <p className="text-2xl font-bold text-green-900">{stats.recentAdditions?.toLocaleString() || '0'}</p>
                </div>
                <div className="bg-purple-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Building className="h-5 w-5 text-purple-600" />
                    <span className="text-sm text-purple-600 font-medium">Top Manufacturer</span>
                  </div>
                  <p className="text-lg font-bold text-purple-900">
                    {stats.topManufacturers[0]?.manufacturer_name || 'N/A'}
                  </p>
                </div>
                <div className="bg-orange-50 p-4 rounded-lg">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-orange-600" />
                    <span className="text-sm text-orange-600 font-medium">Top Operator</span>
                  </div>
                  <p className="text-lg font-bold text-orange-900">
                    {stats.topOperators[0]?.operator || 'N/A'}
                  </p>
                </div>
              </div>
            )}

            {/* Search */}
            <form onSubmit={handleSearch} className="mb-6">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search by ICAO24, registration, manufacturer, model, or operator..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </form>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {loading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
          </div>
        ) : (
          <>
            {/* Results header */}
            <div className="mb-6">
              <p className="text-gray-600">
                Showing {aircraft.length} of {pagination.total.toLocaleString()} aircraft
                {search && ` matching "${search}"`}
              </p>
            </div>

            {/* Aircraft Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
              {aircraft.map((plane) => (
                <div key={plane.id} className="bg-white rounded-lg shadow-md overflow-hidden hover:shadow-lg transition-shadow">
                  <div className="p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold text-gray-900 mb-1">
                          {plane.registration || plane.icao24}
                        </h3>
                        <p className="text-sm text-gray-500">ICAO24: {plane.icao24}</p>
                      </div>
                      <div className="bg-blue-100 p-2 rounded-lg">
                        <Plane className="h-5 w-5 text-blue-600" />
                      </div>
                    </div>

                    <div className="space-y-2">
                      {plane.manufacturer_name && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Manufacturer:</span>
                          <span className="text-sm font-medium text-gray-900">{plane.manufacturer_name}</span>
                        </div>
                      )}
                      {plane.model && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Model:</span>
                          <span className="text-sm font-medium text-gray-900">{plane.model}</span>
                        </div>
                      )}
                      {plane.operator && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Operator:</span>
                          <span className="text-sm font-medium text-gray-900">{plane.operator}</span>
                        </div>
                      )}
                      {plane.built && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Built:</span>
                          <span className="text-sm font-medium text-gray-900">{plane.built}</span>
                        </div>
                      )}
                      {plane.engines && (
                        <div className="flex justify-between">
                          <span className="text-sm text-gray-500">Engines:</span>
                          <span className="text-sm font-medium text-gray-900">{plane.engines}</span>
                        </div>
                      )}
                    </div>

                    <div className="mt-4 pt-4 border-t border-gray-100 flex justify-between items-center">
                      <p className="text-xs text-gray-400">
                        Updated: {formatDate(plane.updated_at)}
                      </p>
                      <button
                        onClick={() => handleViewHistory(plane)}
                        className="flex items-center gap-1 px-3 py-1 text-xs font-medium text-blue-600 bg-blue-50 rounded-full hover:bg-blue-100 transition-colors"
                      >
                        <History className="h-3 w-3" />
                        View History
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.totalPages > 1 && (
              <div className="flex justify-center items-center gap-2">
                <button
                  onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                  disabled={currentPage === 1}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                <div className="flex items-center gap-1">
                  {Array.from({ length: Math.min(5, pagination.totalPages) }, (_, i) => {
                    const page = Math.max(1, Math.min(pagination.totalPages - 4, currentPage - 2)) + i;
                    return (
                      <button
                        key={page}
                        onClick={() => setCurrentPage(page)}
                        className={`px-3 py-2 text-sm font-medium rounded-md ${
                          page === currentPage
                            ? 'bg-blue-600 text-white'
                            : 'text-gray-500 bg-white border border-gray-300 hover:bg-gray-50'
                        }`}
                      >
                        {page}
                      </button>
                    );
                  })}
                </div>

                <button
                  onClick={() => setCurrentPage(Math.min(pagination.totalPages, currentPage + 1))}
                  disabled={currentPage === pagination.totalPages}
                  className="flex items-center gap-1 px-3 py-2 text-sm font-medium text-gray-500 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            )}

            {aircraft.length === 0 && !loading && (
              <div className="text-center py-12">
                <Plane className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">No aircraft found</p>
                {search && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setCurrentPage(1);
                    }}
                    className="mt-2 text-blue-600 hover:text-blue-500"
                  >
                    Clear search
                  </button>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Flight History Modal */}
      {showHistoryModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-hidden">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Flight History</h2>
                <p className="text-sm text-gray-500">
                  {selectedAircraft?.registration || selectedAircraft?.icao24} - {selectedAircraft?.icao24}
                </p>
              </div>
              <button
                onClick={closeHistoryModal}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto max-h-[calc(90vh-120px)]">
              {historyLoading ? (
                <div className="flex justify-center items-center h-32">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                </div>
              ) : flightHistory.length > 0 ? (
                <div className="space-y-6">
                  <div className="mb-4">
                    <p className="text-sm text-gray-600">
                      Found {flightHistory.length} flight journeys
                    </p>
                  </div>
                  
                  {flightHistory.map((flight, index) => (
                    <div key={flight.id} className="bg-gray-50 rounded-lg p-6 border">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <Plane className="h-5 w-5 text-blue-500" />
                          <div>
                            <h3 className="font-semibold text-gray-900">
                              {flight.callsign || 'Unknown Flight'}
                            </h3>
                            <p className="text-sm text-gray-500">
                              {formatDate(flight.flight_date)}
                            </p>
                          </div>
                        </div>
                        <div className="text-right">
                          <span className={`px-3 py-1 text-sm rounded-full ${
                            flight.flight_status === 'completed' ? 'bg-green-100 text-green-700' :
                            flight.flight_status === 'active' ? 'bg-blue-100 text-blue-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {formatFlightStatus(flight.flight_status)}
                          </span>
                        </div>
                      </div>

                      {/* Flight Summary */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="bg-white p-3 rounded border">
                          <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Clock className="h-4 w-4" />
                            <span className="text-sm">Duration</span>
                          </div>
                          <p className="font-semibold">{formatDuration(flight.duration_minutes)}</p>
                        </div>
                        
                        <div className="bg-white p-3 rounded border">
                          <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <ArrowUp className="h-4 w-4" />
                            <span className="text-sm">Max Altitude</span>
                          </div>
                          <p className="font-semibold">{formatAltitude(flight.max_altitude)}</p>
                        </div>
                        
                        <div className="bg-white p-3 rounded border">
                          <div className="flex items-center gap-2 text-gray-500 mb-1">
                            <Gauge className="h-4 w-4" />
                            <span className="text-sm">Max Velocity</span>
                          </div>
                          <p className="font-semibold">{formatVelocity(flight.max_velocity)}</p>
                        </div>
                      </div>

                      {/* Flight Times */}
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Departure</div>
                          <p className="font-medium">{formatDateTime(flight.departure_time)}</p>
                          {flight.start_status && (
                            <p className="text-xs text-gray-400">Status: {flight.start_status}</p>
                          )}
                        </div>
                        <div>
                          <div className="text-sm text-gray-500 mb-1">Arrival</div>
                          <p className="font-medium">{formatDateTime(flight.arrival_time)}</p>
                          {flight.end_status && (
                            <p className="text-xs text-gray-400">Status: {flight.end_status}</p>
                          )}
                        </div>
                      </div>

                      {/* Position Count */}
                      {flight.position_count && (
                        <div className="flex items-center gap-2 text-sm text-gray-600 mb-3">
                          <MapPin className="h-4 w-4" />
                          <span>{flight.position_count} position reports recorded</span>
                        </div>
                      )}

                      {/* Country Info */}
                      {flight.origin_country && (
                        <div className="text-sm text-gray-600">
                          <span className="font-medium">Origin Country:</span> {flight.origin_country}
                        </div>
                      )}

                      {/* Position Data Preview */}
                      {flight.positions && flight.positions.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-200">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-sm font-medium text-gray-700">
                              Position Data ({flight.positions.length} points)
                            </span>
                          </div>
                          
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-xs">
                            <div>
                              <span className="text-gray-500">First Position:</span>
                              <div className="font-mono">
                                {formatCoordinates(flight.positions[0].lat, flight.positions[0].lon)}
                              </div>
                            </div>
                            <div>
                              <span className="text-gray-500">Last Position:</span>
                              <div className="font-mono">
                                {formatCoordinates(
                                  flight.positions[flight.positions.length - 1].lat,
                                  flight.positions[flight.positions.length - 1].lon
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12">
                  <History className="h-12 w-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500">No flight history found for this aircraft</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}