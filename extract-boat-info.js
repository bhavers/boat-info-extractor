const { chromium } = require("playwright");
const fs = require("fs");
const path = require("path");
const https = require("https");
const http = require("http");

// Get URL and flags from command line arguments
const URL = process.argv[2];
const SKIP_IMAGES = process.argv.includes("--skip-images");
const OUTPUT_FILE = "image-urls.txt";

// Show usage if no URL provided
if (!URL) {
  console.log("🖼️  Multi-Site Boat Image Extractor");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n📝 Usage:");
  console.log("  node extract-images.js <URL> [--skip-images]");
  console.log("\n📌 Supported Sites:");
  console.log("  - botentekoop.nl");
  console.log("  - boat24.com");
  console.log("\n📌 Examples:");
  console.log("  node extract-images.js https://www.botentekoop.nl/boot/2005-bavaria-37-cruiser-10066579/");
  console.log("  node extract-images.js https://www.boat24.com/nl/zeilboten/bavaria/bavaria-37-cruiser-cruiser-37/detail/662000/");
  console.log("  node extract-images.js <URL> --skip-images  (skip image extraction for testing)");
  console.log("\n📄 Output:");
  console.log("  This script will:");
  console.log("  - Detect the site automatically");
  console.log("  - Extract all boat images and save URLs with dates");
  console.log("  - Capture the page as PDF and screenshot");
  console.log("  - Expand all sections before capturing");
  console.log("  - Append site name to filenames and folders");
  console.log("\n💡 Use --skip-images flag to only capture page (faster for testing)");
  console.log("═══════════════════════════════════════════════════════════════\n");
  process.exit(0);
}

// Detect site from URL
function detectSite(url) {
  if (url.includes("botentekoop.nl")) {
    return "botentekoop";
  } else if (url.includes("boat24.com")) {
    return "boat24";
  } else {
    return null;
  }
}

const SITE = detectSite(URL);

// Validate URL
if (!SITE) {
  console.error("❌ Error: Unsupported site. Please provide a valid botentekoop.nl or boat24.com URL");
  console.log("\nSupported sites:");
  console.log("  - botentekoop.nl");
  console.log("  - boat24.com");
  console.log("\nUsage: node extract-images.js <URL>");
  process.exit(1);
}

console.log(`🌐 Detected site: ${SITE}`);

// Site-specific configurations
const SITE_CONFIG = {
  botentekoop: {
    name: "botentekoop",
    imageSelector: 'img[src*="boatsgroup.com"]',
    imageDomain: "boatsgroup.com",
    cookieSelectors: [
      'button:has-text("Accept")',
      'button:has-text("Accepteren")',
      'button:has-text("Akkoord")',
      'button[id*="accept"]',
      'button[class*="accept"]',
      'a:has-text("Accept")',
      ".cookie-accept",
      "#cookie-accept",
    ],
    expandSections: ["Beschrijving", "Contactinformatie", "Meer informatie", "Kenmerken", "Voortstuwing", "Afmetingen"],
    meerWeergevenSelectors: [
      ".show-more-less-interaction button",
      "div.show-more-less-interaction button",
      'button:has-text("Meer weergeven")',
      'button:has-text("Meer")',
    ],
    extractBoatId: (url) => {
      const match = url.match(/\/boot\/([^\/]+)\/?/);
      return match ? match[1] : "boat-listing";
    },
  },
  boat24: {
    name: "boat24",
    imageSelector: 'img[src*="boat24.com"], img[src*="boat24.ch"]',
    imageDomain: "boat24",
    cookieSelectors: [
      'button:has-text("Alles toestaan")',
      'button:has-text("Aanpassen")',
      'button:has-text("Accept")',
      'button:has-text("Accepteren")',
      'button[id*="accept"]',
      'button[class*="accept"]',
    ],
    expandSections: [],
    meerWeergevenSelectors: ['button:has-text("Verder lezen")', 'button.link:has-text("Verder lezen")'],
    extractBoatId: (url) => {
      const match = url.match(/\/detail\/(\d+)\/?/);
      return match ? `boat24-${match[1]}` : "boat24-listing";
    },
  },
};

const config = SITE_CONFIG[SITE];

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

