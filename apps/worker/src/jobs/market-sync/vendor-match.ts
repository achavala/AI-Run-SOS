/**
 * Match market job companies to known vendors in the directory.
 * Uses domain extraction from company website / apply URL / recruiter email
 * and fuzzy company name matching against the vendor directory.
 */
import type { PrismaClient } from '@prisma/client';

interface VendorMatchResult {
  matchedVendorId: string | null;
  companyDomain: string | null;
  matchMethod: 'domain' | 'name' | null;
}

interface VendorCacheEntry {
  id: string;
  companyName: string;
  domain: string | null;
  contactEmail: string | null;
}

let vendorCache: VendorCacheEntry[] = [];
let cacheLoadedAt = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

async function loadVendorCache(prisma: PrismaClient): Promise<VendorCacheEntry[]> {
  if (Date.now() - cacheLoadedAt < CACHE_TTL_MS && vendorCache.length > 0) {
    return vendorCache;
  }

  const vendors = await prisma.vendor.findMany({
    select: {
      id: true,
      companyName: true,
      domain: true,
      contactEmail: true,
    },
  });

  vendorCache = vendors;
  cacheLoadedAt = Date.now();
  return vendors;
}

function extractDomain(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    return new URL(url).hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

function extractEmailDomain(email: string | null | undefined): string | null {
  if (!email) return null;
  const parts = email.split('@');
  if (parts.length !== 2) return null;
  return parts[1]!.toLowerCase().replace(/^www\./, '');
}

function normalizeCompanyName(name: string): string {
  return name
    .toLowerCase()
    .replace(/\b(inc|llc|ltd|corp|corporation|co|company|group|solutions|services|consulting|technologies|tech|staffing|international)\b/g, '')
    .replace(/[^a-z0-9]/g, '')
    .trim();
}

/**
 * Match a market job to a known vendor.
 * Priority: domain match > company name match
 */
export async function matchToVendor(
  prisma: PrismaClient,
  company: string,
  applyUrl: string | null | undefined,
  recruiterEmail: string | null | undefined,
): Promise<VendorMatchResult> {
  const vendors = await loadVendorCache(prisma);

  // Extract domains from available sources
  const applyDomain = extractDomain(applyUrl);
  const emailDomain = extractEmailDomain(recruiterEmail);
  const companyDomain = applyDomain || emailDomain;

  // 1. Domain match (strongest signal)
  if (companyDomain) {
    for (const vendor of vendors) {
      // Match against vendor's stored domain
      if (vendor.domain && vendor.domain.toLowerCase() === companyDomain) {
        return { matchedVendorId: vendor.id, companyDomain, matchMethod: 'domain' };
      }
      // Match against vendor's contact email domain
      const vendorEmailDomain = extractEmailDomain(vendor.contactEmail);
      if (vendorEmailDomain && vendorEmailDomain === companyDomain) {
        return { matchedVendorId: vendor.id, companyDomain, matchMethod: 'domain' };
      }
    }
  }

  // 2. Fuzzy company name match
  const normalizedInput = normalizeCompanyName(company);
  if (normalizedInput.length >= 3) {
    for (const vendor of vendors) {
      const normalizedVendor = normalizeCompanyName(vendor.companyName);
      if (normalizedVendor.length >= 3) {
        // Exact normalized match
        if (normalizedInput === normalizedVendor) {
          return { matchedVendorId: vendor.id, companyDomain, matchMethod: 'name' };
        }
        // Substring containment (one contains the other)
        if (
          (normalizedInput.length >= 5 && normalizedVendor.includes(normalizedInput)) ||
          (normalizedVendor.length >= 5 && normalizedInput.includes(normalizedVendor))
        ) {
          return { matchedVendorId: vendor.id, companyDomain, matchMethod: 'name' };
        }
      }
    }
  }

  return { matchedVendorId: null, companyDomain, matchMethod: null };
}

/**
 * Clear the vendor cache (call after vendor changes).
 */
export function clearVendorCache(): void {
  vendorCache = [];
  cacheLoadedAt = 0;
}
