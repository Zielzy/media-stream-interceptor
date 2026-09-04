"""
Package the Media Stream Interceptor extension into a clean distribution ZIP.
"""
import os
import json
import zipfile

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC_DIR = os.path.join(ROOT_DIR, "src")
DIST_DIR = os.path.join(ROOT_DIR, "dist")

def main():
    manifest_path = os.path.join(SRC_DIR, "manifest.json")
    with open(manifest_path, "r", encoding="utf-8") as f:
        manifest = json.load(f)
    
    version = manifest.get("version", "1.0.0")
    os.makedirs(DIST_DIR, exist_ok=True)
    
    archive_name = f"media-stream-interceptor-v{version}.zip"
    archive_path = os.path.join(DIST_DIR, archive_name)
    
    if os.path.exists(archive_path):
        os.remove(archive_path)
        
    print(f"Packaging Media Stream Interceptor v{version}...")
    with zipfile.ZipFile(archive_path, "w", zipfile.ZIP_DEFLATED) as zipf:
        for root, dirs, files in os.walk(SRC_DIR):
            for file in files:
                file_path = os.path.join(root, file)
                arcname = os.path.relpath(file_path, SRC_DIR)
                zipf.write(file_path, arcname)
                print(f"  + {arcname}")
                
    print(f"\n[SUCCESS] Package generated: {archive_path}")
    print(f"File size: {os.path.getsize(archive_path):,} bytes")

if __name__ == "__main__":
    main()
