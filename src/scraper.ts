import { chromium } from "playwright";
import { 
  OfferData, 
  RawOfferData, 
  PageOfferData,
  ScrapingConfig, 
  DEFAULT_CONFIG, 
  isValidOffer,
  ChallengeDetectedError,
  parseOffersFromHtml
} from "./utils";
import fs from 'fs';
import path from 'path';

export type { OfferData, ScrapingConfig } from "./utils";

const config: ScrapingConfig = DEFAULT_CONFIG;

async function scrape(scrapingConfig: ScrapingConfig = config): Promise<void> {
  console.log("Launching browser...");
  const browser = await chromium.launch({ headless: scrapingConfig.headless });

  const contextOptions: any = {
    locale: 'de-DE',
    timezoneId: 'Europe/Berlin'
  };
  if (scrapingConfig.userAgent) {
    contextOptions.userAgent = scrapingConfig.userAgent;
  }
  const context = await browser.newContext(contextOptions);

  if (scrapingConfig.cookies?.length) {
    try {
      await context.addCookies(scrapingConfig.cookies);
      console.log(`Injected ${scrapingConfig.cookies.length} cookies into context.`);
    } catch (e) {
      console.warn('Failed to add cookies:', e);
    }
  }

  const page = await context.newPage();


  page.setDefaultNavigationTimeout(scrapingConfig.timeout * 1.5);
  page.setDefaultTimeout(scrapingConfig.timeout);

  
  if (!scrapingConfig.bypassCloudflare) {
    await page.route("**/*", (route) => {
      const type = route.request().resourceType();
      if (["image", "font", "media"].includes(type)) {
        return route.abort();
      }
      return route.continue();
    });
  }

  await page.setExtraHTTPHeaders({
    "Accept-Language": "de-DE,de;q=0.9,en;q=0.8"
  });

  try {
    console.log("Navigating to mydealz URL...");
    await page.goto(scrapingConfig.url, {
      waitUntil: "domcontentloaded",
      timeout: scrapingConfig.timeout * 1.5
    });

    const challengeDetected = await page.evaluate(() => {
      const d = (globalThis as any).document;
      const title: string = d?.title || '';
      const humanText: string = d?.body?.textContent || '';
      const cfIndicators = [
        'Bestätigen Sie, dass Sie ein Mensch sind',
        'Cloudflare',
        'Turnstile',
        'muss die Sicherheit Ihrer Verbindung überprüfen'
      ];
      return title.includes('Nur einen Moment') || cfIndicators.some(t => humanText.includes(t));
    });

    if (challengeDetected) {
      throw new ChallengeDetectedError();
    }

   
    try {
      await page.waitForSelector("[data-t='title']", { timeout: scrapingConfig.timeout });
    } catch (waitErr) {
      console.warn('Primary selector wait failed, will attempt fallback parse after timeout handling.');
      throw waitErr; 
    }

    await page.waitForTimeout(750);

    console.log("Extracting offers...");

    const results: PageOfferData[] = await page.$$eval("[data-t]", (cards): PageOfferData[] =>
      cards.map((card): PageOfferData => {
        const titleElement = card.querySelector("[data-t='title']");
        const linkElement = card.querySelector("a");
        const priceElement = card.querySelector("[data-t='price']");
        const retailerElement = card.querySelector("[data-t='merchant']");

        const title = titleElement?.textContent?.trim();
        const link = (linkElement?.getAttribute('href') || linkElement?.href) || null;
        const rawPrice = priceElement?.textContent?.trim();
        const rawRetailer = retailerElement?.textContent?.trim();

        const price = rawPrice ? rawPrice.replace(/\n/g, " ") : null;
        const retailer = rawRetailer ? rawRetailer.replace(/\n/g, " ") : null;

        return {
          title,
          price,
          retailer,
          link,
          scrapedAt: new Date().toISOString(),
        };
      })
    );

    const validOffers: OfferData[] = results
      .map((rawData): RawOfferData => ({
        title: rawData.title,
        price: rawData.price,
        retailer: rawData.retailer,
        link: rawData.link,
        scrapedAt: rawData.scrapedAt,
      }))
      .filter(isValidOffer);

    const dataDir = path.dirname(scrapingConfig.outputPath);
    if (!fs.existsSync(dataDir)) {
      fs.mkdirSync(dataDir, { recursive: true });
    }

    fs.writeFileSync(scrapingConfig.outputPath, JSON.stringify(validOffers, null, 2));

    console.log(`✅ Saved ${validOffers.length} offers to ${scrapingConfig.outputPath}`);

  } catch (error: any) {
    let attemptedFallback = false;
    if (error?.name === 'TimeoutError') {
      console.error("Navigation or selector wait timed out. Capturing diagnostics...");
      try {
        const html = await page.content();
        const diagPath = path.join(path.dirname(scrapingConfig.outputPath), 'debug.html');
        fs.writeFileSync(diagPath, html);
        console.error(`Saved debug HTML to ${diagPath}`);
        if (scrapingConfig.fallbackParse) {
          const offers = parseOffersFromHtml(html, scrapingConfig);
          if (offers.length) {
            console.log(`⚙️ Fallback extracted ${offers.length} offers after timeout.`);
            const dataDir = path.dirname(scrapingConfig.outputPath);
            if (!fs.existsSync(dataDir)) {
              fs.mkdirSync(dataDir, { recursive: true });
            }
            fs.writeFileSync(scrapingConfig.outputPath, JSON.stringify(offers, null, 2));
            console.log(`✅ Saved ${offers.length} fallback offers to ${scrapingConfig.outputPath}`);
            attemptedFallback = true;
          } else {
            console.warn('Fallback parse found no matching offers in captured HTML.');
          }
        }
      } catch (e) {
        console.error("Failed during fallback handling:", e);
      }
    }
    if (error instanceof ChallengeDetectedError) {
      console.error('Cloudflare challenge detected. Provide cookies from a manual session to bypass.');
      console.error('Steps: 1) Open target URL in normal Chrome. 2) Solve challenge. 3) Export cookies for domain www.mydealz.de. 4) Add them to ScrapingConfig.cookies.');
    }
    if (!attemptedFallback) {
      console.error("Error during scraping (no successful fallback):", error);
      throw error;
    }
  } finally {
    await browser.close();
  }
}


export async function runScraper(customConfig?: Partial<ScrapingConfig>): Promise<OfferData[]> {
  const finalConfig: ScrapingConfig = { ...config, ...customConfig };
  
  try {
    await scrape(finalConfig);

    const data = fs.readFileSync(finalConfig.outputPath, 'utf-8');
    return JSON.parse(data) as OfferData[];
  } catch (error) {
    console.error("Scrape failed:", error);
    throw error;
  }
}


if (require.main === module) {
  runScraper().catch((err) => {
    console.error("Scrape failed:", err);
    process.exit(1);
  });
}