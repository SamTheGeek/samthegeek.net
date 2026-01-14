#!/usr/bin/env python3
"""Extract EXIF metadata into gallery JSON files.

Requires: pip install exifread
Environment: PUBLIC_GOOGLE_MAPS_EMBED_API_KEY (preferred) or GOOGLE_MAPS_API_KEY
"""

from __future__ import annotations

import argparse
import json
import os
import re
import subprocess
import sys
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, Iterable, List, Optional, Tuple
from urllib.parse import urlencode
from urllib.request import Request, urlopen
import time

def load_dotenv() -> None:
    root = Path(__file__).resolve().parents[1]
    env_path = root / ".env"
    if not env_path.exists():
        return
    for line in env_path.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        os.environ.setdefault(key, value)


def ensure_exifread() -> "module":
    try:
        import exifread  # type: ignore

        return exifread
    except ImportError:
        pass

    if sys.prefix != sys.base_prefix:
        subprocess.check_call([sys.executable, "-m", "pip", "install", "exifread"])
        import exifread  # type: ignore

        return exifread

    if os.environ.get("STG_BOOTSTRAPPED") == "1":
        print("Missing dependency: exifread. Install with `python -m pip install exifread`.")
        sys.exit(1)

    root = Path(__file__).resolve().parents[1]
    venv_dir = root / ".venv"
    python_bin = venv_dir / ("Scripts/python.exe" if os.name == "nt" else "bin/python")
    if not venv_dir.exists():
        subprocess.check_call([sys.executable, "-m", "venv", str(venv_dir)])
    subprocess.check_call([str(python_bin), "-m", "pip", "install", "exifread"])
    env = os.environ.copy()
    env["STG_BOOTSTRAPPED"] = "1"
    os.execvpe(str(python_bin), [str(python_bin), __file__] + sys.argv[1:], env)
    raise SystemExit(0)


load_dotenv()
exifread = ensure_exifread()


IMAGE_EXTENSIONS = {".jpg", ".jpeg", ".png", ".JPG", ".JPEG", ".PNG"}
DEFAULT_IMAGES_DIR = Path("public/images")
DEFAULT_GALLERIES_DIR = Path("src/content/galleries")
CITY_TYPES = ("locality", "postal_town", "administrative_area_level_3", "administrative_area_level_2")


@dataclass
class ExifPayload:
    date: Optional[str]
    camera: Optional[str]
    lens: Optional[str]
    focal_length: Optional[str]
    aperture: Optional[str]
    shutter_speed: Optional[str]
    iso: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]
    location: Optional[str]


def parse_exif_datetime(tags: Dict[str, object]) -> Optional[datetime]:
    for key in ("EXIF DateTimeOriginal", "EXIF DateTimeDigitized", "Image DateTime"):
        raw = tags.get(key)
        if raw:
            try:
                return datetime.strptime(str(raw), "%Y:%m:%d %H:%M:%S")
            except ValueError:
                continue
    return None


def unwrap_exif_value(value):
    if value is None:
        return None
    if hasattr(value, "values") and value.values:
        return value.values[0]
    return value


def ratio_to_float(value) -> float:
    value = unwrap_exif_value(value)
    if value is None:
        return 0.0
    try:
        return float(value.num) / float(value.den)
    except AttributeError:
        return float(value)


def format_ratio(value) -> Optional[str]:
    if value is None:
        return None
    number = ratio_to_float(value)
    if abs(number - round(number)) < 0.05:
        return str(int(round(number)))
    return f"{number:.1f}"


def format_exposure(value) -> Optional[str]:
    if value is None:
        return None
    value = unwrap_exif_value(value)
    try:
        numerator = value.num
        denominator = value.den
        if numerator < denominator:
            return f"{numerator}/{denominator}s"
        return f"{ratio_to_float(value):.1f}s"
    except AttributeError:
        return str(value)


