# enhanced_flight_tracker.py
import requests
import sqlite3
from datetime import datetime, timedelta, timezone
import time
import os
import json
import math
import threading
from collections import defaultdict

class FlightTracker:
    def __init__(self, db_path="birdy_flights.db", check_interval=120):
        self.db_path = db_path
        self.check_interval = check_interval  # seconds between checks
        self.tracking_aircraft = {}  # icao24 -> aircraft tracking data
        self.running = False
        self.init_database()
        
    def init_database(self):
        """Initialize database with enhanced schema for flight tracking"""
        if not os.path.exists(self.db_path):
            from create_database import create_database
            create_database(self.db_path)
        
        # Add tracking table for active flights
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Create active_tracking table for short-term flight tracking
        cursor.execute('''
            CREATE TABLE IF NOT EXISTS active_tracking (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                icao24 TEXT NOT NULL,
                callsign TEXT,
                origin_country TEXT,
                tracking_start_time TEXT NOT NULL,
                last_update_time TEXT NOT NULL,
                flight_status TEXT NOT NULL,  -- 'ground', 'takeoff', 'airborne', 'landing'
                takeoff_time TEXT,
                positions TEXT,  -- JSON array of position data
                UNIQUE(icao24)
            )
        ''')
        
        conn.commit()
        conn.close()
        
    def fetch_all_states(self):
        """Fetch all aircraft states from OpenSky API"""
        url = "https://opensky-network.org/api/states/all"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=30)
            if response.status_code != 200:
                print(f"Error fetching states: HTTP {response.status_code}")
                return None
                
            data = response.json()
            return data.get("states", [])
            
        except Exception as e:
            print(f"Error fetching states: {e}")
            return None
    
    def parse_aircraft_state(self, state):
        """Parse aircraft state from OpenSky API response"""
        if len(state) < 17:
            return None
            
        return {
            "icao24": state[0],
            "callsign": state[1].strip() if state[1] else "",
            "origin_country": state[2],
            "time_position": state[3],
            "last_contact": state[4],
            "longitude": state[5],
            "latitude": state[6],
            "baro_altitude": state[7],
            "on_ground": state[8],
            "velocity": state[9],
            "true_track": state[10],
            "vertical_rate": state[11],
            "sensors": state[12],
            "geo_altitude": state[13],
            "squawk": state[14],
            "spi": state[15],
            "position_source": state[16],
            "category": state[17] if len(state) > 17 else None,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    
    def find_new_ground_aircraft(self, states):
        """Find aircraft on ground that aren't being tracked yet"""
        new_ground_aircraft = []
        
        for state in states:
            aircraft = self.parse_aircraft_state(state)
            if not aircraft:
                continue
                
            # Only track aircraft that are:
            # 1. On ground
            # 2. Have valid position data
            # 3. Have a callsign
            # 4. Not already being tracked
            if (aircraft["on_ground"] and 
                aircraft["longitude"] is not None and 
                aircraft["latitude"] is not None and
                aircraft["callsign"] and
                aircraft["icao24"] not in self.tracking_aircraft):
                
                new_ground_aircraft.append(aircraft)
                
        return new_ground_aircraft
    
    def start_tracking_aircraft(self, aircraft):
        """Start tracking a new aircraft"""
        icao24 = aircraft["icao24"]
        
        tracking_data = {
            "icao24": icao24,
            "callsign": aircraft["callsign"],
            "origin_country": aircraft["origin_country"],
            "tracking_start_time": aircraft["timestamp"],
            "last_update_time": aircraft["timestamp"],
            "flight_status": "ground",
            "takeoff_time": None,
            "positions": [aircraft]
        }
        
        self.tracking_aircraft[icao24] = tracking_data
        
        # Save to database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            INSERT OR REPLACE INTO active_tracking 
            (icao24, callsign, origin_country, tracking_start_time, 
             last_update_time, flight_status, takeoff_time, positions)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ''', (
            icao24, aircraft["callsign"], aircraft["origin_country"],
            aircraft["timestamp"], aircraft["timestamp"], "ground",
            None, json.dumps([aircraft])
        ))
        
        conn.commit()
        conn.close()
        
        print(f"Started tracking {aircraft['callsign']} ({icao24}) on ground")
    
    def update_tracked_aircraft(self, current_states):
        """Update positions for all currently tracked aircraft"""
        # Create lookup dict for current states
        current_aircraft = {}
        for state in current_states:
            aircraft = self.parse_aircraft_state(state)
            if aircraft:
                current_aircraft[aircraft["icao24"]] = aircraft
        
        # Update each tracked aircraft
        completed_flights = []
        
        for icao24, tracking_data in list(self.tracking_aircraft.items()):
            if icao24 in current_aircraft:
                current_pos = current_aircraft[icao24]
                updated = self.update_single_aircraft(tracking_data, current_pos)
                
                # Check if flight is complete
                if updated and tracking_data["flight_status"] == "landed":
                    completed_flights.append(icao24)
            else:
                # Aircraft no longer visible - might have landed or out of range
                print(f"Lost contact with {tracking_data['callsign']} ({icao24})")
                # Keep tracking for a bit longer in case it comes back
                
        # Process completed flights
        for icao24 in completed_flights:
            self.save_completed_flight(icao24)
    
    def update_single_aircraft(self, tracking_data, current_pos):
        """Update a single aircraft's tracking data"""
        icao24 = tracking_data["icao24"]
        previous_status = tracking_data["flight_status"]
        current_on_ground = current_pos["on_ground"]
        
        # Determine current flight status
        if previous_status == "ground" and not current_on_ground:
            # Aircraft is taking off!
            tracking_data["flight_status"] = "takeoff"
            tracking_data["takeoff_time"] = current_pos["timestamp"]
            
            # Clean up ground positions - keep only last ground position and takeoff
            last_ground_pos = tracking_data["positions"][-1]
            tracking_data["positions"] = [last_ground_pos, current_pos]
            
            print(f"🛫 {tracking_data['callsign']} ({icao24}) is taking off!")
            
        elif previous_status in ["takeoff", "airborne"] and not current_on_ground:
            # Continue airborne tracking
            tracking_data["flight_status"] = "airborne"
            tracking_data["positions"].append(current_pos)
            
        elif previous_status in ["takeoff", "airborne"] and current_on_ground:
            # Aircraft has landed!
            tracking_data["flight_status"] = "landed"
            tracking_data["positions"].append(current_pos)
            
            print(f"🛬 {tracking_data['callsign']} ({icao24}) has landed!")
            
        elif previous_status == "ground" and current_on_ground:
            # Still on ground - only keep most recent position
            tracking_data["positions"] = [current_pos]
            
        # Update tracking data
        tracking_data["last_update_time"] = current_pos["timestamp"]
        
        # Save to database
        self.save_tracking_data(tracking_data)
        
        return True
    
    def save_tracking_data(self, tracking_data):
        """Save tracking data to active_tracking table"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('''
            UPDATE active_tracking 
            SET last_update_time = ?, flight_status = ?, takeoff_time = ?, positions = ?
            WHERE icao24 = ?
        ''', (
            tracking_data["last_update_time"],
            tracking_data["flight_status"],
            tracking_data["takeoff_time"],
            json.dumps(tracking_data["positions"]),
            tracking_data["icao24"]
        ))
        
        conn.commit()
        conn.close()
    
    def save_completed_flight(self, icao24):
        """Save completed flight to permanent storage and clean up tracking"""
        if icao24 not in self.tracking_aircraft:
            return
            
        tracking_data = self.tracking_aircraft[icao24]
        positions = tracking_data["positions"]
        
        if len(positions) < 2:
            print(f"Not enough data for flight {tracking_data['callsign']} ({icao24})")
            self.cleanup_tracking(icao24)
            return
        
        # Process flight data
        flight_record = self.process_completed_flight(tracking_data)
        
        if flight_record:
            # Save to flights table
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            
            cursor.execute('''
                INSERT INTO flights (
                    icao24, callsign, origin_country, collection_time,
                    flight_date, departure_time, arrival_time, duration_minutes,
                    start_status, end_status, flight_status,
                    max_altitude, max_velocity, distance_km,
                    position_count, positions
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ''', (
                flight_record['icao24'], flight_record['callsign'], 
                flight_record['origin_country'], flight_record['departure_time'],
                flight_record['flight_date'], flight_record['departure_time'], 
                flight_record['arrival_time'], flight_record['duration_minutes'], 
                flight_record['start_status'], flight_record['end_status'], 
                flight_record['flight_status'], flight_record['max_altitude'], 
                flight_record['max_velocity'], flight_record['distance_km'], 
                flight_record['position_count'], flight_record['positions']
            ))
            
            conn.commit()
            conn.close()
            
            print(f"✅ Saved complete flight for {tracking_data['callsign']} ({icao24})")
            print(f"   Duration: {flight_record['duration_minutes']} minutes")
            print(f"   Max altitude: {flight_record['max_altitude'] if flight_record['max_altitude'] is not None else 'N/A'}m")
            print(f"   Distance: {flight_record['distance_km']:.1f}km" if flight_record['distance_km'] is not None else "   Distance: N/A")
        
        # Clean up tracking data
        self.cleanup_tracking(icao24)
    
    def cleanup_tracking(self, icao24):
        """Remove aircraft from active tracking"""
        if icao24 in self.tracking_aircraft:
            del self.tracking_aircraft[icao24]
        
        # Remove from database
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        cursor.execute('DELETE FROM active_tracking WHERE icao24 = ?', (icao24,))
        conn.commit()
        conn.close()
    
    def process_completed_flight(self, tracking_data):
        """Process tracking data into a flight record"""
        positions = tracking_data["positions"]
        
        if len(positions) < 2:
            return None
        
        first_pos = positions[0]
        last_pos = positions[-1]
        
        # Parse timestamps
        departure_time = datetime.fromisoformat(first_pos['timestamp'])
        arrival_time = datetime.fromisoformat(last_pos['timestamp'])
        duration_minutes = int((arrival_time - departure_time).total_seconds() / 60)
        
        # Calculate statistics
        altitudes = [pos['baro_altitude'] for pos in positions if pos.get('baro_altitude') is not None]
        velocities = [pos['velocity'] for pos in positions if pos.get('velocity') is not None]
        
        max_altitude = max(altitudes) if altitudes else None
        max_velocity = max(velocities) if velocities else None
        
        # Calculate total distance
        total_distance = self.calculate_flight_distance(positions)
        
        # Create compressed position array
        position_array = []
        for pos in positions:
            position_data = {
                'ts': pos['timestamp'],
                'lon': pos.get('longitude'),
                'lat': pos.get('latitude'),
                'alt': pos.get('baro_altitude'),
                'vel': pos.get('velocity'),
                'trk': pos.get('true_track'),
                'vrt': pos.get('vertical_rate'),
                'gnd': pos.get('on_ground')
            }
            # Remove null values to save space
            position_data = {k: v for k, v in position_data.items() if v is not None}
            position_array.append(position_data)
        
        flight_record = {
            'icao24': tracking_data['icao24'],
            'callsign': tracking_data['callsign'],
            'origin_country': tracking_data['origin_country'],
            'flight_date': departure_time.date().isoformat(),
            'departure_time': departure_time.isoformat(),
            'arrival_time': arrival_time.isoformat(),
            'duration_minutes': duration_minutes,
            'start_status': 'ground',
            'end_status': 'ground',
            'flight_status': 'complete',
            'max_altitude': max_altitude,
            'max_velocity': max_velocity,
            'distance_km': total_distance,
            'position_count': len(position_array),
            'positions': json.dumps(position_array)
        }
        
        return flight_record
    
    def calculate_flight_distance(self, positions):
        """Calculate total flight distance"""
        total_distance = 0
        
        for i in range(1, len(positions)):
            prev_pos = positions[i-1]
            curr_pos = positions[i]
            
            if all(k in prev_pos and k in curr_pos and 
                   prev_pos[k] is not None and curr_pos[k] is not None 
                   for k in ['latitude', 'longitude']):
                
                dist = self.calculate_distance(
                    prev_pos['latitude'], prev_pos['longitude'],
                    curr_pos['latitude'], curr_pos['longitude']
                )
                if dist:
                    total_distance += dist
        
        return total_distance if total_distance > 0 else None
    
    def calculate_distance(self, lat1, lon1, lat2, lon2):
        """Calculate distance between two points using Haversine formula"""
        if None in [lat1, lon1, lat2, lon2]:
            return None
        
        # Convert to radians
        lat1, lon1, lat2, lon2 = map(math.radians, [lat1, lon1, lat2, lon2])
        
        # Haversine formula
        dlat = lat2 - lat1
        dlon = lon2 - lon1
        a = math.sin(dlat/2)**2 + math.cos(lat1) * math.cos(lat2) * math.sin(dlon/2)**2
        c = 2 * math.asin(math.sqrt(a))
        r = 6371  # Earth's radius in kilometers
        
        return c * r
    
    def load_active_tracking(self):
        """Load active tracking data from database on startup"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute('SELECT * FROM active_tracking')
        rows = cursor.fetchall()
        
        for row in rows:
            tracking_data = {
                "icao24": row[1],
                "callsign": row[2],
                "origin_country": row[3],
                "tracking_start_time": row[4],
                "last_update_time": row[5],
                "flight_status": row[6],
                "takeoff_time": row[7],
                "positions": json.loads(row[8]) if row[8] else []
            }
            
            self.tracking_aircraft[row[1]] = tracking_data
        
        conn.close()
        print(f"Loaded {len(self.tracking_aircraft)} active tracking sessions")
    
    def cleanup_stale_tracking(self):
        """Clean up aircraft that haven't been updated in a while"""
        current_time = datetime.now(timezone.utc)
        stale_threshold = timedelta(hours=2)
        
        stale_aircraft = []
        
        for icao24, tracking_data in self.tracking_aircraft.items():
            last_update = datetime.fromisoformat(tracking_data["last_update_time"])
            if current_time - last_update > stale_threshold:
                stale_aircraft.append(icao24)
        
        for icao24 in stale_aircraft:
            print(f"Cleaning up stale tracking for {self.tracking_aircraft[icao24]['callsign']} ({icao24})")
            self.cleanup_tracking(icao24)
    
    def run_tracking_cycle(self):
        """Run one cycle of the tracking system"""
        print(f"\n--- Tracking cycle at {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ---")
        
        # Fetch current states
        states = self.fetch_all_states()
        if not states:
            print("No states received, skipping cycle")
            return
        
        print(f"Received {len(states)} aircraft states")
        
        # Find new aircraft on ground
        new_ground_aircraft = self.find_new_ground_aircraft(states)
        print(f"Found {len(new_ground_aircraft)} new ground aircraft")
        
        # Start tracking new aircraft
        for aircraft in new_ground_aircraft:
            self.start_tracking_aircraft(aircraft)
        
        # Update existing tracked aircraft
        if self.tracking_aircraft:
            print(f"Updating {len(self.tracking_aircraft)} tracked aircraft")
            self.update_tracked_aircraft(states)
        
        # Clean up stale tracking
        self.cleanup_stale_tracking()
        
        # Show current status
        status_summary = defaultdict(int)
        for tracking_data in self.tracking_aircraft.values():
            status_summary[tracking_data["flight_status"]] += 1
        
        if status_summary:
            status_str = ", ".join([f"{status}: {count}" for status, count in status_summary.items()])
            print(f"Currently tracking: {status_str}")
        else:
            print("No aircraft currently being tracked")
    
    def start_continuous_tracking(self):
        """Start continuous flight tracking"""
        print(f"Starting continuous flight tracking (every {self.check_interval/60:.1f} minutes)")
        print("Press Ctrl+C to stop")
        
        # Load existing tracking data
        self.load_active_tracking()
        
        self.running = True
        
        try:
            while self.running:
                self.run_tracking_cycle()
                
                if self.running:  # Check again in case stopped during cycle
                    print(f"Waiting {self.check_interval} seconds until next check...")
                    time.sleep(self.check_interval)
                    
        except KeyboardInterrupt:
            print("\nTracking stopped by user")
            self.running = False
    
    def stop_tracking(self):
        """Stop the tracking system"""
        self.running = False
    
    def get_tracking_statistics(self):
        """Get current tracking statistics"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Get flight statistics
        cursor.execute("SELECT COUNT(*) FROM flights")
        total_flights = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(DISTINCT icao24) FROM flights")
        unique_aircraft = cursor.fetchone()[0]
        
        cursor.execute("SELECT COUNT(*) FROM active_tracking")
        active_tracking = cursor.fetchone()[0]
        
        conn.close()
        
        return {
            "total_flights": total_flights,
            "unique_aircraft": unique_aircraft,
            "active_tracking": active_tracking,
            "currently_tracking": len(self.tracking_aircraft)
        }

if __name__ == "__main__":
    # Create and start the flight tracker
    tracker = FlightTracker(check_interval=120)  # Check every 2 minutes
    
    try:
        tracker.start_continuous_tracking()
    except Exception as e:
        print(f"Error in tracking: {e}")
    finally:
        # Show final statistics
        stats = tracker.get_tracking_statistics()
        print(f"\nFinal Statistics:")
        print(f"  Total flights recorded: {stats['total_flights']:,}")
        print(f"  Unique aircraft tracked: {stats['unique_aircraft']:,}")
        print(f"  Active tracking sessions: {stats['active_tracking']:,}")
