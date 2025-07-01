'use client';

import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Plane, RefreshCw, Users, MapPin, Clock, Gauge, ArrowUp, X, Maximize2, Minimize2 } from 'lucide-react';
import MockDataService from '../../lib/mockDataService';

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

  const mockDataService = MockDataService.getInstance();

  const [loadingConfig] = useState<LoadingConfig>({
    maxAircraftDisplay: 1000,
    chunkSize: 250,
    viewportPadding: 20
  });

  // Updated fetch function to use mock data service
  const fetchAircraftData = async () => {
    try {
      setLoading(true);
      const data = await mockDataService.getLiveAircraft();
      
      const parsedAircraft = data.aircraft || [];
      const apiStats = data.stats || {};

      setAircraft(parsedAircraft);
      setLastUpdate(new Date());

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

  // Touch interaction handler
  const handleTouchInteraction = useCallback((event: React.TouchEvent<HTMLDivElement>) => {
    if (event.touches.length === 1) {
      const touch = event.touches[0];
      const rect = event.currentTarget.getBoundingClientRect();
      const x = (touch.clientX - rect.left) / rect.width;  // 0 to 1
      const y = (touch.clientY - rect.top) / rect.height;   // 0 to 1
      
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
    }
  }, [zoomLevel, updateViewport]);

  // Zoom handlers
  const handleZoomIn = useCallback(() => {
    setZoomLevel(prev => Math.min(8, prev * 1.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setZoomLevel(prev => Math.max(0.25, prev / 1.5));
  }, []);

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
    return `${Math.round(altitude).toLocaleString()} ft`;
  };

  const formatVelocity = (velocity: number | null) => {
    if (velocity === null) return 'N/A';
    return `${Math.round(velocity)} kt`;
  };

  const formatCallsign = (callsign: string | null) => {
    return callsign || 'N/A';
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapRef.current?.requestFullscreen();
      setIsFullscreen(true);
    } else {
      document.exitFullscreen();
      setIsFullscreen(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      {/* Header */}
      <div className="bg-gray-800 p-4 shadow-lg">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Plane className="w-6 h-6" />
              Live Flight Map
            </h1>
            <div className="flex items-center gap-2 text-sm text-gray-300">
              <Clock className="w-4 h-4" />
              {lastUpdate ? `Updated: ${lastUpdate.toLocaleTimeString()}` : 'Loading...'}
            </div>
          </div>
          
          <div className="flex items-center gap-4">
            {/* Search */}
            <input
              type="text"
              placeholder="Search callsign, ICAO24, or country..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="px-3 py-2 bg-gray-700 rounded text-sm w-64"
            />
            
            {/* Controls */}
            <button
              onClick={() => setShowOnlyAirborne(!showOnlyAirborne)}
              className={`px-3 py-2 rounded text-sm ${
                showOnlyAirborne ? 'bg-blue-600' : 'bg-gray-600'
              }`}
            >
              Airborne Only
            </button>
            
            <button
              onClick={() => setAutoRefresh(!autoRefresh)}
              className={`px-3 py-2 rounded text-sm ${
                autoRefresh ? 'bg-green-600' : 'bg-gray-600'
              }`}
            >
              Auto Refresh
            </button>
            
            <button
              onClick={fetchAircraftData}
              disabled={loading}
              className="px-3 py-2 bg-blue-600 rounded text-sm flex items-center gap-2 disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex flex-wrap items-center gap-6 mt-4 text-sm">
          <div className="flex items-center gap-2">
            <Plane className="w-4 h-4 text-blue-400" />
            <span>Total: {stats.totalAircraft.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4 text-green-400" />
            <span>Airborne: {stats.airborneAircraft.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-orange-400" />
            <span>Ground: {stats.groundAircraft.toLocaleString()}</span>
          </div>
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-purple-400" />
            <span>Countries: {stats.trackedCountries}</span>
          </div>
          <div className="text-gray-400">
            Displaying: {displayedAircraft.length.toLocaleString()} / {processedAircraft.length.toLocaleString()}
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="relative flex-1" ref={mapRef}>
        {/* Map Controls */}
        <div className="absolute top-4 right-4 z-10 flex flex-col gap-2">
          <button
            onClick={handleZoomIn}
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <span className="text-lg font-bold">+</span>
          </button>
          <button
            onClick={handleZoomOut}
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            <span className="text-lg font-bold">−</span>
          </button>
          <button
            onClick={toggleFullscreen}
            className="w-10 h-10 bg-gray-800 hover:bg-gray-700 rounded-lg flex items-center justify-center"
          >
            {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        </div>

        {/* Load More Button */}
        {currentChunk < Math.ceil(visibleAircraftInViewport.length / loadingConfig.chunkSize) - 1 && (
          <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-10">
            <button
              onClick={loadMoreChunks}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg text-sm"
            >
              Load More Aircraft ({visibleAircraftInViewport.length - displayedAircraft.length} remaining)
            </button>
          </div>
        )}

        {/* Map Viewport */}
        <div 
          className="map-viewport w-full h-screen bg-gray-800 relative cursor-crosshair"
          onMouseDown={handleMapInteraction}
          onTouchStart={handleTouchInteraction}
        >
          {/* Aircraft Markers */}
          {displayedAircraft.map((aircraft) => {
            if (aircraft.longitude === null || aircraft.latitude === null) return null;
            
            // Convert lat/lon to screen coordinates
            const x = ((aircraft.longitude + 180) / 360) * 100;
            const y = ((90 - aircraft.latitude) / 180) * 100;
            
            return (
              <div
                key={aircraft.icao24}
                className={`absolute transform -translate-x-1/2 -translate-y-1/2 cursor-pointer transition-all duration-200 ${
                  selectedAircraft?.icao24 === aircraft.icao24 ? 'z-20 scale-150' : 'z-10'
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                }}
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedAircraft(aircraft);
                }}
              >
                <div className={`relative ${aircraft.on_ground ? 'text-orange-400' : 'text-green-400'}`}>
                  <Plane 
                    className="w-3 h-3" 
                    style={{
                      transform: aircraft.true_track ? `rotate(${aircraft.true_track}deg)` : 'none'
                    }}
                  />
                  {selectedAircraft?.icao24 === aircraft.icao24 && (
                    <div className="absolute top-6 left-1/2 transform -translate-x-1/2 bg-gray-900 border border-gray-600 rounded-lg p-2 text-xs whitespace-nowrap shadow-lg">
                      <div className="font-semibold">{formatCallsign(aircraft.callsign)}</div>
                      <div>ICAO24: {aircraft.icao24}</div>
                      <div>Country: {aircraft.origin_country || 'Unknown'}</div>
                      <div>Altitude: {formatAltitude(aircraft.baro_altitude)}</div>
                      <div>Speed: {formatVelocity(aircraft.velocity)}</div>
                      <div>Status: {aircraft.on_ground ? 'Ground' : 'Airborne'}</div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {/* Loading Overlay */}
          {loading && (
            <div className="absolute inset-0 bg-gray-900 bg-opacity-75 flex items-center justify-center z-30">
              <div className="text-center">
                <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-4" />
                <div className="text-lg">Loading aircraft data...</div>
              </div>
            </div>
          )}

          {/* Map Info */}
          <div className="absolute bottom-4 left-4 bg-gray-900 bg-opacity-90 rounded-lg p-3 text-xs">
            <div>Zoom: {zoomLevel.toFixed(2)}x</div>
            <div>Center: {mapCenter.lat.toFixed(2)}°, {mapCenter.lon.toFixed(2)}°</div>
            <div>Viewport: {viewport.minLat.toFixed(1)}° to {viewport.maxLat.toFixed(1)}°</div>
          </div>
        </div>
      </div>

      {/* Aircraft Info Panel */}
      {selectedAircraft && (
        <div className="fixed top-0 right-0 w-80 h-full bg-gray-800 shadow-lg z-40 overflow-y-auto">
          <div className="p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Aircraft Details</h3>
              <button
                onClick={() => setSelectedAircraft(null)}
                className="p-1 hover:bg-gray-700 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-3 text-sm">
              <div>
                <label className="text-gray-400">Callsign</label>
                <div className="font-semibold">{formatCallsign(selectedAircraft.callsign)}</div>
              </div>
              
              <div>
                <label className="text-gray-400">ICAO24</label>
                <div className="font-mono">{selectedAircraft.icao24}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Country</label>
                <div>{selectedAircraft.origin_country || 'Unknown'}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Position</label>
                <div>
                  {selectedAircraft.latitude?.toFixed(4)}°, {selectedAircraft.longitude?.toFixed(4)}°
                </div>
              </div>
              
              <div>
                <label className="text-gray-400">Altitude</label>
                <div>{formatAltitude(selectedAircraft.baro_altitude)}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Ground Speed</label>
                <div>{formatVelocity(selectedAircraft.velocity)}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Heading</label>
                <div>{selectedAircraft.true_track ? `${Math.round(selectedAircraft.true_track)}°` : 'N/A'}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Vertical Rate</label>
                <div>
                  {selectedAircraft.vertical_rate ? 
                    `${selectedAircraft.vertical_rate > 0 ? '+' : ''}${Math.round(selectedAircraft.vertical_rate)} ft/min` : 
                    'N/A'
                  }
                </div>
              </div>
              
              <div>
                <label className="text-gray-400">Status</label>
                <div className={selectedAircraft.on_ground ? 'text-orange-400' : 'text-green-400'}>
                  {selectedAircraft.on_ground ? 'On Ground' : 'Airborne'}
                </div>
              </div>
              
              <div>
                <label className="text-gray-400">Squawk</label>
                <div className="font-mono">{selectedAircraft.squawk || 'N/A'}</div>
              </div>
              
              <div>
                <label className="text-gray-400">Last Contact</label>
                <div>{new Date(selectedAircraft.last_contact * 1000).toLocaleString()}</div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}