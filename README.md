# Multi-Site Boat Information Extractor

A Playwright-based tool to extract boat information and images from listing pages on multiple websites with automatic site detection.

## Supported Sites

- 🚤 **botentekoop.nl** - Dutch boat marketplace
- ⛵ **boat24.com** - International boat marketplace

The script automatically detects which site you're using and applies the appropriate extraction technique.

## Features

- 🌐 **Multi-site support** with automatic detection
- 🔍 Extracts images from multiple sources:
  - `<img>` tags (src and srcset attributes)
  - Background images (CSS)
  - Data attributes (data-src, data-image)
  - Gallery/lightbox overlays
- 🖼️ Automatically navigates through image galleries
- 📂 Organizes outputs by site name (filenames and folders)
- 📅 Fetches Last-Modified dates for each image
- 📄 Generates PDF and full-page screenshot of the listing
- 🧹 Removes duplicate URLs and query parameters for clean image links
- 💾 Saves all URLs to text files for easy downloading

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

1. Navigate to the project directory:

```bash
cd ~/Documents/code/capture-page
```

2. Install dependencies:

```bash
npm install
```

3. Install Playwright browser (Chromium):

```bash
npm run install-browser
```

## Usage

### Basic Usage

Run the script with a boat listing URL from any supported site:

```bash
node extract-boat-info.js "<URL>"
```

**Examples:**

```bash
# Extract from botentekoop.nl
node extract-boat-info.js "https://www.botentekoop.nl/boot/1997-van-de-stadt-56-10016503/"

# Extract from boat24.com
node extract-boat-info.js "https://www.boat24.com/nl/zeilboten/hanse/hanse-508/detail/695618/"

# Skip image extraction (only capture page)
node extract-boat-info.js "<URL>" --skip-images
```

### What the Script Does

1. **Detects the site** automatically from the URL
2. Opens a browser window (visible by default)
3. Navigates to the boat listing page
4. Accepts cookies automatically
5. Expands all collapsible sections (botentekoop.nl)
6. Clicks "Verder lezen" or "Meer weergeven" buttons to show full content
7. Extracts all image URLs using site-specific techniques
8. Navigates through image galleries and closes them properly
9. Fetches Last-Modified dates for each image
10. Captures the page as PDF and screenshot
11. **Downloads original PDF if available (boat24.com)**
12. Saves everything with site-specific naming

### Output Files

The script creates several files with site-specific naming:

#### For botentekoop.nl:

- `image-urls-botentekoop.txt` - Image filenames with Last-Modified dates
- `image-urls-only-botentekoop.txt` - Full URLs for wget
- `{boat-id}_{date}_botentekoop.pdf` - PDF capture of the page
- `{boat-id}_{date}_botentekoop.png` - Full-page screenshot

#### For boat24.com:

- `image-urls-boat24.txt` - Image filenames with Last-Modified dates
- `image-urls-only-boat24.txt` - Full URLs for wget
- `boat24-{id}_{date}_boat24.pdf` - PDF capture of the page
- `boat24-{id}_{date}_boat24.png` - Full-page screenshot

**Example `image-urls-botentekoop.txt`:**

```
2005-bavaria-37-cruiser-sail-10066579-20260127032033355-1.jpg | 2024-01-27 03:20:33
2005-bavaria-37-cruiser-sail-10066579-20260127032033355-2.jpg | 2024-01-27 03:20:33
...
```

### Downloading Images

Once you have the URLs file, download all images using wget:

#### For botentekoop.nl:

```bash
wget -i image-urls-only-botentekoop.txt -P ./images-botentekoop/
```

#### For boat24.com:

```bash
wget -i image-urls-only-boat24.txt -P ./images-boat24/
```

#### Alternative: Using curl (Mac/Linux)

