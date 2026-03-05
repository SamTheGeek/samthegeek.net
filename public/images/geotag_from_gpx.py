#!/usr/bin/env python3
"""
geotag_from_gpx.py
──────────────────
For every JPEG in the gallery folders (except Copenhagen), checks whether the
photo already has embedded GPS EXIF data.  If it doesn't, it looks up the
photo's DateTimeOriginal in the GPX file, interpolates the coordinates from
the nearest trackpoints, and writes GPS tags back into the file in-place.

Usage
─────
    python3 geotag_from_gpx.py  <gpx_file>  <gallery_root>  [options]

Arguments
─────────
    gpx_file        Path to your consolidated .gpx file
    gallery_root    Root folder containing canada/, italy/, japan/, etc.

Options
───────
    --dry-run       Print what would be changed without modifying any files
    --max-gap 300   Maximum seconds between photo time and nearest GPX point
                    before skipping that photo (default: 300 s = 5 minutes)
    --folders       Comma-separated list of sub-folders to process
                    (default: canada,italy,japan,france,elsewhere,los-angeles)
    --offset +HH:MM Manually shift photo timestamps by this amount before
                    matching against GPX (e.g. +02:00 or -05:30).  Use this
                    if your camera clock was in a different timezone than the
                    GPX timestamps.

Dependencies
────────────
    pip install gpxpy piexif Pillow

Output
──────
    Prints a summary and writes geotag_report.txt next to the gallery root.
"""

import argparse
import bisect
import os
import re
import struct
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import gpxpy
    import piexif
    from PIL import Image
except ImportError as e:
    sys.exit(f"Missing dependency: {e}\nRun: pip install gpxpy piexif Pillow")


# ── helpers ──────────────────────────────────────────────────────────────────

def to_deg_min_sec(decimal_degrees):
    """Convert decimal degrees to (degrees, minutes, seconds) as rationals."""
    d = abs(decimal_degrees)
    degrees = int(d)
    minutes = int((d - degrees) * 60)
    seconds = round((d - degrees - minutes / 60) * 3600, 5)
    # Store as (numerator, denominator) tuples suitable for piexif
    return (
        (degrees, 1),
        (minutes, 1),
        (int(seconds * 10000), 10000),
    )


def dms_to_decimal(dms_tuple, ref):
    """Convert piexif DMS tuple + ref back to decimal degrees."""
    d = dms_tuple[0][0] / dms_tuple[0][1]
    m = dms_tuple[1][0] / dms_tuple[1][1]
    s = dms_tuple[2][0] / dms_tuple[2][1]
    val = d + m / 60 + s / 3600
    if ref in (b'S', b'W'):
        val = -val
    return val


def has_gps(exif_dict):
    """Return True if the EXIF already contains meaningful GPS coordinates."""
    gps = exif_dict.get("GPS", {})
    return (
        piexif.GPSIFD.GPSLatitude in gps
        and piexif.GPSIFD.GPSLongitude in gps
        and gps[piexif.GPSIFD.GPSLatitude] != ((0, 1), (0, 1), (0, 1))
    )


def read_datetime_original(exif_dict, tz_offset_seconds=0):
    """
    Extract DateTimeOriginal from EXIF and return a UTC-aware datetime.
    Falls back to DateTime if DateTimeOriginal is absent.
    Returns None if no date is found.
    """
    exif = exif_dict.get("Exif", {})
    raw = (
        exif.get(piexif.ExifIFD.DateTimeOriginal)
        or exif_dict.get("0th", {}).get(piexif.ImageIFD.DateTime)
    )
    if not raw:
        return None
    try:
        if isinstance(raw, bytes):
            raw = raw.decode("ascii", errors="replace")
        dt = datetime.strptime(raw.strip(), "%Y:%m:%d %H:%M:%S")
        # Treat the camera time as local, shift by the given offset, then mark UTC
        dt = dt - timedelta(seconds=tz_offset_seconds)
        return dt.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


# ── GPX loading ───────────────────────────────────────────────────────────────

def load_gpx_points(gpx_path):
    """
    Parse the GPX file and return a sorted list of
    (unix_timestamp, lat, lon, ele) tuples.
    """
    with open(gpx_path, "r", encoding="utf-8") as f:
        gpx = gpxpy.parse(f)

    points = []
    for track in gpx.tracks:
        for segment in track.segments:
            for pt in segment.points:
                if pt.time is None:
                    continue
                ts = pt.time.timestamp()
                points.append((ts, pt.latitude, pt.longitude, pt.elevation or 0.0))

    # Also pick up waypoints with times
    for wp in gpx.waypoints:
        if wp.time is not None:
            ts = wp.time.timestamp()
            points.append((ts, wp.latitude, wp.longitude, wp.elevation or 0.0))

    points.sort(key=lambda x: x[0])
    print(f"Loaded {len(points):,} GPX points from {os.path.basename(gpx_path)}")
    if points:
        t0 = datetime.fromtimestamp(points[0][0], tz=timezone.utc)
        t1 = datetime.fromtimestamp(points[-1][0], tz=timezone.utc)
        print(f"  GPX coverage: {t0:%Y-%m-%d %H:%M} → {t1:%Y-%m-%d %H:%M} UTC")
    return points