// Site-specific image extraction functions
async function extractImagesBotentekoop(page) {
  console.log("\n🔍 Extracting images using botentekoop.nl technique...");
  await page.waitForSelector(config.imageSelector, { timeout: 10000 });

  const imageUrls = new Set();

  // Method 1: Extract from <img> tags
  console.log("🔍 Extracting images from <img> tags...");
  const imgElements = await page.locator("img").all();
  for (const img of imgElements) {
    try {
      const src = await img.getAttribute("src");
      const srcset = await img.getAttribute("srcset");

      if (src && src.includes(config.imageDomain)) {
        const cleanUrl = src.split("?")[0];
        imageUrls.add(cleanUrl);
      }

      if (srcset) {
        const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        urls.forEach((url) => {
          if (url.includes(config.imageDomain)) {
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

  // Method 2: Navigate through gallery
  console.log("🖼️  Navigating through image gallery...");
  try {
    const mainImage = page.locator(`img[src*="${config.imageDomain}"]`).first();
    if (await mainImage.isVisible({ timeout: 2000 })) {
      await mainImage.click();
      await page.waitForTimeout(1000);

      const modal = page.locator('[role="dialog"], .modal, .overlay, .lightbox').first();
      if (await modal.isVisible({ timeout: 2000 })) {
        console.log("📸 Gallery overlay opened");

        let clickedNext = true;
        let attempts = 0;
        const maxAttempts = 50;

        while (clickedNext && attempts < maxAttempts) {
          attempts++;
          await page.waitForTimeout(500);

          const currentImages = await page.locator(`img[src*="${config.imageDomain}"]`).all();
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

        // Close the gallery overlay before continuing
        console.log("🔒 Closing gallery overlay...");
        try {
          // Try to find and click close button
          const closeButton = page
            .locator('button[aria-label*="close" i], button[aria-label*="sluiten" i], button.close, [data-dismiss="modal"], .modal-close')
            .first();
          if (await closeButton.isVisible({ timeout: 1000 })) {
            await closeButton.click();
            await page.waitForTimeout(500);
            console.log("✅ Gallery overlay closed");
          } else {
            // Try pressing Escape key
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            console.log("✅ Gallery overlay closed with Escape key");
          }
        } catch (e) {
          // Try Escape as fallback
          try {
            await page.keyboard.press("Escape");
            await page.waitForTimeout(500);
            console.log("✅ Gallery overlay closed with Escape key");
          } catch (e2) {
            console.log("⚠️  Could not close gallery overlay");
          }
        }
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
        if (urlMatch && urlMatch[1].includes(config.imageDomain)) {
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
  const dataImages = await page.locator(`[data-src*="${config.imageDomain}"], [data-image*="${config.imageDomain}"]`).all();
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

  return Array.from(imageUrls).sort();
}

async function extractImagesBoat24(page) {
  console.log("\n🔍 Extracting images using boat24.com technique...");

  const imageUrls = new Set();

  // Method 1: Extract from <img> tags
  console.log("🔍 Extracting images from <img> tags...");
  const imgElements = await page.locator("img").all();
  for (const img of imgElements) {
    try {
      const src = await img.getAttribute("src");
      const srcset = await img.getAttribute("srcset");

      if (src && (src.includes("boat24.com") || src.includes("boat24.ch"))) {
        // Get the highest quality version
        const cleanUrl = src.split("?")[0];
        imageUrls.add(cleanUrl);
      }

      if (srcset) {
        const urls = srcset.split(",").map((s) => s.trim().split(" ")[0]);
        urls.forEach((url) => {
          if (url.includes("boat24.com") || url.includes("boat24.ch")) {
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

  // Method 2: Navigate through gallery if it exists
  console.log("🖼️  Checking for image gallery...");
  try {
    // Look for gallery images in the page
    const galleryImages = await page.locator('img[src*="boat24"]').all();

    for (const img of galleryImages) {
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
  } catch (e) {
    console.log("ℹ️  Gallery navigation not available");
  }

  // Method 3: Extract from background images
  console.log("🎨 Checking for background images...");
  const elementsWithBg = await page.locator('[style*="background-image"]').all();
  for (const el of elementsWithBg) {
    try {
      const style = await el.getAttribute("style");
      if (style) {
        const urlMatch = style.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (urlMatch && (urlMatch[1].includes("boat24.com") || urlMatch[1].includes("boat24.ch"))) {
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
  const dataImages = await page.locator('[data-src*="boat24"], [data-image*="boat24"]').all();
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

  return Array.from(imageUrls).sort();
}

async function extractImageUrls() {
  console.log("🚀 Starting page capture...");
  if (SKIP_IMAGES) {
    console.log("⚠️  Skipping image extraction (--skip-images flag set)");
  }

  // Launch browser
  const browser = await chromium.launch({
    headless: false,
  });

  const context = await browser.newContext({
    viewport: { width: 1920, height: 1080 },
  });

  const page = await context.newPage();

  try {
    console.log(`📄 Navigating to: ${URL}`);
    await page.goto(URL, {
      waitUntil: "domcontentloaded",
      timeout: 10000,
    });

    // Wait for page to load and render completely
    console.log("⏳ Waiting for page to fully load and render...");
    await page.waitForTimeout(2000);

    // Accept cookies if present
    console.log("🍪 Checking for cookie banner...");
    try {
      let cookieClicked = false;
      for (const selector of config.cookieSelectors) {
        try {
          const button = page.locator(selector).first();
          if (await button.isVisible({ timeout: 1000 })) {
            await button.click();
            console.log(`✅ Cookie banner dismissed using: ${selector}`);
            await page.waitForTimeout(1000);
            cookieClicked = true;
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (!cookieClicked) {
        console.log("ℹ️  No cookie banner found or already accepted");
      }
    } catch (e) {
      console.log("ℹ️  Cookie handling skipped");
    }

    // Wait additional time before starting to interact with sections
    console.log("\n⏳ Waiting for dynamic content to stabilize...");
    await page.waitForTimeout(2000);

    // Expand all sections before capturing (botentekoop.nl specific)
    if (config.expandSections.length > 0) {
      console.log("\n📂 Expanding all sections...");

      for (const section of config.expandSections) {
        try {
          const detailsElement = page.locator(`details:has-text("${section}")`).first();
          let alreadyOpen = false;

          try {
            if (await detailsElement.isVisible({ timeout: 300 })) {
              const hasOpen = await detailsElement.getAttribute("open");
              if (hasOpen !== null) {
                console.log(`   ✓ ${section}: already open`);
                alreadyOpen = true;
              }
            }
          } catch (e) {
            // Not a details element or not found
          }

          if (alreadyOpen) {
            continue;
          }

          const selectors = [
            `summary:has-text("${section}")`,
            `button:has-text("${section}")`,
            `h2:has-text("${section}")`,
            `h3:has-text("${section}")`,
            `h4:has-text("${section}")`,
            `div:has-text("${section}") button`,
            `div:has-text("${section}") h2`,
            `div:has-text("${section}") h3`,
            `span:has-text("${section}")`,
          ];

          let expanded = false;
          for (const selector of selectors) {
            try {
              const elements = page.locator(selector);
              const count = await elements.count();

              for (let i = 0; i < count; i++) {
                try {
                  const element = elements.nth(i);
                  if (await element.isVisible({ timeout: 300 })) {
                    await element.click();
                    console.log(`   ✓ Expanded: ${section}`);
                    await page.waitForTimeout(1000);
                    expanded = true;
                    break;
                  }
                } catch (e) {
                  // Try next element
                }
              }

              if (expanded) break;
            } catch (e) {
              // Try next selector
            }
          }

          if (!expanded) {
            console.log(`   - ${section}: not found`);
          }
        } catch (e) {
          console.log(`   - ${section}: error expanding`);
        }
      }

      console.log("✅ Section expansion complete");
    }

    // Handle "Meer weergeven" buttons (botentekoop.nl specific)
    if (config.meerWeergevenSelectors.length > 0) {
      console.log("\n🔍 Looking for 'Meer weergeven' buttons...");
      await page.waitForTimeout(3000);

      let totalClicked = 0;

      for (const selector of config.meerWeergevenSelectors) {
        try {
          const buttons = page.locator(selector);
          const count = await buttons.count();

          if (count > 0) {
            console.log(`   Found ${count} button(s) with selector: ${selector}`);
          }

          for (let i = 0; i < count; i++) {
            try {
              const button = buttons.nth(i);
              const buttonText = await button.textContent().catch(() => "");
              const trimmedText = buttonText.trim();

              // Check for site-specific button text
              let shouldClick = false;
              if (SITE === "botentekoop") {
                shouldClick = trimmedText.toLowerCase().includes("meer") || trimmedText.toLowerCase().includes("weergeven");
              } else if (SITE === "boat24") {
                shouldClick = trimmedText.toLowerCase().includes("verder") || trimmedText.toLowerCase().includes("lezen");
              }

              if (!shouldClick) {
                continue;
              }

              const isVisible = await button.isVisible({ timeout: 500 }).catch(() => false);

              if (isVisible) {
                console.log(`   Clicking button: "${trimmedText}"`);
                await button.click();
                totalClicked++;
                console.log(`   ✓ Clicked button ${totalClicked}`);
                await page.waitForTimeout(1500);
              }
            } catch (e) {
              // Skip this button
            }
          }

          if (totalClicked > 0) {
            break;
          }
        } catch (e) {
          // Try next selector
        }
      }

      if (totalClicked === 0) {
        console.log("   ⚠️  No 'Meer weergeven' buttons found or clicked");
      } else {
        console.log(`   ✅ Successfully clicked ${totalClicked} 'Meer weergeven' button(s)`);
      }
    }

    // Collect all image URLs (skip if flag is set)
    let sortedUrls = [];
    let imageData = [];

    if (!SKIP_IMAGES) {
      // Use site-specific extraction method
      if (SITE === "botentekoop") {
        sortedUrls = await extractImagesBotentekoop(page);
      } else if (SITE === "boat24") {
        sortedUrls = await extractImagesBoat24(page);
      }

      console.log(`\n✨ Total unique images found: ${sortedUrls.length}`);

      // Fetch Last-Modified dates for images
      console.log("\n📅 Fetching image metadata...");

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

      // Extract boat ID for filename
      const boatId = config.extractBoatId(URL);
      const timestamp = new Date().toISOString().split("T")[0];

      // Create site-specific folder name
      const folderName = `images-${config.name}`;

      // Save to file with dates
      const outputPath = path.join(process.cwd(), `${OUTPUT_FILE.replace(".txt", `-${config.name}.txt`)}`);
      const fileContent = imageData
        .map((item) => {
          const filename = item.url.split("/").pop();
          return `${filename} | ${item.lastModified}`;
        })
        .join("\n");
      fs.writeFileSync(outputPath, fileContent, "utf-8");

      // Also save a separate file with just URLs for wget
      const urlsOnlyFile = `image-urls-only-${config.name}.txt`;
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
      console.log(`   wget -i ${urlsOnlyFile} -P ./${folderName}/`);
      console.log("\n💡 Two files created:");
      console.log(`   - ${outputPath.split("/").pop()}: filenames with dates`);
      console.log(`   - ${urlsOnlyFile}: full URLs for wget`);
    } else {
      console.log("\n⏭️  Skipped image extraction");
    }

    // Capture page as PDF and screenshot
    console.log("\n📸 Capturing page...");

    // Extract boat ID from URL for filename
    const boatId = config.extractBoatId(URL);
    const timestamp = new Date().toISOString().split("T")[0];
    const baseFilename = `${boatId}_${timestamp}_${config.name}`;

    // Emulate screen media for PDF to avoid print stylesheets hiding content
    console.log("📄 Preparing page for PDF capture...");
    await page.emulateMedia({ media: "screen" });

    // Capture PDF
    const pdfPath = path.join(process.cwd(), `${baseFilename}.pdf`);
    console.log("📄 Generating PDF...");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
      preferCSSPageSize: false,
      margin: {
        top: "20px",
        right: "20px",
        bottom: "20px",
        left: "20px",
      },
    });
    console.log(`✅ PDF saved to: ${pdfPath}`);

    // Capture full page screenshot
    const screenshotPath = path.join(process.cwd(), `${baseFilename}.png`);
    console.log("📸 Taking screenshot...");
    await page.screenshot({
      path: screenshotPath,
      fullPage: true,
    });
    console.log(`✅ Screenshot saved to: ${screenshotPath}`);

    // Check for and download existing PDF on boat24.com
    if (SITE === "boat24") {
      console.log("\n🔍 Checking for downloadable PDF...");
      try {
        // Extract boat ID from URL and construct PDF URL
        const urlMatch = URL.match(/\/detail\/(\d+)\/?/);
        if (urlMatch) {
          const boatIdNumber = urlMatch[1];
          // Extract protocol and host from URL string
          const protocolMatch = URL.match(/^(https?:\/\/[^\/]+)/);
          const baseUrl = protocolMatch ? protocolMatch[1] : "https://www.boat24.com";
          const pdfUrl = `${baseUrl}/pdf/ins/${boatIdNumber}.nl.pdf`;

          console.log(`📥 Attempting to download PDF from: ${pdfUrl}`);

          // Set up download handler before navigating
          const downloadPromise = page.waitForEvent("download", { timeout: 15000 });

          // Navigate to the PDF URL to trigger download (can take up to 8 seconds)
          // Note: page.goto will throw an error when download starts, so we catch it
          console.log("⏳ Waiting for download to start (this may take up to 10 seconds)...");
          
          page.goto(pdfUrl, { waitUntil: "domcontentloaded", timeout: 15000 }).catch(() => {
            // Expected error when download starts
          });

          // Wait for download to start
          const download = await downloadPromise;

          // Save the downloaded PDF with our naming convention
          const downloadedPdfPath = path.join(process.cwd(), `${baseFilename}_original.pdf`);
          await download.saveAs(downloadedPdfPath);

          console.log(`✅ Original PDF downloaded to: ${downloadedPdfPath}`);
        } else {
          console.log("ℹ️  Could not extract boat ID from URL");
        }
      } catch (e) {
        console.log("ℹ️  PDF not available or could not be downloaded:", e.message);
      }
    }

    console.log("\n📁 Page captures:");
    console.log(`   - ${baseFilename}.pdf`);
    console.log(`   - ${baseFilename}.png`);
    if (SITE === "boat24") {
      console.log(`   - ${baseFilename}_original.pdf (if available)`);
    }
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