def parse_gps(tags: Dict[str, object]) -> Optional[Tuple[float, float]]:
    lat = tags.get("GPS GPSLatitude")
    lat_ref = tags.get("GPS GPSLatitudeRef")
    lon = tags.get("GPS GPSLongitude")
    lon_ref = tags.get("GPS GPSLongitudeRef")
    if not (lat and lat_ref and lon and lon_ref):
        return None

    lat_values = [ratio_to_float(v) for v in lat.values]
    lon_values = [ratio_to_float(v) for v in lon.values]
    lat_deg = lat_values[0] + lat_values[1] / 60 + lat_values[2] / 3600
    lon_deg = lon_values[0] + lon_values[1] / 60 + lon_values[2] / 3600
    if str(lat_ref).upper().startswith("S"):
        lat_deg *= -1
    if str(lon_ref).upper().startswith("W"):
        lon_deg *= -1
    return (lat_deg, lon_deg)


def reverse_geocode_city(
    lat: float,
    lon: float,
    api_key: str,
    cache: Dict[Tuple[float, float], Optional[str]],
) -> Optional[str]:
    cache_key = (round(lat, 5), round(lon, 5))
    if cache_key in cache:
        return cache[cache_key]
    params = urlencode({"latlng": f"{lat},{lon}", "key": api_key})
    url = f"https://maps.googleapis.com/maps/api/geocode/json?{params}"
    req = Request(url, headers={"User-Agent": "Mozilla/5.0"})
    with urlopen(req, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    city = None
    if payload.get("status") == "OK":
        for result in payload.get("results", []):
            for component in result.get("address_components", []):
                if any(t in component.get("types", []) for t in CITY_TYPES):
                    city = component.get("long_name")
                    break
            if city:
                break
    cache[cache_key] = city
    return city


def reverse_geocode_city_nominatim(
    lat: float,
    lon: float,
    cache: Dict[Tuple[float, float], Optional[str]],
    user_agent: str,
) -> Optional[str]:
    cache_key = (round(lat, 5), round(lon, 5))
    if cache_key in cache:
        return cache[cache_key]
    params = urlencode({"lat": f"{lat}", "lon": f"{lon}", "format": "json", "zoom": "10", "addressdetails": "1"})
    url = f"https://nominatim.openstreetmap.org/reverse?{params}"
    req = Request(url, headers={"User-Agent": user_agent})
    with urlopen(req, timeout=30) as response:
        payload = json.loads(response.read().decode("utf-8"))
    address = payload.get("address", {})
    city = address.get("city") or address.get("town") or address.get("village") or address.get("county")
    cache[cache_key] = city
    time.sleep(1)
    return city


def format_camera(tags: Dict[str, object]) -> Optional[str]:
    make = str(tags.get("Image Make") or "").strip()
    model = str(tags.get("Image Model") or "").strip()
    if not make and not model:
        return None
    if make and model and make.lower() in model.lower():
        return model
    return " ".join(part for part in [make, model] if part)


def format_lens(tags: Dict[str, object]) -> Optional[str]:
    lens = str(tags.get("EXIF LensModel") or "").strip()
    if lens:
        return lens
    lens_make = str(tags.get("EXIF LensMake") or "").strip()
    lens_spec = str(tags.get("EXIF LensSpecification") or "").strip()
    if lens_make or lens_spec:
        return " ".join(part for part in [lens_make, lens_spec] if part)
    return None


def format_settings(tags: Dict[str, object]) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[str]]:
    focal = tags.get("EXIF FocalLength")
    aperture = tags.get("EXIF FNumber") or tags.get("EXIF ApertureValue")
    exposure = tags.get("EXIF ExposureTime") or tags.get("EXIF ShutterSpeedValue")
    iso = tags.get("EXIF ISOSpeedRatings")

    focal_str = None
    if focal:
        focal_value = format_ratio(focal)
        if focal_value:
            focal_str = f"{focal_value}mm"

    aperture_str = None
    if aperture:
        aperture_value = format_ratio(aperture)
        if aperture_value:
            aperture_str = f"f/{aperture_value}"

    shutter_str = format_exposure(exposure)

    iso_str = None
    if iso:
        iso_value = unwrap_exif_value(iso)
        iso_str = f"ISO {iso_value}"

    return focal_str, aperture_str, shutter_str, iso_str


def iter_image_files(folder: Path) -> Iterable[Path]:
    for path in folder.iterdir():
        if path.is_file() and path.suffix in IMAGE_EXTENSIONS:
            yield path