def interpolate_coords(points, target_ts, max_gap_secs):
    """
    Find the two surrounding GPX points and linearly interpolate.
    Returns (lat, lon, ele) or None if no point is within max_gap_secs.
    """
    if not points:
        return None

    timestamps = [p[0] for p in points]
    idx = bisect.bisect_left(timestamps, target_ts)

    # Clamp to valid indices
    if idx == 0:
        gap = abs(points[0][0] - target_ts)
        if gap > max_gap_secs:
            return None
        return points[0][1], points[0][2], points[0][3]

    if idx >= len(points):
        gap = abs(points[-1][0] - target_ts)
        if gap > max_gap_secs:
            return None
        return points[-1][1], points[-1][2], points[-1][3]

    before = points[idx - 1]
    after  = points[idx]
    span   = after[0] - before[0]

    # Check the nearest point is within max_gap
    nearest_gap = min(abs(target_ts - before[0]), abs(target_ts - after[0]))
    if nearest_gap > max_gap_secs:
        return None

    if span == 0:
        return before[1], before[2], before[3]

    t = (target_ts - before[0]) / span
    lat = before[1] + t * (after[1] - before[1])
    lon = before[2] + t * (after[2] - before[2])
    ele = before[3] + t * (after[3] - before[3])
    return lat, lon, ele


# ── EXIF writing ──────────────────────────────────────────────────────────────

def write_gps_exif(image_path, lat, lon, ele, dry_run=False):
    """Add GPS tags to the JPEG in-place. Returns True on success."""
    try:
        exif_dict = piexif.load(str(image_path))
    except Exception as e:
        return False, f"Could not load EXIF: {e}"

    gps_ifd = {
        piexif.GPSIFD.GPSVersionID: (2, 3, 0, 0),
        piexif.GPSIFD.GPSLatitudeRef:  b'N' if lat >= 0 else b'S',
        piexif.GPSIFD.GPSLatitude:     to_deg_min_sec(lat),
        piexif.GPSIFD.GPSLongitudeRef: b'E' if lon >= 0 else b'W',
        piexif.GPSIFD.GPSLongitude:    to_deg_min_sec(lon),
        piexif.GPSIFD.GPSAltitudeRef:  0 if ele >= 0 else 1,
        piexif.GPSIFD.GPSAltitude:     (int(abs(ele) * 100), 100),
    }
    exif_dict["GPS"] = gps_ifd

    if dry_run:
        return True, "dry-run"

    try:
        exif_bytes = piexif.dump(exif_dict)
        piexif.insert(exif_bytes, str(image_path))
        return True, "ok"
    except Exception as e:
        return False, f"Could not write EXIF: {e}"


# ── main ──────────────────────────────────────────────────────────────────────

