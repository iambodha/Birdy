'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plane, RefreshCw, Users, MapPin, Clock, Gauge, ArrowUp, X, Maximize2, Minimize2 } from 'lucide-react';

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

interface MapStats {
  totalAircraft: number;
  airborneAircraft: number;
  groundAircraft: number;
  trackedCountries: number;
}

interface ViewportBounds {
  minLat: number;
  maxLat: number;
  minLon: number;
  maxLon: number;
}

interface LoadingConfig {
  maxAircraftDisplay: number;
  chunkSize: number;
  viewportPadding: number;
}

export default function LiveMap() {
  const [aircraft, setAircraft] = useState<AircraftState[]>([]);
  const [visibleAircraft, setVisibleAircraft] = useState<AircraftState[]>([]);
  const [loadedChunks, setLoadedChunks] = useState<Set<string>>(new Set());
  const [viewport, setViewport] = useState<ViewportBounds>({
    minLat: -90, maxLat: 90, minLon: -180, maxLon: 180
  });
  const [zoomLevel, setZoomLevel] = useState(1);
  const [mapCenter, setMapCenter] = useState({ lat: 0, lon: 0 });
  const [loading, setLoading] = useState(true);
  const [lastUpdate, setLastUpdate] = useState<Date | null>(null);
  const [selectedAircraft, setSelectedAircraft] = useState<AircraftState | null>(null);
  const [stats, setStats] = useState<MapStats>({ totalAircraft: 0, airborneAircraft: 0, groundAircraft: 0, trackedCountries: 0 });
  const [showOnlyAirborne, setShowOnlyAirborne] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const mapRef = useRef<HTMLDivElement>(null);
  const refreshIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [loadingConfig] = useState<LoadingConfig>({
    maxAircraftDisplay: 1000, // Maximum aircraft to show at once
    chunkSize: 250, // Load aircraft in chunks
    viewportPadding: 20 // Padding around viewport in degrees
  });

  // Smart loading configuration based on zoom level
  const getSmartLoadingConfig = useCallback(() => {
    if (zoomLevel < 0.5) {
      // Very zoomed out - show fewer aircraft, prioritize important ones
      return {
        maxDisplay: 300,
        prioritizeAirborne: true,
        minAltitudeFilter: 10000, // Only show aircraft above 10k feet
        skipGroundAircraft: true
      };
    } else if (zoomLevel < 1) {
      // Medium zoom - balanced view
      return {
        maxDisplay: 600,
        prioritizeAirborne: true,
        minAltitudeFilter: 1000,
        skipGroundAircraft: false
      };
    } else {
      // Zoomed in - show more detail
      return {
        maxDisplay: 1000,
        prioritizeAirborne: false,
        minAltitudeFilter: null,
        skipGroundAircraft: false
      };
    }
  }, [zoomLevel]);

  // Memoized aircraft filtering and sorting
  const processedAircraft = useMemo(() => {
    if (!aircraft.length) return [];

    const config = getSmartLoadingConfig();
    let processed = [...aircraft];

    // Apply smart filters based on zoom level
    if (config.skipGroundAircraft) {
      processed = processed.filter(a => !a.on_ground);
    }

    if (config.minAltitudeFilter) {
      processed = processed.filter(a => 
        !a.baro_altitude || a.baro_altitude >= config.minAltitudeFilter
      );
    }

    // Apply search filter
    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      processed = processed.filter(a => 
        a.icao24.toLowerCase().includes(search) ||
        a.callsign?.toLowerCase().includes(search) ||
        a.origin_country?.toLowerCase().includes(search)
      );
    }

    // Apply airborne filter
    if (showOnlyAirborne) {
      processed = processed.filter(a => !a.on_ground);
    }

    // Sort by priority (airborne first, then by altitude/velocity)
    processed.sort((a, b) => {
      if (config.prioritizeAirborne) {
        if (a.on_ground !== b.on_ground) {
          return a.on_ground ? 1 : -1; // Airborne first
        }
      }
      
      // Then by altitude (higher first)
      const altA = a.baro_altitude || 0;
      const altB = b.baro_altitude || 0;
      if (altA !== altB) {
        return altB - altA;
      }
      
      // Then by velocity (faster first)
      const velA = a.velocity || 0;
      const velB = b.velocity || 0;
      return velB - velA;
    });

    // Limit to max display count
    return processed.slice(0, config.maxDisplay);
  }, [aircraft, searchTerm, showOnlyAirborne, getSmartLoadingConfig]);

  // Viewport-based filtering for visible aircraft
  const visibleAircraftInViewport = useMemo(() => {
    return processedAircraft.filter(aircraft => {
      if (aircraft.longitude === null || aircraft.latitude === null) return false;
      
      return (
        aircraft.longitude >= viewport.minLon - loadingConfig.viewportPadding &&
        aircraft.longitude <= viewport.maxLon + loadingConfig.viewportPadding &&
        aircraft.latitude >= viewport.minLat - loadingConfig.viewportPadding &&
        aircraft.latitude <= viewport.maxLat + loadingConfig.viewportPadding
      );
    });
  }, [processedAircraft, viewport, loadingConfig.viewportPadding]);

  // Chunked loading for smooth performance
  const [displayedAircraft, setDisplayedAircraft] = useState<AircraftState[]>([]);
  const [currentChunk, setCurrentChunk] = useState(0);

  useEffect(() => {
    // Reset chunks when aircraft data changes
    setCurrentChunk(0);
    setDisplayedAircraft([]);
    
    // Load first chunk immediately
    const firstChunk = visibleAircraftInViewport.slice(0, loadingConfig.chunkSize);
    setDisplayedAircraft(firstChunk);
  }, [visibleAircraftInViewport, loadingConfig.chunkSize]);

  // Progressive loading of additional chunks
  useEffect(() => {
    if (currentChunk === 0) return;

    const timer = setTimeout(() => {
      const startIndex = currentChunk * loadingConfig.chunkSize;
      const endIndex = startIndex + loadingConfig.chunkSize;
      const nextChunk = visibleAircraftInViewport.slice(startIndex, endIndex);
      
      if (nextChunk.length > 0) {
        setDisplayedAircraft(prev => [...prev, ...nextChunk]);
      }
    }, 100); // Small delay to prevent UI blocking

    return () => clearTimeout(timer);
  }, [currentChunk, visibleAircraftInViewport, loadingConfig.chunkSize]);

  // Auto-load more chunks when needed
  const loadMoreChunks = useCallback(() => {
    const maxChunks = Math.ceil(visibleAircraftInViewport.length / loadingConfig.chunkSize);
    if (currentChunk < maxChunks - 1) {
      setCurrentChunk(prev => prev + 1);
    }
  }, [visibleAircraftInViewport.length, loadingConfig.chunkSize, currentChunk]);

  // Debounced viewport update
  const updateViewport = useCallback((newViewport: ViewportBounds) => {
    setViewport(newViewport);
  }, []);

  // Map interaction handlers with viewport tracking
  const handleMapInteraction = useCallback((event: React.MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width;  // 0 to 1
    const y = (event.clientY - rect.top) / rect.height;   // 0 to 1
    
    // Convert to lat/lon
    const lon = (x * 360) - 180;  // -180 to 180
    const lat = 90 - (y * 180);   // 90 to -90
    
    setMapCenter({ lat, lon });
    
    // Update viewport based on zoom level
    const latRange = 180 / zoomLevel;
    const lonRange = 360 / zoomLevel;
    
    updateViewport({
      minLat: Math.max(-90, lat - latRange / 2),
      maxLat: Math.min(90, lat + latRange / 2),
      minLon: Math.max(-180, lon - lonRange / 2),
      maxLon: Math.min(180, lon + lonRange / 2)
    });
  }, [zoomLevel, updateViewport]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(8, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(0.25, prev / 1.5));
  }, []);

  // Enhanced fetch function with smart loading
  const fetchAircraftData = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/aircraft/live');

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = await response.json();
      
      if (data.error) {
        throw new Error(data.details || data.error);
      }

      const parsedAircraft = data.aircraft || [];
      const apiStats = data.stats || {};

      setAircraft(parsedAircraft);
      setLastUpdate(new Date());

      // Use stats from API response
      setStats({
        totalAircraft: apiStats.totalAircraft || 0,
        airborneAircraft: apiStats.airborneAircraft || 0,
        groundAircraft: apiStats.groundAircraft || 0,
        trackedCountries: apiStats.trackedCountries || 0
      });

    } catch (error) {
      console.error('Failed to fetch aircraft data:', error);
    } finally {
      setLoading(false);
    }
  };

  // Filter aircraft based on search and airborne filter
  useEffect(() => {
    let filtered = aircraft;

    if (showOnlyAirborne) {
      filtered = filtered.filter(a => !a.on_ground);
    }

    if (searchTerm) {
      const search = searchTerm.toLowerCase();
      filtered = filtered.filter(a => 
        a.icao24.toLowerCase().includes(search) ||
        a.callsign?.toLowerCase().includes(search) ||
        a.origin_country?.toLowerCase().includes(search)
      );
    }

    setVisibleAircraft(filtered);
  }, [aircraft, showOnlyAirborne, searchTerm]);

  // Auto refresh
  useEffect(() => {
    if (autoRefresh) {
      refreshIntervalRef.current = setInterval(fetchAircraftData, 30000); // 30 seconds
    } else {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    }

    return () => {
      if (refreshIntervalRef.current) {
        clearInterval(refreshIntervalRef.current);
      }
    };
  }, [autoRefresh]);

  // Initial load
  useEffect(() => {
    fetchAircraftData();
  }, []);

  const formatAltitude = (altitude: number | null) => {
    if (altitude === null) return 'N/A';
    return `${Math.round(altitude)}m`;
  };

  const formatVelocity = (velocity: number | null) => {
    if (velocity === null) return 'N/A';
    return `${Math.round(velocity * 1.94384)} kt`; // Convert m/s to knots
  };

  const formatTrack = (track: number | null) => {
    if (track === null) return 'N/A';
    return `${Math.round(track)}°`;
  };

  const formatVerticalRate = (rate: number | null) => {
    if (rate === null) return 'N/A';
    const fpm = Math.round(rate * 196.85); // Convert m/s to ft/min
    return `${fpm > 0 ? '+' : ''}${fpm} ft/min`;
  };

  const getAircraftRotation = (track: number | null) => {
    return track !== null ? `rotate(${track}deg)` : 'rotate(0deg)';
  };

  const toggleFullscreen = () => {
    if (!isFullscreen) {
      document.documentElement.requestFullscreen?.();
    } else {
      document.exitFullscreen?.();
    }
    setIsFullscreen(!isFullscreen);
  };

  return (
    <div className={`${isFullscreen ? 'fixed inset-0 z-50' : 'min-h-screen'} bg-gray-900 text-white`}>
      {/* Header */}
      <div className="bg-gray-800 border-b border-gray-700">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-4">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Plane className="h-8 w-8 text-blue-400" />
                <div>
                  <h1 className="text-2xl font-bold">Live Aircraft Map</h1>
                  {lastUpdate && (
                    <p className="text-sm text-gray-400">
                      Last updated: {lastUpdate.toLocaleTimeString()}
                    </p>
                  )}
                </div>
              </div>
              
              <div className="flex items-center gap-4">
                <button
                  onClick={toggleFullscreen}
                  className="flex items-center gap-2 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
                >
                  {isFullscreen ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                  {isFullscreen ? 'Exit Fullscreen' : 'Fullscreen'}
                </button>
                
                <button
                  onClick={fetchAircraftData}
                  disabled={loading}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg transition-colors"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  Refresh
                </button>
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-blue-400 mb-1">
                  <Plane className="h-4 w-4" />
                  <span className="text-sm">Total Aircraft</span>
                </div>
                <p className="text-xl font-bold">{stats.totalAircraft.toLocaleString()}</p>
              </div>
              
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-green-400 mb-1">
                  <ArrowUp className="h-4 w-4" />
                  <span className="text-sm">Airborne</span>
                </div>
                <p className="text-xl font-bold">{stats.airborneAircraft.toLocaleString()}</p>
              </div>
              
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-orange-400 mb-1">
                  <MapPin className="h-4 w-4" />
                  <span className="text-sm">On Ground</span>
                </div>
                <p className="text-xl font-bold">{stats.groundAircraft.toLocaleString()}</p>
              </div>
              
              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-purple-400 mb-1">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Countries</span>
                </div>
                <p className="text-xl font-bold">{stats.trackedCountries}</p>
              </div>

              <div className="bg-gray-700 p-3 rounded-lg">
                <div className="flex items-center gap-2 text-yellow-400 mb-1">
                  <Gauge className="h-4 w-4" />
                  <span className="text-sm">Displayed</span>
                </div>
                <p className="text-xl font-bold">{displayedAircraft.length.toLocaleString()}</p>
              </div>
            </div>

            {/* Controls */}
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Search aircraft..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="px-3 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:border-blue-500 focus:outline-none"
                />
              </div>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showOnlyAirborne}
                  onChange={(e) => setShowOnlyAirborne(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">Airborne only</span>
              </label>
              
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoRefresh}
                  onChange={(e) => setAutoRefresh(e.target.checked)}
                  className="w-4 h-4 text-blue-600 bg-gray-700 border-gray-600 rounded focus:ring-blue-500"
                />
                <span className="text-sm">Auto refresh (30s)</span>
              </label>
              
              <div className="flex items-center gap-2">
                <button
                  onClick={handleZoomOut}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Zoom Out
                </button>
                <span className="text-xs text-gray-400">
                  {(zoomLevel * 100).toFixed(0)}%
                </span>
                <button
                  onClick={handleZoomIn}
                  className="px-2 py-1 bg-gray-700 hover:bg-gray-600 rounded text-sm"
                >
                  Zoom In
                </button>
              </div>
              
              <span className="text-sm text-gray-400">
                Showing {displayedAircraft.length} of {processedAircraft.length} aircraft
                {visibleAircraftInViewport.length < processedAircraft.length && 
                  ` (${visibleAircraftInViewport.length} in viewport)`
                }
              </span>

              {currentChunk < Math.ceil(visibleAircraftInViewport.length / loadingConfig.chunkSize) - 1 && (
                <button
                  onClick={loadMoreChunks}
                  className="px-3 py-1 bg-blue-600 hover:bg-blue-500 rounded text-sm"
                >
                  Load More ({Math.ceil(visibleAircraftInViewport.length / loadingConfig.chunkSize) - currentChunk - 1} chunks)
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div 
        ref={mapRef} 
        className="relative flex-1 cursor-move" 
        style={{ height: isFullscreen ? 'calc(100vh - 250px)' : '80vh' }}
        onClick={handleMapInteraction}
      >
        {loading && aircraft.length === 0 ? (
          <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-400 mx-auto mb-4"></div>
              <p className="text-gray-400">Loading aircraft data...</p>
            </div>
          </div>
        ) : (
          <div className="w-full h-full bg-gray-800 relative overflow-hidden">
            {/* Simple world map background */}
            <div className="absolute inset-0 opacity-20">
              <svg viewBox="0 0 1000 500" className="w-full h-full">
                {/* Simplified world map outline */}
                <rect width="1000" height="500" fill="#1f2937" />
                <path d="M150,200 Q200,180 250,200 Q300,220 350,200 L400,220 L450,200 Q500,180 550,200" stroke="#374151" strokeWidth="2" fill="none" />
                <path d="M100,300 Q150,280 200,300 Q250,320 300,300 L350,320 L400,300 Q450,280 500,300" stroke="#374151" strokeWidth="2" fill="none" />
                <circle cx="200" cy="150" r="30" fill="#374151" />
                <circle cx="800" cy="100" r="40" fill="#374151" />
              </svg>
            </div>

            {/* Optimized Aircraft markers - only render displayed aircraft */}
            {displayedAircraft.map((aircraft) => {
              if (aircraft.longitude === null || aircraft.latitude === null) return null;
              
              // Simple projection with zoom and pan
              const x = ((aircraft.longitude + 180) / 360) * 100 * zoomLevel - (mapCenter.lon + 180) / 360 * 100 * (zoomLevel - 1);
              const y = ((90 - aircraft.latitude) / 180) * 100 * zoomLevel - (90 - mapCenter.lat) / 180 * 100 * (zoomLevel - 1);
              
              // Skip if outside visible area
              if (x < -5 || x > 105 || y < -5 || y > 105) return null;
              
              return (
                <div
                  key={aircraft.icao24}
                  className="absolute cursor-pointer transform -translate-x-1/2 -translate-y-1/2 hover:z-10"
                  style={{
                    left: `${Math.max(0, Math.min(100, x))}%`,
                    top: `${Math.max(0, Math.min(100, y))}%`,
                    transform: `translate(-50%, -50%) ${getAircraftRotation(aircraft.true_track)}`
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedAircraft(aircraft);
                  }}
                >
                  <Plane 
                    className={`h-4 w-4 ${aircraft.on_ground ? 'text-orange-400' : 'text-green-400'} hover:scale-150 transition-all duration-200`}
                  />
                </div>
              );
            })}

            {/* Enhanced Legend */}
            <div className="absolute bottom-4 left-4 bg-gray-800 bg-opacity-90 p-4 rounded-lg">
              <h3 className="text-sm font-semibold mb-2">Legend & Info</h3>
              <div className="space-y-1 text-xs">
                <div className="flex items-center gap-2">
                  <Plane className="h-3 w-3 text-green-400" />
                  <span>Airborne ({stats.airborneAircraft})</span>
                </div>
                <div className="flex items-center gap-2">
                  <Plane className="h-3 w-3 text-orange-400" />
                  <span>On Ground ({stats.groundAircraft})</span>
                </div>
                <div className="mt-2 pt-2 border-t border-gray-600">
                  <div>Zoom: {(zoomLevel * 100).toFixed(0)}%</div>
                  <div>Displayed: {displayedAircraft.length}</div>
                  <div>In Viewport: {visibleAircraftInViewport.length}</div>
                </div>
              </div>
            </div>

            {/* Loading indicator for chunks */}
            {currentChunk < Math.ceil(visibleAircraftInViewport.length / loadingConfig.chunkSize) - 1 && (
              <div className="absolute top-4 right-4 bg-gray-800 bg-opacity-90 p-2 rounded-lg">
                <div className="flex items-center gap-2 text-sm">
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-400"></div>
                  <span>Loading more aircraft...</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Aircraft Detail Modal */}
      {selectedAircraft && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg max-w-md w-full border border-gray-700">
            <div className="flex items-center justify-between p-4 border-b border-gray-700">
              <h3 className="text-lg font-semibold">
                {selectedAircraft.callsign || 'Unknown Flight'}
              </h3>
              <button
                onClick={() => setSelectedAircraft(null)}
                className="text-gray-400 hover:text-white"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="p-4 space-y-3">
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-400">ICAO24:</span>
                  <p className="font-mono">{selectedAircraft.icao24}</p>
                </div>
                <div>
                  <span className="text-gray-400">Country:</span>
                  <p>{selectedAircraft.origin_country || 'Unknown'}</p>
                </div>
                <div>
                  <span className="text-gray-400">Position:</span>
                  <p className="font-mono">
                    {selectedAircraft.latitude?.toFixed(4)}, {selectedAircraft.longitude?.toFixed(4)}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Status:</span>
                  <p className={selectedAircraft.on_ground ? 'text-orange-400' : 'text-green-400'}>
                    {selectedAircraft.on_ground ? 'On Ground' : 'Airborne'}
                  </p>
                </div>
                <div>
                  <span className="text-gray-400">Altitude:</span>
                  <p>{formatAltitude(selectedAircraft.baro_altitude)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Velocity:</span>
                  <p>{formatVelocity(selectedAircraft.velocity)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Track:</span>
                  <p>{formatTrack(selectedAircraft.true_track)}</p>
                </div>
                <div>
                  <span className="text-gray-400">Vertical Rate:</span>
                  <p>{formatVerticalRate(selectedAircraft.vertical_rate)}</p>
                </div>
                {selectedAircraft.squawk && (
                  <div>
                    <span className="text-gray-400">Squawk:</span>
                    <p className="font-mono">{selectedAircraft.squawk}</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}