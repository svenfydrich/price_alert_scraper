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
    cookies?: {
        name: string;
        value: string;
        domain: string;
        path?: string;
    }[];
    userAgent?: string;
    bypassCloudflare?: boolean;
    fallbackParse?: boolean;
}
export declare const DEFAULT_CONFIG: ScrapingConfig;
export declare function parseOffersFromHtml(html: string, config: ScrapingConfig): OfferData[];
export declare function isValidOffer(offer: RawOfferData): offer is OfferData;
export declare function cleanText(text: string | undefined | null): string | null;
export declare class ScrapingError extends Error {
    readonly cause?: Error | undefined;
    constructor(message: string, cause?: Error | undefined);
}
export declare class ChallengeDetectedError extends ScrapingError {
    constructor(message?: string);
}
export declare class ValidationError extends Error {
    readonly data?: unknown | undefined;
    constructor(message: string, data?: unknown | undefined);
}
//# sourceMappingURL=utils.d.ts.map