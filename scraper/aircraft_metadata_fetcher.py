import requests
import pandas as pd
import json
import time
from pathlib import Path
import os

class AircraftMetadataFetcher:
    def __init__(self):
        self.cache_file = "aircraft_metadata_cache.json"
        self.metadata_cache = self.load_cache()
        
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
    
    def get_icao24_from_flights(self, flight_files=None):
        """Extract unique ICAO24 codes from flight CSV files"""
        icao24_set = set()
        
        if flight_files is None:
            # Find all flight CSV files in current directory
            flight_files = list(Path(".").glob("flights_*.csv"))
        
        for file_path in flight_files:
            try:
                df = pd.read_csv(file_path)
                if 'icao24' in df.columns:
                    icao24_set.update(df['icao24'].dropna().unique())
                    print(f"Found {df['icao24'].nunique()} unique aircraft in {file_path}")
            except Exception as e:
                print(f"Error reading {file_path}: {e}")
        
        return list(icao24_set)
    
    def fetch_all_metadata(self, icao24_list=None):
        """Fetch metadata for all ICAO24 codes"""
        if icao24_list is None:
            icao24_list = self.get_icao24_from_flights()
        
        print(f"Fetching metadata for {len(icao24_list)} unique aircraft...")
        
        metadata_list = []
        for i, icao24 in enumerate(icao24_list):
            if i > 0 and i % 10 == 0:
                print(f"Processed {i}/{len(icao24_list)} aircraft...")
                time.sleep(1)  # Rate limiting
            
            metadata = self.fetch_aircraft_metadata(icao24)
            if metadata:
                metadata_list.append(metadata)
        
        # Save cache after processing
        self.save_cache()
        
        # Save to CSV
        if metadata_list:
            df = pd.DataFrame(metadata_list)
            filename = f"aircraft_metadata_{pd.Timestamp.now().strftime('%Y%m%d_%H%M%S')}.csv"
            df.to_csv(filename, index=False)
            print(f"Saved metadata for {len(metadata_list)} aircraft to {filename}")
        
        return metadata_list

def main():
    fetcher = AircraftMetadataFetcher()
    fetcher.fetch_all_metadata()

if __name__ == "__main__":
    main()