def extract_exif_for_image(path: Path, api_key: Optional[str], cache: Dict[Tuple[float, float], Optional[str]]) -> ExifPayload:
    with path.open("rb") as handle:
        tags = exifread.process_file(handle, details=False)
    taken_at = parse_exif_datetime(tags)
    date = taken_at.strftime("%Y:%m:%d %H:%M:%S") if taken_at else None
    camera = format_camera(tags)
    lens = format_lens(tags)
    focal_length, aperture, shutter_speed, iso = format_settings(tags)
    gps = parse_gps(tags)
    latitude = gps[0] if gps else None
    longitude = gps[1] if gps else None

    location = None
    if gps and api_key:
        location = reverse_geocode_city(latitude, longitude, api_key, cache)
    elif gps:
        user_agent = os.environ.get("NOMINATIM_USER_AGENT", "samthegeek-exif")
        location = reverse_geocode_city_nominatim(latitude, longitude, cache, user_agent)

    return ExifPayload(
        date=date,
        camera=camera,
        lens=lens,
        focal_length=focal_length,
        aperture=aperture,
        shutter_speed=shutter_speed,
        iso=iso,
        latitude=latitude,
        longitude=longitude,
        location=location,
    )


def to_exif_dict(payload: ExifPayload) -> Dict[str, object]:
    data: Dict[str, object] = {}
    if payload.date:
        data["date"] = payload.date
    if payload.camera:
        data["camera"] = payload.camera
    if payload.lens:
        data["lens"] = payload.lens
    if payload.focal_length:
        data["focalLength"] = payload.focal_length
    if payload.aperture:
        data["aperture"] = payload.aperture
    if payload.shutter_speed:
        data["shutterSpeed"] = payload.shutter_speed
    if payload.iso:
        data["iso"] = payload.iso
    if payload.latitude is not None and payload.longitude is not None:
        data["latitude"] = payload.latitude
        data["longitude"] = payload.longitude
    if payload.location:
        data["location"] = payload.location
    return data


def parse_src_to_path(src: str, images_dir: Path) -> Optional[Path]:
    match = re.match(r"^/images/(?P<gallery>[^/]+)/(?P<file>.+)$", src)
    if not match:
        return None
    return images_dir / match.group("gallery") / match.group("file")

def get_maps_api_key() -> Optional[str]:
    return os.environ.get("PUBLIC_GOOGLE_MAPS_EMBED_API_KEY") or os.environ.get("GOOGLE_MAPS_API_KEY")


def extract_gallery_exif(gallery_name: str, images_dir: Path, galleries_dir: Path) -> bool:
    json_path = galleries_dir / f"{gallery_name}.json"
    if not json_path.exists():
        print(f"Gallery JSON not found: {json_path}")
        return False
    data = json.loads(json_path.read_text())
    images = data.get("images", [])
    if not images:
        print(f"No images found in JSON: {json_path}")
        return False

    api_key = get_maps_api_key()
    cache: Dict[Tuple[float, float], Optional[str]] = {}
    updated = False
    processed_any = False

    for image in images:
        src = image.get("jpgSrc") or image.get("src")
        if not src:
            continue
        image_path = parse_src_to_path(src, images_dir)
        if not image_path or not image_path.exists():
            print(f"Missing file for EXIF: {src}")
            continue
        payload = extract_exif_for_image(image_path, api_key, cache)
        exif_data = to_exif_dict(payload)
        processed_any = True
        if exif_data:
            image["exif"] = exif_data
            updated = True
        else:
            image.pop("exif", None)

    if updated:
        json_path.write_text(json.dumps(data, indent=2))
        print(f"Updated EXIF metadata: {json_path}")
    elif processed_any:
        print(f"No EXIF data found for: {json_path}")
    return updated


def main() -> int:
    parser = argparse.ArgumentParser(description="Extract EXIF metadata into gallery JSON files.")
    parser.add_argument("gallery", help="Gallery slug (e.g., copenhagen)")
    parser.add_argument("--images-dir", type=Path, default=DEFAULT_IMAGES_DIR)
    parser.add_argument("--galleries-dir", type=Path, default=DEFAULT_GALLERIES_DIR)
    args = parser.parse_args()

    if not args.images_dir.exists():
        print(f"Images directory not found: {args.images_dir}")
        return 1
    if not args.galleries_dir.exists():
        print(f"Galleries directory not found: {args.galleries_dir}")
        return 1

    extract_gallery_exif(args.gallery, args.images_dir, args.galleries_dir)
    return 0


if __name__ == "__main__":
    sys.exit(main())
