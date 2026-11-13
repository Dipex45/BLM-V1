/**
 * Search-engine titles and descriptions for every public page.
 * Used in the browser (SEOManager) and at build time (scripts/generate-seo-pages.ts),
 * so the pre-built HTML and the live page always say the same thing.
 */
export type SeoEntry = {
  title: string;
  description: string;
  index?: boolean;
  serviceType?: string;
  areas?: string[];
  /** Sitemap priority (0–1). Only pages with a priority are pre-built and listed. */
  priority?: string;
};

const browserEnv = (import.meta as unknown as { env?: Record<string, string | undefined> }).env;
export const siteUrl = (browserEnv?.VITE_SITE_URL || 'https://blm-v1.vercel.app').replace(/\/$/, '');

const WEST_AFRICA = ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'];

export const seoEntries: Record<string, SeoEntry> = {
  '/': {
    title: 'West Africa Transport & Cotonou Trips | BLM Motors',
    description: 'Book safe, reliable transport from Lagos to Cotonou, Benin Republic, Togo and Ghana. Cross-border trips, car hire, tours and deliveries across West Africa.',
    serviceType: 'Passenger transport, tours, car hire and deliveries',
    areas: WEST_AFRICA,
    priority: '1.0',
  },
  '/services': {
    title: 'Transport Services in Nigeria & West Africa | BLM Motors',
    description: 'Compare and book BLM Motors services: rides by the kilometre, Lagos–Cotonou trips, cross-border travel, tours, car hire and deliveries.',
    serviceType: 'Transport and delivery services',
    areas: WEST_AFRICA,
    priority: '0.9',
  },
  '/services/long-and-short-distance-trips': {
    title: 'Rides Across Lagos & Nigeria | BLM Motors',
    description: 'Book a private ride across town or between states, priced by the kilometre. See your price before you pay.',
    serviceType: 'Private passenger rides',
    areas: ['Lagos', 'Nigeria'],
    priority: '0.8',
  },
  '/services/cross-border-trips': {
    title: 'Cross-Border Trips: Cotonou, Lomé & Accra | BLM Motors',
    description: 'Book trips from Nigeria to Cotonou in Benin Republic, Lomé in Togo and Accra in Ghana, with help at the border.',
    serviceType: 'Cross-border passenger transport',
    areas: WEST_AFRICA,
    priority: '0.9',
  },
  '/services/touring': {
    title: 'Tour Packages in Nigeria & West Africa | BLM Motors',
    description: 'Choose a ready-made tour with a driver and, if you like, a local guide — across Nigeria, Benin Republic, Togo and Ghana.',
    serviceType: 'Guided tours',
    areas: WEST_AFRICA,
    priority: '0.8',
  },
  '/services/car-hire': {
    title: 'Car Hire in Lagos & Nigeria | BLM Motors',
    description: 'Hire a car by the day for airport runs, business trips and events. Drive yourself or have one of our drivers.',
    serviceType: 'Car hire',
    areas: ['Lagos', 'Nigeria'],
    priority: '0.8',
  },
  '/services/pickup-and-logistics': {
    title: 'Parcel Pickup & Delivery in Nigeria | BLM Motors',
    description: 'We collect parcels and goods from your door and deliver them. Priced by weight and distance, with tracking at every step.',
    serviceType: 'Parcel pickup and delivery',
    areas: WEST_AFRICA,
    priority: '0.8',
  },
  '/corridors/lagos-cotonou': {
    title: 'Lagos to Cotonou Transport | BLM Motors',
    description: 'Book a comfortable trip from Lagos to Cotonou with a confirmed pickup, help at the border and a clear list of documents you need.',
    serviceType: 'Lagos to Cotonou passenger transport',
    areas: ['Lagos', 'Cotonou', 'Nigeria', 'Benin Republic'],
    priority: '0.9',
  },
  '/corridors/cotonou-lagos': {
    title: 'Cotonou to Lagos Transport | BLM Motors',
    description: 'Book a trip from our Cotonou station to Lagos, with your pickup confirmed before you travel.',
    serviceType: 'Cotonou to Lagos passenger transport',
    areas: ['Cotonou', 'Lagos', 'Benin Republic', 'Nigeria'],
    priority: '0.9',
  },
  '/corridors/lagos-lome': {
    title: 'Lagos to Lomé Transport | BLM Motors',
    description: 'Book a planned trip from Lagos to Lomé, Togo, travelling through Benin Republic.',
    serviceType: 'Lagos to Lomé passenger transport',
    areas: ['Lagos', 'Cotonou', 'Lomé', 'Nigeria', 'Benin Republic', 'Togo'],
    priority: '0.8',
  },
  '/corridors/lagos-accra': {
    title: 'Lagos to Accra Transport | BLM Motors',
    description: 'Book a road trip from Lagos to Accra through Benin Republic and Togo, with planned rest and border stops.',
    serviceType: 'Lagos to Accra passenger transport',
    areas: ['Lagos', 'Cotonou', 'Lomé', 'Accra', 'Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
    priority: '0.8',
  },
  '/legal': {
    title: 'Privacy & Terms | BLM Motors',
    description: 'How BLM Motors handles your information, and the terms for booking our services.',
    priority: '0.3',
  },
};

const privatePrefixes = ['/admin', '/dashboard', '/bookings', '/support', '/driver', '/reports', '/checkout', '/login', '/register', '/verify-email', '/tracking', '/reviews'];

export function getSeoEntry(pathname: string): SeoEntry {
  const cleanPath = pathname !== '/' ? pathname.replace(/\/$/, '') : pathname;
  if (seoEntries[cleanPath]) return seoEntries[cleanPath];
  if (privatePrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
    return { title: 'BLM Motors', description: 'Your BLM Motors account.', index: false };
  }
  return { title: 'Page Not Found | BLM Motors', description: 'Sorry, we couldn’t find that page.', index: false };
}

/** Organisation and service details for Google’s structured data. */
export function structuredData(path: string, entry: SeoEntry, details: { name: string; legalName: string; logo: string; image: string; summary: string; email: string; phone: string }) {
  const canonical = `${siteUrl}${path === '/' ? '/' : path}`;
  const graph: Record<string, unknown>[] = [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: details.name,
      legalName: details.legalName,
      url: siteUrl,
      logo: `${siteUrl}${details.logo}`,
      image: `${siteUrl}${details.image}`,
      description: details.summary,
      email: details.email,
      telephone: details.phone,
      areaServed: WEST_AFRICA,
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: details.phone,
        contactType: 'reservations',
        areaServed: ['NG', 'BJ', 'TG', 'GH'],
        availableLanguage: ['English', 'French'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: details.name,
      publisher: { '@id': `${siteUrl}/#organization` },
      inLanguage: ['en', 'fr'],
    },
  ];
  if (entry.serviceType) {
    graph.push({
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: entry.serviceType,
      description: entry.description,
      url: canonical,
      provider: { '@id': `${siteUrl}/#organization` },
      areaServed: entry.areas,
      serviceType: entry.serviceType,
    });
  }
  return { '@context': 'https://schema.org', '@graph': graph };
}
