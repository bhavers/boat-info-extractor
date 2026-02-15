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
  console.log("🖼️  Botentekoop.nl Image Extractor");
  console.log("═══════════════════════════════════════════════════════════════");
  console.log("\n📝 Usage:");
  console.log("  node extract-images-botentekoop.js <URL> [--skip-images]");
  console.log("\n📌 Example:");
  console.log("  node extract-images-botentekoop.js https://www.botentekoop.nl/boot/2005-bavaria-37-cruiser-10066579/");
  console.log("  node extract-images-botentekoop.js <URL> --skip-images  (skip image extraction for testing)");
  console.log("\n📄 Output:");
  console.log("  This script will:");
  console.log("  - Extract all boat images and save URLs with dates");
  console.log("  - Capture the page as PDF and screenshot");
  console.log("  - Expand all sections before capturing");
  console.log("\n💡 Use --skip-images flag to only capture page (faster for testing)");
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
  console.log("🚀 Starting page capture...");
  if (SKIP_IMAGES) {
    console.log("⚠️  Skipping image extraction (--skip-images flag set)");
  }

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
      timeout: 10000,
    });

    // Wait for page to load and render completely
    console.log("⏳ Waiting for page to fully load and render...");
    await page.waitForTimeout(2000); // Increased to 5 seconds for full rendering

    // Inject CSS to trigger "Meer weergeven" button by removing truncation
    console.log("🎨 Injecting CSS to trigger 'Meer weergeven' button...");
    await page.addStyleTag({
      content: `
        .data-html-inner-wrapper {
          max-height: none !important;
          position: static !important;
        }
      `,
    });
    await page.waitForTimeout(1000); // Wait for CSS to apply

    // Accept cookies if present - try multiple selectors
    console.log("🍪 Checking for cookie banner...");
    try {
      // Try different cookie button selectors
      const cookieSelectors = [
        'button:has-text("Accept")',
        'button:has-text("Accepteren")',
        'button:has-text("Akkoord")',
        'button[id*="accept"]',
        'button[class*="accept"]',
        'a:has-text("Accept")',
        ".cookie-accept",
        "#cookie-accept",
      ];

      let cookieClicked = false;
      for (const selector of cookieSelectors) {
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

    // Expand all sections before capturing
    console.log("\n📂 Expanding all sections...");

    // Try to find and click all expandable sections
    const sections = ["Beschrijving", "Contactinformatie", "Meer informatie", "Kenmerken", "Voortstuwing", "Afmetingen"];

    for (const section of sections) {
      try {
        // First check if section is already open (details element with open attribute)
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
          // Not a details element or not found, continue with normal expansion
        }

        if (alreadyOpen) {
          continue; // Skip to next section
        }

        // Try multiple selectors to find and expand sections
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

            // Try each matching element
            for (let i = 0; i < count; i++) {
              try {
                const element = elements.nth(i);
                if (await element.isVisible({ timeout: 300 })) {
                  await element.click();
                  console.log(`   ✓ Expanded: ${section}`);
                  await page.waitForTimeout(1000); // Wait for content to load
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

    // Wait for dynamic content to load - button appears quickly after page load
    console.log("⏳ Waiting for dynamic content to render...");
    await page.waitForTimeout(3000);

    // Now look for "Meer weergeven" buttons
    console.log("\n🔍 Looking for 'Meer weergeven' buttons...");

    // Wait specifically for the button to appear in the DOM
    try {
      await page.waitForSelector(".show-more-less-interaction button", { timeout: 5000 });
      console.log("   ✓ Found .show-more-less-interaction button in DOM");
    } catch (e) {
      console.log("   ⚠️  .show-more-less-interaction button not found, trying other selectors...");
    }

    const meerWeergevenSelectors = [
      ".show-more-less-interaction button",
      "div.show-more-less-interaction button",
      'button:has-text("Meer weergeven")',
      'button:has-text("Meer")',
    ];

    let totalClicked = 0;

    for (const selector of meerWeergevenSelectors) {
      try {
        const buttons = page.locator(selector);
        const count = await buttons.count();

        if (count > 0) {
          console.log(`   Found ${count} button(s) with selector: ${selector}`);
        }

        for (let i = 0; i < count; i++) {
          try {
            const button = buttons.nth(i);

            // Get button text
            const buttonText = await button.textContent().catch(() => "");
            const trimmedText = buttonText.trim();

            // Only proceed if button contains "Meer" or "weergeven"
            if (!trimmedText.toLowerCase().includes("meer") && !trimmedText.toLowerCase().includes("weergeven")) {
              continue;
            }

            // Check if visible
            const isVisible = await button.isVisible({ timeout: 500 }).catch(() => false);

            if (isVisible) {
              console.log(`   Clicking button: "${trimmedText}"`);

              await button.click();
              totalClicked++;
              console.log(`   ✓ Clicked button ${totalClicked}`);

              // Wait for content to expand
              await page.waitForTimeout(1500);
            }
          } catch (e) {
            // Skip this button
          }
        }

        // If we found and clicked buttons with this selector, don't try other selectors
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

    console.log("✅ Section expansion complete");

    // Collect all image URLs (skip if flag is set)
    let sortedUrls = [];
    let imageData = [];

    if (!SKIP_IMAGES) {
      console.log("\n🔍 Extracting images...");
      await page.waitForSelector('img[src*="boatsgroup.com"]', { timeout: 10000 });

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
      sortedUrls = Array.from(imageUrls).sort();

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
    } else {
      console.log("\n⏭️  Skipped image extraction");
    }

    // Capture page as PDF and screenshot
    console.log("\n📸 Capturing page...");

    // Extract boat ID from URL for filename
    const urlMatch = URL.match(/\/boot\/([^\/]+)\/?/);
    const boatId = urlMatch ? urlMatch[1] : "boat-listing";
    const timestamp = new Date().toISOString().split("T")[0];
    const baseFilename = `${boatId}_${timestamp}`;

    // Capture PDF
    const pdfPath = path.join(process.cwd(), `${baseFilename}.pdf`);
    console.log("📄 Generating PDF...");
    await page.pdf({
      path: pdfPath,
      format: "A4",
      printBackground: true,
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

    console.log("\n📁 Page captures:");
    console.log(`   - ${baseFilename}.pdf`);
    console.log(`   - ${baseFilename}.png`);
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
