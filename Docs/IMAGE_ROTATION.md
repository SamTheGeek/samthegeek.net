# Fixing Image Rotation

Some photos display sideways on the site. This document explains why, and how to
fix them.

## Why photos end up sideways

A camera held in portrait usually doesn't rotate the pixels it writes. It stores
a landscape frame and adds an EXIF `Orientation` tag saying "turn this 90°
before showing it". Browsers, macOS Preview, and Windows Photos all honour that
tag, so the JPEG looks upright everywhere.

WebP files, as we write them, carry no EXIF at all. The original conversion
encoded the stored pixels and dropped the tag with the rest of the metadata, so
the instruction to rotate went missing and the photo now displays exactly as it
was stored: on its side.

Two fixes follow from that:

- **New photos** — `scripts/process-gallery-images.mjs` now calls sharp's
  `autoOrient()` before encoding, baking the tag's rotation into the pixels. It
  also records the *displayed* dimensions in the gallery JSON, so a portrait
  photo is no longer registered as landscape.
- **Photos already converted** — the tag is gone and can't be recovered, so the
  correct rotation has to be supplied by a human. That's what the workflow below
  is for.

## The rotation workflow

### 1. Collect the URLs

Browse the site and copy the URL of each sideways photo. The easiest way is to
open the photo in the lightbox and copy the address bar — that gives you a
`/<gallery>/?photo=<filename>` link, which the tool understands directly.
Anything else that identifies the image works too:

| Form | Example |
| --- | --- |
| Lightbox link | `https://samthegeek.net/japan/?photo=DSCF1234.webp` |
| Live URL | `https://samthegeek.net/images/japan/DSCF1234.webp` |
| Deploy preview URL | `https://deploy-preview-12--samthegeeknet.netlify.app/images/japan/DSCF1234.webp` |
| Astro-optimized URL | `/_image?href=%2Fimages%2Fjapan%2FDSCF1234.webp&w=800&f=webp` |
| Site-root path | `/images/japan/DSCF1234.webp` |
| Repo path | `public/images/japan/DSCF1234.webp` |
| Gallery + filename | `japan/DSCF1234.webp` |
| Bare filename | `DSCF1234.webp` (as long as it's unique across galleries) |

A URL whose extension no longer exists on disk still resolves — gallery JSON
`src` fields point at legacy `.jpg` paths, and those fall back to the `.webp`
sibling.

### 2. Decide the rotation

Three operations, described from the viewer's point of view — how far the photo
has to turn to become upright:

| Rotation | Use when | Aliases |
| --- | --- | --- |
| `cw` | The top of the photo is on the left | `90`, `right`, `clockwise` |
| `ccw` | The top of the photo is on the right | `270`, `-90`, `left` |
| `180` | The photo is upside down | `flip`, `upside-down` |

### 3. Run the workflow

Trigger **Rotate Images** from the GitHub Actions tab:

- **images** — the URLs, separated by commas or newlines
- **rotation** — the rotation applied to every entry that doesn't specify one
- **quality** — WebP/JPEG re-encode quality, default `100`
- **dry_run** — preview the result in the job summary without opening a PR

If a batch needs more than one rotation, append the rotation to individual
entries. Those override the workflow's `rotation` input:

```text
/images/japan/DSCF1234.webp,
/images/japan/DSCF5678.webp ccw,
/images/italy/DSCF0778.webp => 180
```

The workflow opens a PR (`auto/rotate-images-<run>`) with the rotated files, a
table of before/after dimensions, and a test plan. Rotations are a judgement
call, so nothing merges automatically — open the deploy preview and check the
photos are the right way up before merging.

Two entries pointing at the same photo with *different* rotations abort the run
before anything is written; fix the list and re-run. Entries that don't resolve
are reported in the PR body while the rest of the batch proceeds.

### Running it locally

```bash
# One image
node scripts/rotate-gallery-images.mjs --rotation cw /images/japan/DSCF1234.webp

# A batch, mixed rotations, from a file (one per line, `#` starts a comment)
node scripts/rotate-gallery-images.mjs --images-file rotations.txt

# Preview without writing
node scripts/rotate-gallery-images.mjs --rotation ccw --dry-run japan/DSCF1234.webp

# Piped in
echo "/images/japan/DSCF1234.webp ccw" | node scripts/rotate-gallery-images.mjs
```

Options:

| Option | Meaning |
| --- | --- |
| `--rotation <cw\|ccw\|180>` | Rotation for entries that don't carry their own |
| `--images-file <path>` | Read entries from a file |
| `--images <text>` | Read entries from a string |
| `--quality <n>` | Re-encode quality, 1-100 (default: 100) |
| `--lossless` | Encode WebP losslessly — exact, but much larger files |
| `--report <path>` | Write a JSON summary of the run |
| `--summary <path>` | Write a Markdown summary of the run |
| `--dry-run` | Report what would change without writing |
| `--strict` | Exit non-zero if any entry fails |

## What the rotation actually does

For each image, and for every sibling variant of it (the `.webp` and any `.jpg`
fallback, so the two can never disagree):

1. **Bakes any surviving EXIF orientation** into the pixels (`autoOrient()`),
   so the requested rotation is applied to the photo as it is *displayed*, not
   as it happens to be stored.
2. **Rotates the pixels** by 90°, 180° or 270°.
3. **Writes `Orientation = 1`** into the output metadata. The pixels are already
   upright and the file now says so explicitly, so no browser, OS image viewer,
   or photo app can second-guess it. This is what makes the fix hold for a
   downloaded copy, not just on the site.
4. **Re-reads the dimensions from the encoder** and updates `width`/`height` in
   the gallery JSON, so the grid reserves the right space and the layout doesn't
   shift.

The write goes to a temporary file that is renamed into place, so an encode that
fails partway leaves the original untouched.

### A note on quality

WebP has no lossless rotation: the file must be decoded and re-encoded, which
costs one generation of lossy compression. The default quality of `100` matches
what the gallery images were encoded at, and in practice the re-encoded file
comes out about the same size. Avoid rotating the same image repeatedly — each
pass costs another generation.

`--lossless` exists, but it is almost never the right call here. The gallery
files are already lossy WebP: encoding losslessly preserves the compression
artefacts exactly, it does not recover detail the original encode threw away.
What it does do is roughly double the file — a 24MP photo went 8.8 MB lossy to
12.3 MB lossless, and an iPhone frame 3.2 MB to 8.1 MB — for images served to
browsers. Reach for it only when rotating a source that is genuinely lossless
to begin with.

## Verifying a fix

1. Open the deploy preview and check the photo in the gallery grid.
2. Open it in the lightbox; the surrounding layout should not jump.
3. Download it and open it in Preview/Photos — it should be upright there too.