```bash
# For botentekoop.nl
mkdir -p images-botentekoop
while read url; do
  filename=$(basename "$url")
  curl -o "images-botentekoop/$filename" "$url"
done < image-urls-only-botentekoop.txt

# For boat24.com
mkdir -p images-boat24
while read url; do
  filename=$(basename "$url")
  curl -o "images-boat24/$filename" "$url"
done < image-urls-only-boat24.txt
```

#### Alternative: Using PowerShell (Windows)

```powershell
# For botentekoop.nl
New-Item -ItemType Directory -Force -Path images-botentekoop
Get-Content image-urls-only-botentekoop.txt | ForEach-Object {
  $filename = Split-Path $_ -Leaf
  Invoke-WebRequest -Uri $_ -OutFile "images-botentekoop\$filename"
}

# For boat24.com
New-Item -ItemType Directory -Force -Path images-boat24
Get-Content image-urls-only-boat24.txt | ForEach-Object {
  $filename = Split-Path $_ -Leaf
  Invoke-WebRequest -Uri $_ -OutFile "images-boat24\$filename"
}
```

## Configuration

### Headless Mode

To run the browser in headless mode (no visible window):

1. Open `extract-boat-info.js`
2. Find this line:

```javascript
const browser = await chromium.launch({
  headless: false,
});
```

3. Change to:

```javascript
const browser = await chromium.launch({
  headless: true,
});
```

### Skip Image Extraction

Use the `--skip-images` flag to only capture the page (faster for testing):

```bash
node extract-boat-info.js "<URL>" --skip-images
```

## Site-Specific Features

### botentekoop.nl

- Automatically expands all collapsible sections (Beschrijving, Contactinformatie, etc.)
- Clicks "Meer weergeven" buttons to show full content
- Navigates through image gallery overlay
- Extracts images from boatsgroup.com CDN

### boat24.com

- Handles boat24.com and boat24.ch image domains
- Clicks "Verder lezen" buttons to show full content
- Extracts images from page and gallery
- **Automatically downloads original PDF if available on the page**
- Supports boat24-specific cookie banners
- Uses boat ID from URL for naming
- Original PDF saved as `{boat-id}_{date}_boat24_original.pdf`

## Troubleshooting

### "Cannot find module 'playwright'"

Run `npm install` to install dependencies.

### "Executable doesn't exist"

Run `npm run install-browser` to install the Chromium browser.

### "Unsupported site" error

Make sure your URL is from one of the supported sites:

- botentekoop.nl
- boat24.com

### No images found

- Check if the URL is correct
- The website structure might have changed
- Try running with `headless: false` to see what's happening
- Check the console output for specific errors

### Script hangs or takes too long

- The script has a safety limit of 50 gallery navigations
- You can adjust the `maxAttempts` variable in the script
- Some pages might have slow-loading images
- Use `--skip-images` flag to test page capture only

## How It Works

The script uses a modular architecture with site-specific extractors:

1. **Site Detection**: Automatically identifies the site from the URL
2. **Configuration Loading**: Loads site-specific selectors and settings
3. **Cookie Handling**: Accepts cookies using site-specific selectors
4. **Section Expansion**: Expands collapsible content (site-specific)
5. **Image Extraction**: Uses multiple strategies per site:
   - Initial page scan for all `<img>` tags
   - Gallery navigation for lazy-loaded images
   - Background image extraction from CSS
   - Data attribute checking
6. **Metadata Fetching**: Gets Last-Modified dates via HTTP HEAD requests
7. **Page Capture**: Generates PDF and full-page screenshot
8. **Deduplication**: Removes duplicate URLs and cleans query parameters

## Adding New Sites

To add support for a new site:

1. Add site detection in `detectSite()` function
2. Add configuration in `SITE_CONFIG` object
3. Create site-specific extraction function (e.g., `extractImagesNewSite()`)
4. Update the main extraction logic to call your function

## License

MIT

## Author

Created with Playwright for extracting boat listing images from multiple marketplaces.

---

**Made with Bob** 🤖
