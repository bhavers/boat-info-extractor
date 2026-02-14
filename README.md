# Boat Image Extractor

A Playwright-based tool to extract all image URLs from boat listing pages on botentekoop.nl.

## Features

- 🔍 Extracts images from multiple sources:
  - `<img>` tags (src and srcset attributes)
  - Background images (CSS)
  - Data attributes (data-src, data-image)
  - Gallery/lightbox overlays
- 🖼️ Automatically navigates through image galleries
- 🧹 Removes duplicate URLs and query parameters for clean image links
- 💾 Saves all URLs to a text file for easy downloading

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

Run the script with a boat listing URL:

```bash
node extract-images.js "https://www.botentekoop.nl/boot/YOUR-BOAT-LISTING-URL/"
```

Or use the default URL (Bavaria 37 Cruiser):

```bash
npm start
```

**Examples:**

```bash
# Extract images from a specific boat listing
node extract-images.js "https://www.botentekoop.nl/boot/2005-bavaria-37-cruiser-10066579/"

# Use npm start for the default URL
npm start
```

The script will:

1. Open a browser window (visible by default)
2. Navigate to the boat listing page
3. Accept cookies automatically
4. Extract all image URLs
5. Navigate through the image gallery
6. Save all URLs to `image-urls.txt`

### Output

The script creates a file called `image-urls.txt` containing all unique image URLs, one per line:

```
https://images.boatsgroup.com/resize/1/65/79/2005-bavaria-37-cruiser-sail-10066579-20260127032033355-1.jpg
https://images.boatsgroup.com/resize/1/65/79/2005-bavaria-37-cruiser-sail-10066579-20260127032033355-2.jpg
...
```

### Downloading Images

Once you have the `image-urls.txt` file, you can download all images using various methods:

#### Method 1: Using wget (Mac/Linux)

```bash
wget -i image-urls.txt -P ./images/
```

#### Method 2: Using curl (Mac/Linux)

```bash
mkdir -p images
while read url; do
  filename=$(basename "$url")
  curl -o "images/$filename" "$url"
done < image-urls.txt
```

#### Method 3: Using PowerShell (Windows)

```powershell
New-Item -ItemType Directory -Force -Path images
Get-Content image-urls.txt | ForEach-Object {
  $filename = Split-Path $_ -Leaf
  Invoke-WebRequest -Uri $_ -OutFile "images\$filename"
}
```

#### Method 4: Browser Extension

Use a browser extension like "Download All Images" or "Image Downloader" and paste the URLs.

## Configuration

You can modify the script to extract images from different URLs:

1. Open `extract-images.js`
2. Change the `URL` constant at the top:

```javascript
const URL = "https://www.botentekoop.nl/boot/YOUR-BOAT-LISTING-URL/";
```

### Headless Mode

To run the browser in headless mode (no visible window):

1. Open `extract-images.js`
2. Find this line:

```javascript
const browser = await chromium.launch({
  headless: false, // Set to true for production
});
```

3. Change to:

```javascript
const browser = await chromium.launch({
  headless: true,
});
```

## Troubleshooting

### "Cannot find module 'playwright'"

Run `npm install` to install dependencies.

### "Executable doesn't exist"

Run `npm run install-browser` to install the Chromium browser.

### No images found

- Check if the URL is correct
- The website structure might have changed
- Try running with `headless: false` to see what's happening

### Script hangs or takes too long

- The script has a safety limit of 50 gallery navigations
- You can adjust the `maxAttempts` variable in the script
- Some pages might have slow-loading images

## How It Works

The script uses multiple strategies to ensure all images are captured:

1. **Initial Page Scan**: Extracts all visible images from the page
2. **Gallery Navigation**: Clicks through the image gallery/carousel to load lazy-loaded images
3. **Background Images**: Checks CSS background-image properties
4. **Data Attributes**: Looks for images stored in data attributes
5. **Deduplication**: Removes duplicate URLs and cleans query parameters

## License

MIT

## Author

Created with Playwright for extracting boat listing images.
