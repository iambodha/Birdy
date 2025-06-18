import aiohttp
import asyncio
import requests
import sqlite3
import json
import time
from pathlib import Path
import os

class AircraftMetadataFetcher:
    def __init__(self, max_concurrent=20, db_path="birdy_flights.db"):
        self.cache_file = "aircraft_metadata_cache.json"
        self.metadata_cache = self.load_cache()
        self.max_concurrent = max_concurrent
        self.semaphore = asyncio.Semaphore(max_concurrent)
        self.db_path = db_path
        
    def load_cache(self):
        """Load existing metadata cache"""
        if os.path.exists(self.cache_file):
            with open(self.cache_file, 'r') as f:
                return json.load(f)
        return {}
    
    def save_cache(self):
        """Save metadata cache to file"""
        with open(self.cache_file, 'w') as f:
            json.dump(self.metadata_cache, f, indent=2)
    
    def save_metadata_to_db(self, metadata_list):
        """Save aircraft metadata to SQLite database"""
        if not metadata_list:
            return 0
        
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        # Insert or update aircraft metadata
        insert_query = '''
            INSERT OR REPLACE INTO aircraft_metadata (
                icao24, registration, manufacturer_icao, manufacturer_name, model,
                typecode, serial_number, line_number, icao_aircraft_type, operator,
                operator_callsign, operator_icao, operator_iata, owner, category_description,
                built, first_flight_date, seat_configuration, engines, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        '''
        
        metadata_records = []
        for metadata in metadata_list:
            if metadata:  # Skip None entries
                metadata_records.append((
                    metadata.get("icao24"),
                    metadata.get("registration"),
                    metadata.get("manufacturerIcao"),
                    metadata.get("manufacturerName"),
                    metadata.get("model"),
                    metadata.get("typecode"),
                    metadata.get("serialNumber"),
                    metadata.get("lineNumber"),
                    metadata.get("icaoAircraftType"),
                    metadata.get("operator"),
                    metadata.get("operatorCallsign"),
                    metadata.get("operatorIcao"),
                    metadata.get("operatorIata"),
                    metadata.get("owner"),
                    metadata.get("categoryDescription"),
                    metadata.get("built"),
                    metadata.get("firstFlightDate"),
                    metadata.get("seatConfiguration"),
                    metadata.get("engines")
                ))
        
        cursor.executemany(insert_query, metadata_records)
        conn.commit()
        
        rows_inserted = cursor.rowcount
        conn.close()
        
        return rows_inserted
    
    def fetch_aircraft_metadata(self, icao24):
        """Fetch aircraft metadata from OpenSky Network"""
        if icao24 in self.metadata_cache:
            return self.metadata_cache[icao24]
        
        url = f"https://opensky-network.org/api/metadata/aircraft/icao/{icao24}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        try:
            response = requests.get(url, headers=headers, timeout=10)
            if response.status_code == 200:
                data = response.json()
                metadata = {
                    "icao24": icao24,
                    "registration": data.get("registration"),
                    "manufacturerIcao": data.get("manufacturerIcao"),
                    "manufacturerName": data.get("manufacturerName"), 
                    "model": data.get("model"),
                    "typecode": data.get("typecode"),
                    "serialNumber": data.get("serialNumber"),
                    "lineNumber": data.get("lineNumber"),
                    "icaoAircraftType": data.get("icaoAircraftType"),
                    "operator": data.get("operator"),
                    "operatorCallsign": data.get("operatorCallsign"),
                    "operatorIcao": data.get("operatorIcao"),
                    "operatorIata": data.get("operatorIata"),
                    "owner": data.get("owner"),
                    "categoryDescription": data.get("categoryDescription"),
                    "built": data.get("built"),
                    "firstFlightDate": data.get("firstFlightDate"),
                    "seatConfiguration": data.get("seatConfiguration"),
                    "engines": data.get("engines")
                }
                self.metadata_cache[icao24] = metadata
                return metadata
            else:
                print(f"Failed to fetch metadata for {icao24}: HTTP {response.status_code}")
                return None
                
        except requests.exceptions.RequestException as e:
            print(f"Error fetching metadata for {icao24}: {e}")
            return None

    async def fetch_aircraft_metadata_async(self, session, icao24):
        """Fetch aircraft metadata asynchronously"""
        if icao24 in self.metadata_cache:
            return self.metadata_cache[icao24]
        
        url = f"https://opensky-network.org/api/metadata/aircraft/icao/{icao24}"
        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"
        }
        
        async with self.semaphore:
            try:
                async with session.get(url, headers=headers, timeout=10) as response:
                    if response.status == 200:
                        data = await response.json()
                        metadata = {
                            "icao24": icao24,
                            "registration": data.get("registration"),
                            "manufacturerIcao": data.get("manufacturerIcao"),
                            "manufacturerName": data.get("manufacturerName"), 
                            "model": data.get("model"),
                            "typecode": data.get("typecode"),
                            "serialNumber": data.get("serialNumber"),
                            "lineNumber": data.get("lineNumber"),
                            "icaoAircraftType": data.get("icaoAircraftType"),
                            "operator": data.get("operator"),
                            "operatorCallsign": data.get("operatorCallsign"),
                            "operatorIcao": data.get("operatorIcao"),
                            "operatorIata": data.get("operatorIata"),
                            "owner": data.get("owner"),
                            "categoryDescription": data.get("categoryDescription"),
                            "built": data.get("built"),
                            "firstFlightDate": data.get("firstFlightDate"),
                            "seatConfiguration": data.get("seatConfiguration"),
                            "engines": data.get("engines")
                        }
                        self.metadata_cache[icao24] = metadata
                        return metadata
                    else:
                        print(f"Failed to fetch metadata for {icao24}: HTTP {response.status}")
                        return None
                        
            except Exception as e:
                print(f"Error fetching metadata for {icao24}: {e}")
                return None

    def get_icao24_from_database(self):
        """Extract unique ICAO24 codes from database"""
        conn = sqlite3.connect(self.db_path)
        cursor = conn.cursor()
        
        cursor.execute("SELECT DISTINCT icao24 FROM flights")
        icao24_list = [row[0] for row in cursor.fetchall()]
        
        conn.close()
        print(f"Found {len(icao24_list)} unique aircraft in database")
        return icao24_list

    def get_icao24_from_flights(self, flight_files=None):
        """Extract unique ICAO24 codes from flight CSV files (legacy method)"""
        icao24_set = set()
        
        if flight_files is None:
            # Find all flight CSV files in current directory
            flight_files = list(Path(".").glob("flights_*.csv"))
        
        for file_path in flight_files:
            try:
                import pandas as pd
                df = pd.read_csv(file_path)
                if 'icao24' in df.columns:
                    icao24_set.update(df['icao24'].dropna().unique())
                    print(f"Found {df['icao24'].nunique()} unique aircraft in {file_path}")
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
        
        return list(icao24_set)

    async def fetch_all_metadata_async(self, icao24_list=None):
        """Fetch metadata for all ICAO24 codes asynchronously"""
        if icao24_list is None:
            # Try to get from database first, fall back to CSV files
            try:
                icao24_list = self.get_icao24_from_database()
            except:
                icao24_list = self.get_icao24_from_flights()
        
        # Filter out already cached items
        uncached_icao24 = [icao for icao in icao24_list if icao not in self.metadata_cache]
        print(f"Fetching metadata for {len(uncached_icao24)} new aircraft (using cache for {len(icao24_list) - len(uncached_icao24)})...")
        
        metadata_list = []
        
        # Add cached items first
        for icao24 in icao24_list:
            if icao24 in self.metadata_cache:
                metadata_list.append(self.metadata_cache[icao24])
        
        if uncached_icao24:
            connector = aiohttp.TCPConnector(limit=self.max_concurrent)
            timeout = aiohttp.ClientTimeout(total=30)
            
            async with aiohttp.ClientSession(connector=connector, timeout=timeout) as session:
                tasks = [self.fetch_aircraft_metadata_async(session, icao24) for icao24 in uncached_icao24]
                
                # Process in batches with progress updates
                batch_size = 50
                for i in range(0, len(tasks), batch_size):
                    batch = tasks[i:i + batch_size]
                    results = await asyncio.gather(*batch, return_exceptions=True)
                    
                    for result in results:
                        if isinstance(result, dict):
                            metadata_list.append(result)
                    
                    print(f"Processed {min(i + batch_size, len(tasks))}/{len(tasks)} requests...")
                    await asyncio.sleep(0.1)  # Small delay between batches
        
        # Save cache after processing
        self.save_cache()
        
        # Save to database instead of CSV
        if metadata_list:
            rows_saved = self.save_metadata_to_db(metadata_list)
            print(f"Saved metadata for {rows_saved} aircraft to database '{self.db_path}'")
            
            # Show database stats
            conn = sqlite3.connect(self.db_path)
            cursor = conn.cursor()
            cursor.execute("SELECT COUNT(*) FROM aircraft_metadata")
            total_metadata = cursor.fetchone()[0]
            conn.close()
            
            print(f"Total aircraft metadata in database: {total_metadata:,}")
        
        return metadata_list

    def fetch_all_metadata(self, icao24_list=None):
        """Synchronous wrapper for async metadata fetching"""
        return asyncio.run(self.fetch_all_metadata_async(icao24_list))

async def main_async():
    fetcher = AircraftMetadataFetcher(max_concurrent=15)
    await fetcher.fetch_all_metadata_async()

def main():
    asyncio.run(main_async())

if __name__ == "__main__":
    main()
