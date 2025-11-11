export interface OfferData {
  title: string;
  price: string | null;
  retailer: string | null;
  link: string | null;
  scrapedAt: string;
}

export interface RawOfferData {
  title: string | undefined;
  price: string | null;
  retailer: string | null;
  link: string | null;
  scrapedAt: string;
}

export interface PageOfferData {
  title: string | undefined;
  price: string | null;
  retailer: string | null;
  link: string | null;
  scrapedAt: string;
}

export interface ScrapingConfig {
  url: string;
  headless: boolean;
  timeout: number;
  outputPath: string;
  brandPattern: RegExp;
  cookies?: { name: string; value: string; domain: string; path?: string }[];
  userAgent?: string;
  bypassCloudflare?: boolean;
  fallbackParse?: boolean; 
}

export const DEFAULT_CONFIG: ScrapingConfig = {
  url: "https://www.mydealz.de/gruppe/energy-drinks?retailers=78%2C122%2C27%2C2977%2C49%2C2561&hide_expired=1&sortBy=new&temperatureFrom=any",
  headless: true,
  timeout: 5000,
  outputPath: "data/offers.json",
  brandPattern: /Red\s?Bull|Monster/i,
  userAgent: "Chrome/118.0.0.0",
  bypassCloudflare: true,
  fallbackParse: true,
  cookies: [
    {
      name: "__eoi",
      value: "ID=c732aabef2c61ea8:T=1762855520:RT=1762855520:S=AA-AfjZM6j3Ng9P8ple2Bk4AjeMR",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "cookie_policy_agreement",
      value: "3",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "dont-track",
      value: "1",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "f_c",
      value: "0",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "f_v",
      value: "%22eb7cdb48-bee5-11f0-9279-0242ac110002%22",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "g_p",
      value: "0",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "pepper_session",
      value: "%22QbEid4p9cpIWWKuz6sHJzx8wXkKBem1HnSZcwAIK%22",
      domain: ".mydealz.de",
      path: "/"
    },
    {
      name: "u_l",
      value: "0",
      domain: ".mydealz.de",
      path: "/"
    }
  ]
};


export function parseOffersFromHtml(html: string, config: ScrapingConfig): OfferData[] {

  const cheerio = require('cheerio');
  const $ = cheerio.load(html);
  const offers: OfferData[] = [];

  $("article.thread").each((_: unknown, el: unknown) => {
    const container = $(el);
    const titleEl = container.find('strong.thread-title a.thread-link').first();
    const priceEl = container.find('.thread-price').first();

    const retailerText = container.find("span:contains('Verfügbar bei')").first().text();
    const retailerMatch = retailerText.match(/Verfügbar bei\s+(.*)/i);
    const retailer = retailerMatch ? retailerMatch[1].trim() : null;
    const title = titleEl.text().trim();
    let price = priceEl.text().trim();
    price = price || null;
    const link = titleEl.attr('href') || null;

    if (title && title.match(config.brandPattern)) {
      offers.push({
        title,
        price,
        retailer,
        link,
        scrapedAt: new Date().toISOString()
      });
    }
  });

  return offers;
}
export function isValidOffer(offer: RawOfferData): offer is OfferData {
  return Boolean(
    offer.title && 
    offer.title.trim().length > 0 &&
    offer.title.match(DEFAULT_CONFIG.brandPattern)
  );
}

export function cleanText(text: string | undefined | null): string | null {
  if (!text) return null;
  return text.trim().replace(/\n/g, " ");
}

export class ScrapingError extends Error {
  constructor(message: string, public readonly cause?: Error) {
    super(message);
    this.name = 'ScrapingError';
  }
}

export class ChallengeDetectedError extends ScrapingError {
  constructor(message = 'Cloudflare/Turnstile challenge detected instead of target content') {
    super(message);
    this.name = 'ChallengeDetectedError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public readonly data?: unknown) {
    super(message);
    this.name = 'ValidationError';
  }
}