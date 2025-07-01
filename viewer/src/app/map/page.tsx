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
    if (altitude === null) return '';
    return `${Math.round(altitude)} ft`;
  };

  const formatVelocity = (velocity: number | null) => {
    if (velocity === null) return '';
    return `${Math.round(velocity)} knots`;
  };

  const handleAircraftSelect = (aircraft: AircraftState) => {
    if (selectedAircraft?.icao24 === aircraft.icao24) {
      setSelectedAircraft(null);
    } else {
      setSelectedAircraft(aircraft);
    }
  };

  const toggleFullscreen = () => {
    if (!document.fullscreenElement) {
      mapRef.current?.requestFullscreen();
    } else {
      document.exitFullscreen();
    }
  };

  return (
    <div className={`live-map ${isFullscreen ? 'fullscreen' : ''}`} ref={mapRef}>
      <div className="map-controls">
        <div className="zoom-controls">
          <button onClick={handleZoomOut} disabled={loading}>
            <Minimize2 />
          </button>
          <button onClick={handleZoomIn} disabled={loading}>
            <Maximize2 />
          </button>
        </div>
        <button className="refresh-button" onClick={fetchAircraftData} disabled={loading}>
          <RefreshCw />
        </button>
        <button className="fullscreen-button" onClick={toggleFullscreen}>
          {isFullscreen ? <X /> : <Maximize2 />}
        </button>
      </div>
      <div className="map-stats">
        <div>Total Aircraft: {stats.totalAircraft}</div>
        <div>Airborne: {stats.airborneAircraft}</div>
        <div>Grounded: {stats.groundAircraft}</div>
        <div>Tracked Countries: {stats.trackedCountries}</div>
        <div>Last Update: {lastUpdate?.toLocaleTimeString() || 'N/A'}</div>
      </div>
      {loading && <div className="loading-overlay">Loading...</div>}
      <div className="aircraft-list">
        {displayedAircraft.map(aircraft => (
          <div 
            key={aircraft.icao24} 
            className={`aircraft-item ${selectedAircraft?.icao24 === aircraft.icao24 ? 'selected' : ''}`}
            onClick={() => handleAircraftSelect(aircraft)}
          >
            <div className="aircraft-info">
              <div>ICAO24: {aircraft.icao24}</div>
              <div>Callsign: {aircraft.callsign}</div>
              <div>Origin: {aircraft.origin_country}</div>
              <div>Altitude: {formatAltitude(aircraft.baro_altitude)}</div>
              <div>Velocity: {formatVelocity(aircraft.velocity)}</div>
              <div>Position: {aircraft.latitude?.toFixed(2)}, {aircraft.longitude?.toFixed(2)}</div>
              <div>Last Contact: {new Date(aircraft.last_contact * 1000).toLocaleTimeString()}</div>
            </div>
          </div>
        ))}
      </div>
      <div className="map-viewport"
        onMouseDown={handleMapInteraction}
        onTouchStart={handleMapInteraction}
      >
        {/* Map rendering logic here */}
      </div>
    </div>
  );
}