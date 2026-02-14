const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Get URL from command line argument
const URL = process.argv[2];
const OUTPUT_FILE = "image-urls.txt";

// Show usage if no URL provided
if (!URL) {
  console.log("🖼️  Botentekoop.nl Image Extractor");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n📝 Usage:");
  console.log("  node extract-images-botentekoop.js <URL>");
  console.log("\n📌 Example:");
  console.log("  node extract-images-botentekoop.js https://www.botentekoop.nl/boot/2005-bavaria-37-cruiser-10066579/");
  console.log("\n📄 Output:");
  console.log("  This script will extract all boat images from the provided URL");
  console.log("  and save them to a text file called 'image-urls.txt' in the");
  console.log("  current directory. The file will contain one image URL per line.");
  console.log("\n💡 The script will show you how many images were found.");
  console.log("═══════════════════════════════════════════════════════════════\n");
  process.exit(0);
}

// Validate URL
if (!URL.includes("botentekoop.nl")) {
  console.error("❌ Error: Please provide a valid botentekoop.nl URL");
  console.log("\nUsage: node extract-images-botentekoop.js <URL>");
  console.log("Example: node extract-images-botentekoop.js https://www.botentekoop.nl/boot/2005-bavaria-37-cruiser-10066579/");
  process.exit(1);
}