def parse_offset(s):
    """Parse '+HH:MM' or '-HH:MM' into total seconds."""
    m = re.fullmatch(r'([+-])(\d{1,2}):(\d{2})', s.strip())
    if not m:
        raise argparse.ArgumentTypeError(f"Invalid offset '{s}'. Use format +HH:MM or -HH:MM")
    sign = 1 if m.group(1) == '+' else -1
    return sign * (int(m.group(2)) * 3600 + int(m.group(3)) * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Geotag gallery JPEGs from a consolidated GPX file.",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    parser.add_argument("gpx_file",     help="Path to the .gpx file")
    parser.add_argument("gallery_root", help="Root folder of the gallery")
    parser.add_argument("--dry-run",    action="store_true",
                        help="Show what would change without modifying files")
    parser.add_argument("--max-gap",    type=int, default=300,
                        help="Max seconds between photo and nearest GPX point (default: 300)")
    parser.add_argument("--folders",    default="canada,italy,japan,france,elsewhere,los-angeles",
                        help="Comma-separated sub-folders to process")
    parser.add_argument("--offset",     type=parse_offset, default=0,
                        metavar="+HH:MM",
                        help="Shift camera timestamps before matching (e.g. +02:00)")
    args = parser.parse_args()

    gpx_path     = Path(args.gpx_file).expanduser().resolve()
    gallery_root = Path(args.gallery_root).expanduser().resolve()
    folders      = [f.strip() for f in args.folders.split(",")]

    if not gpx_path.exists():
        sys.exit(f"GPX file not found: {gpx_path}")
    if not gallery_root.is_dir():
        sys.exit(f"Gallery root not found: {gallery_root}")

    print(f"\n{'DRY RUN — ' if args.dry_run else ''}Geotagging photos in {gallery_root}")
    print(f"Max gap: {args.max_gap}s  |  Clock offset: {args.offset:+}s\n")

    gpx_points = load_gpx_points(gpx_path)
    if not gpx_points:
        sys.exit("No timed points found in the GPX file.")

    IMAGE_EXTS = {'.jpg', '.jpeg'}

    results = {
        'already_geotagged': [],
        'geotagged_now':     [],
        'no_exif_date':      [],
        'outside_gpx':       [],
        'error':             [],
        'skipped_webp':      [],
    }

    for folder_name in folders:
        folder_path = gallery_root / folder_name
        if not folder_path.is_dir():
            print(f"  Skipping missing folder: {folder_name}")
            continue

        images = sorted(p for p in folder_path.iterdir()
                        if p.suffix.lower() in IMAGE_EXTS)
        print(f"\n{folder_name}/ — {len(images)} images")

        for img_path in images:
            try:
                exif_dict = piexif.load(str(img_path))
            except Exception as e:
                results['error'].append((str(img_path), str(e)))
                print(f"  ✗ ERROR  {img_path.name}: {e}")
                continue

            if has_gps(exif_dict):
                results['already_geotagged'].append(str(img_path))
                print(f"  · skip   {img_path.name}  (has GPS)")
                continue

            dt = read_datetime_original(exif_dict, tz_offset_seconds=args.offset)
            if dt is None:
                results['no_exif_date'].append(str(img_path))
                print(f"  ? nodate {img_path.name}  (no DateTimeOriginal)")
                continue

            coords = interpolate_coords(gpx_points, dt.timestamp(), args.max_gap)
            if coords is None:
                results['outside_gpx'].append((str(img_path), dt.isoformat()))
                print(f"  ○ nogpx  {img_path.name}  ({dt:%Y-%m-%d %H:%M:%S} UTC)")
                continue

            lat, lon, ele = coords
            ok, msg = write_gps_exif(img_path, lat, lon, ele, dry_run=args.dry_run)
            if ok:
                results['geotagged_now'].append((str(img_path), lat, lon))
                tag = "dry-run" if args.dry_run else "✓ tagged"
                print(f"  {tag} {img_path.name}  → {lat:.5f}, {lon:.5f}")
            else:
                results['error'].append((str(img_path), msg))
                print(f"  ✗ ERROR  {img_path.name}: {msg}")

    # ── summary ───────────────────────────────────────────────────────────────
    print("\n" + "─" * 60)
    print("SUMMARY")
    print("─" * 60)
    print(f"  Already had GPS:    {len(results['already_geotagged']):4d}")
    print(f"  {'Would tag' if args.dry_run else 'Tagged'}:            {len(results['geotagged_now']):4d}")
    print(f"  No EXIF date:       {len(results['no_exif_date']):4d}")
    print(f"  Outside GPX range:  {len(results['outside_gpx']):4d}")
    print(f"  Errors:             {len(results['error']):4d}")

    # Write report
    report_path = gallery_root / "geotag_report.txt"
    with open(report_path, "w") as f:
        f.write(f"Geotag report — {datetime.now():%Y-%m-%d %H:%M:%S}\n")
        f.write(f"GPX file: {gpx_path}\n")
        f.write(f"Max gap:  {args.max_gap}s\n")
        f.write(f"Offset:   {args.offset:+}s\n\n")

        f.write(f"Already geotagged ({len(results['already_geotagged'])}):\n")
        for p in results['already_geotagged']:
            f.write(f"  {p}\n")

        f.write(f"\nTagged now ({len(results['geotagged_now'])}):\n")
        for p, lat, lon in results['geotagged_now']:
            f.write(f"  {p}  ({lat:.5f}, {lon:.5f})\n")

        f.write(f"\nNo EXIF date — could not match ({len(results['no_exif_date'])}):\n")
        for p in results['no_exif_date']:
            f.write(f"  {p}\n")

        f.write(f"\nOutside GPX coverage ({len(results['outside_gpx'])}):\n")
        for p, dt in results['outside_gpx']:
            f.write(f"  {p}  (photo time: {dt})\n")

        f.write(f"\nErrors ({len(results['error'])}):\n")
        for p, msg in results['error']:
            f.write(f"  {p}  — {msg}\n")

    print(f"\nReport written to: {report_path}")
    if results['outside_gpx'] or results['no_exif_date']:
        print("\nPhotos that couldn't be geotagged are listed in geotag_report.txt")


if __name__ == "__main__":
    main()
