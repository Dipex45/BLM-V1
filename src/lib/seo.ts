export type SeoEntry = {
  title: string;
  description: string;
  index?: boolean;
  serviceType?: string;
  areas?: string[];
};

export const siteUrl = (import.meta.env.VITE_SITE_URL || 'https://blm-v1.vercel.app').replace(/\/$/, '');

export const seoEntries: Record<string, SeoEntry> = {
  '/': {
    title: 'West Africa Transport & Cotonou Trips | BLM Motors',
    description: 'Book reliable transport from Lagos to Cotonou, Benin Republic, Togo and Ghana with BLM Motors. Cross-border trips, car hire, touring and logistics across West Africa.',
    serviceType: 'Passenger transport, touring, car hire and logistics',
    areas: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/services': {
    title: 'Transport Services in Nigeria & West Africa | BLM Motors',
    description: 'Compare and book BLM Motors transport services: distance trips, Lagos-Cotonou travel, West Africa cross-border transit, touring, car hire and logistics.',
    serviceType: 'Transport and logistics services',
    areas: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/services/long-and-short-distance-trips': {
    title: 'Distance Transport in Nigeria | BLM Motors',
    description: 'Book private long and short distance transport priced per kilometre for journeys within Lagos and across Nigeria.',
    serviceType: 'Long and short distance passenger transport',
    areas: ['Lagos', 'Nigeria'],
  },
  '/services/cross-border-trips': {
    title: 'West Africa Cross-Border Transport | BLM Motors',
    description: 'Book cross-border transport from Nigeria to Cotonou, Benin Republic, Lome, Togo and Accra, Ghana with BLM Motors.',
    serviceType: 'West Africa cross-border passenger transport',
    areas: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/services/touring': {
    title: 'Nigeria & West Africa Tour Packages | BLM Motors',
    description: 'Choose guided touring packages in Nigeria, Benin Republic, Togo and Ghana, with transport and planned sightseeing stops.',
    serviceType: 'Guided tours and destination transport',
    areas: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/services/car-hire': {
    title: 'Car Hire in Lagos & Nigeria | BLM Motors',
    description: 'Hire a car for airport transfers, business travel, events and private journeys from approved BLM Motors pickup locations.',
    serviceType: 'Car hire',
    areas: ['Lagos', 'Nigeria'],
  },
  '/services/pickup-and-logistics': {
    title: 'Pickup & Logistics in Nigeria | BLM Motors',
    description: 'Arrange traceable parcel and cargo pickup with distance and weight-based pricing for deliveries across Nigeria and regional routes.',
    serviceType: 'Pickup and logistics',
    areas: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/corridors/lagos-cotonou': {
    title: 'Lagos to Cotonou Transport | BLM Motors',
    description: 'Book Lagos to Cotonou transport with planned pickup, border-ready dispatch support and clear travel requirements for Nigeria-Benin Republic journeys.',
    serviceType: 'Lagos to Cotonou passenger transport',
    areas: ['Lagos', 'Cotonou', 'Nigeria', 'Benin Republic'],
  },
  '/corridors/cotonou-lagos': {
    title: 'Cotonou to Lagos Transport | BLM Motors',
    description: 'Book Cotonou to Lagos transport from BLM Motors Cotonou Station with coordinated cross-border travel into Nigeria.',
    serviceType: 'Cotonou to Lagos passenger transport',
    areas: ['Cotonou', 'Lagos', 'Benin Republic', 'Nigeria'],
  },
  '/corridors/lagos-lome': {
    title: 'Lagos to Lome Transport | BLM Motors',
    description: 'Book scheduled transport from Lagos through Benin Republic to Lome, Togo, with coordinated regional dispatch support.',
    serviceType: 'Lagos to Lome passenger transport',
    areas: ['Lagos', 'Cotonou', 'Lome', 'Nigeria', 'Benin Republic', 'Togo'],
  },
  '/corridors/lagos-accra': {
    title: 'Lagos to Accra Transport | BLM Motors',
    description: 'Book Lagos to Accra road transport through Benin Republic and Togo, with scheduled stops and cross-border dispatch support.',
    serviceType: 'Lagos to Accra passenger transport',
    areas: ['Lagos', 'Cotonou', 'Lome', 'Accra', 'Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
  },
  '/legal': {
    title: 'Privacy & Terms | BLM Motors',
    description: 'Read the privacy policy, booking terms and service conditions for BLM Motors transport and logistics services.',
  },
};

const privatePrefixes = ['/admin', '/dashboard', '/reports', '/checkout', '/login', '/register', '/verify-email', '/tracking', '/reviews'];

export function getSeoEntry(pathname: string): SeoEntry {
  const cleanPath = pathname !== '/' ? pathname.replace(/\/$/, '') : pathname;
  if (seoEntries[cleanPath]) return seoEntries[cleanPath];
  if (privatePrefixes.some((prefix) => cleanPath === prefix || cleanPath.startsWith(`${prefix}/`))) {
    return {
      title: 'BLM Motors',
      description: 'Secure BLM Motors customer and operations portal.',
      index: false,
    };
  }
  return {
    title: 'Page Not Found | BLM Motors',
    description: 'The requested BLM Motors page could not be found.',
    index: false,
  };
}