// Function to get Last-Modified date from URL
function getLastModified(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const options = {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    protocol
      .get(url, options, (res) => {
        const lastModified = res.headers["last-modified"];
        if (lastModified) {
          const date = new Date(lastModified);
          resolve(date.toISOString().split("T")[0] + " " + date.toTimeString().split(" ")[0]);
        } else {
          resolve("No date available");
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

// Function to get Last-Modified date from URL
function getLastModified(url) {
  return new Promise((resolve, reject) => {
    const protocol = url.startsWith("https") ? https : http;

    const options = {
      method: "HEAD",
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
      },
    };

    protocol
      .get(url, options, (res) => {
        const lastModified = res.headers["last-modified"];
        if (lastModified) {
          const date = new Date(lastModified);
          resolve(date.toISOString().split("T")[0] + " " + date.toTimeString().split(" ")[0]);
        } else {
          resolve("No date available");
        }
      })
      .on("error", (err) => {
        reject(err);
      });
  });
}

async function extractImageUrls() {
  console.log("🚀 Starting image extraction...");

  // Launch browser
  const browser = await chromium.launch({
    headless: false, // Set to true for production
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log(`📄 Navigating to: ${URL}`);
    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });

    // Wait for images to start loading
    await page.waitForSelector('img[src*="boatsgroup.com"]', { timeout: 10000 });

    // Accept cookies if present
    try {
      const acceptButton = page.locator('button:has-text("Accept")');
      if (await acceptButton.isVisible({ timeout: 3000 })) {
        console.log("🍪 Accepting cookies...");
        await acceptButton.click();
        await page.waitForTimeout(1000);
      }
    } catch (e) {
      console.log("ℹ️  No cookie banner found or already accepted");
    }

    // Wait for images to load
    console.log("⏳ Waiting for page to fully load...");
    await page.waitForTimeout(2000);

    // Collect all image URLs
    const imageUrls = new Set();

    // Method 1: Extract from <img> tags
    console.log("🔍 Extracting images from <img> tags...");
    const imgElements = await page.locator("img").all();
    for (const img of imgElements) {
      try {
        const src = await img.getAttribute("src");
        const srcset = await img.getAttribute("srcset");

        if (src && src.includes("boatsgroup.com")) {
          // Get the highest quality version by removing size parameters
          const cleanUrl = src.split("?")[0];
          imageUrls.add(cleanUrl);
        }

        if (srcset) {
          // Parse srcset for multiple image URLs
          const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
          urls.forEach((url) => {
            if (url.includes("boatsgroup.com")) {
              const cleanUrl = url.split("?")[0];
              imageUrls.add(cleanUrl);
            }
          });
        }
      } catch (e) {
        // Skip if element is no longer in DOM
      }
    }

    console.log(`✅ Found ${imageUrls.size} unique images from <img> tags`);

    // Method 2: Navigate through gallery to load all images
    console.log("🖼️  Navigating through image gallery...");

    // Try to find and click the main image to open gallery
    try {
      const mainImage = page.locator('img[src*="boatsgroup.com"]').first();
      if (await mainImage.isVisible({ timeout: 2000 })) {
        await mainImage.click();
        await page.waitForTimeout(1000);

        // Check if overlay/modal opened
        const modal = page.locator('[role="dialog"], .modal, .overlay, .lightbox').first();
        if (await modal.isVisible({ timeout: 2000 })) {
          console.log("📸 Gallery overlay opened");

          // Navigate through images using arrow keys or buttons
          let clickedNext = true;
          let attempts = 0;
          const maxAttempts = 50; // Safety limit

          while (clickedNext && attempts < maxAttempts) {
            attempts++;

            // Wait for image to load
            await page.waitForTimeout(500);

            // Extract current image
            const currentImages = await page.locator('img[src*="boatsgroup.com"]').all();
            for (const img of currentImages) {
              try {
                const src = await img.getAttribute("src");
                if (src) {
                  const cleanUrl = src.split("?")[0];
                  imageUrls.add(cleanUrl);
                }
              } catch (e) {
                // Skip
              }
            }

            // Try to click next button
            const nextButton = page.locator('button:has-text("›"), button:has-text(">"), [aria-label*="next" i], .next-button, button.slick-next').first();

            try {
              if (await nextButton.isVisible({ timeout: 1000 })) {
                await nextButton.click();
                await page.waitForTimeout(500);
              } else {
                clickedNext = false;
              }
            } catch (e) {
              clickedNext = false;
            }
          }

          console.log(`✅ Navigated through ${attempts} images in gallery`);
        }
      }
    } catch (e) {
      console.log("ℹ️  Could not open gallery overlay, continuing with page images");
    }

    // Method 3: Extract from background images
    console.log("🎨 Checking for background images...");
    const elementsWithBg = await page.locator('[style*="background-image"]').all();
    for (const el of elementsWithBg) {
      try {
        const style = await el.getAttribute("style");
        if (style) {
          const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
          if (urlMatch && urlMatch[1].includes("boatsgroup.com")) {
            const cleanUrl = urlMatch[1].split("?")[0];
            imageUrls.add(cleanUrl);
          }
        }
      } catch (e) {
        // Skip
      }
    }

    // Method 4: Check for data attributes
    console.log("🔎 Checking data attributes...");
    const dataImages = await page.locator('[data-src*="boatsgroup.com"], [data-image*="boatsgroup.com"]').all();
    for (const el of dataImages) {
      try {
        const dataSrc = (await el.getAttribute("data-src")) || (await el.getAttribute("data-image"));
        if (dataSrc) {
          const cleanUrl = dataSrc.split("?")[0];
          imageUrls.add(cleanUrl);
        }
      } catch (e) {
        // Skip
      }
    }

    // Convert Set to Array and sort
    const sortedUrls = Array.from(imageUrls).sort();

    console.log(`\n✨ Total unique images found: ${sortedUrls.length}`);

    // Fetch Last-Modified dates for images
    console.log("\n📅 Fetching image metadata...");
    const imageData = [];

    for (let i = 0; i < sortedUrls.length; i++) {
      const url = sortedUrls[i];
      try {
        const lastModified = await getLastModified(url);
        imageData.push({ url, lastModified });
        process.stdout.write(`\r   Progress: ${i + 1}/${sortedUrls.length}`);
      } catch (e) {
        imageData.push({ url, lastModified: "Unknown" });
      }
    }
    console.log("\n");

    // Save to file with dates
    const outputPath = path.join(process.cwd(), OUTPUT_FILE);
    const fileContent = imageData
      .map((item) => {
        const filename = item.url.split("/").pop();
        return `${filename} | ${item.lastModified}`;
      })
      .join("\n");
    fs.writeFileSync(outputPath, fileContent, "utf-8");

    // Also save a separate file with just URLs for wget
    const urlsOnlyFile = "image-urls-only.txt";
    const urlsOnlyPath = path.join(process.cwd(), urlsOnlyFile);
    fs.writeFileSync(urlsOnlyPath, sortedUrls.join("\n"), "utf-8");

    console.log(`\n💾 Image URLs with dates saved to: ${outputPath}`);
    console.log(`💾 URLs only file saved to: ${urlsOnlyPath}`);
    console.log("\n📋 Images with Last-Modified dates:");
    imageData.forEach((item, index) => {
      const filename = item.url.split("/").pop();
      console.log(`${index + 1}. ${filename} | ${item.lastModified}`);
    });

    console.log("\n📥 To download all images, run:");
    console.log(`   wget -i ${urlsOnlyFile} -P ./images/`);
    console.log("\n💡 Two files created:");
    console.log(`   - ${OUTPUT_FILE}: filenames with dates`);
    console.log(`   - ${urlsOnlyFile}: full URLs for wget`);
  } catch (error) {
    console.error("❌ Error:", error.message);
    throw error;
  } finally {
    await browser.close();
    console.log("\n✅ Browser closed");
  }
}

// Run the script
extractImageUrls()
  .then(() => {
    console.log("\n🎉 Image extraction completed successfully!");
    process.exit(0);
  })
  .catch((error) => {
    console.error("\n💥 Script failed:", error);
    process.exit(1);
  });

// Made with Bob
