import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const siteUrl = (process.env.VITE_SITE_URL || 'https://blm-v1.vercel.app').replace(/\/$/, '');
const imageUrl = `${siteUrl}/brand/services-corridor-v3.webp`;
const lastModified = '2026-10-23';

const pages = [
  ['/', 'West Africa Transport & Cotonou Trips | BLM Motors', 'Book reliable transport from Lagos to Cotonou, Benin Republic, Togo and Ghana with BLM Motors. Cross-border trips, car hire, touring and logistics across West Africa.', 'Passenger transport, touring, car hire and logistics', ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '1.0'],
  ['/services', 'Transport Services in Nigeria & West Africa | BLM Motors', 'Compare and book BLM Motors transport services: distance trips, Lagos-Cotonou travel, West Africa cross-border transit, touring, car hire and logistics.', 'Transport and logistics services', ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '0.9'],
  ['/services/long-and-short-distance-trips', 'Distance Transport in Nigeria | BLM Motors', 'Book private long and short distance transport priced per kilometre for journeys within Lagos and across Nigeria.', 'Long and short distance passenger transport', ['Lagos', 'Nigeria'], '0.8'],
  ['/services/cross-border-trips', 'West Africa Cross-Border Transport | BLM Motors', 'Book cross-border transport from Nigeria to Cotonou, Benin Republic, Lome, Togo and Accra, Ghana with BLM Motors.', 'West Africa cross-border passenger transport', ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '0.9'],
  ['/services/touring', 'Nigeria & West Africa Tour Packages | BLM Motors', 'Choose guided touring packages in Nigeria, Benin Republic, Togo and Ghana, with transport and planned sightseeing stops.', 'Guided tours and destination transport', ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '0.8'],
  ['/services/car-hire', 'Car Hire in Lagos & Nigeria | BLM Motors', 'Hire a car for airport transfers, business travel, events and private journeys from approved BLM Motors pickup locations.', 'Car hire', ['Lagos', 'Nigeria'], '0.8'],
  ['/services/pickup-and-logistics', 'Pickup & Logistics in Nigeria | BLM Motors', 'Arrange traceable parcel and cargo pickup with distance and weight-based pricing for deliveries across Nigeria and regional routes.', 'Pickup and logistics', ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '0.8'],
  ['/corridors/lagos-cotonou', 'Lagos to Cotonou Transport | BLM Motors', 'Book Lagos to Cotonou transport with planned pickup, border-ready dispatch support and clear travel requirements for Nigeria-Benin Republic journeys.', 'Lagos to Cotonou passenger transport', ['Lagos', 'Cotonou', 'Nigeria', 'Benin Republic'], '0.9'],
  ['/corridors/cotonou-lagos', 'Cotonou to Lagos Transport | BLM Motors', 'Book Cotonou to Lagos transport from BLM Motors Cotonou Station with coordinated cross-border travel into Nigeria.', 'Cotonou to Lagos passenger transport', ['Cotonou', 'Lagos', 'Benin Republic', 'Nigeria'], '0.9'],
  ['/corridors/lagos-lome', 'Lagos to Lome Transport | BLM Motors', 'Book scheduled transport from Lagos through Benin Republic to Lome, Togo, with coordinated regional dispatch support.', 'Lagos to Lome passenger transport', ['Lagos', 'Cotonou', 'Lome', 'Nigeria', 'Benin Republic', 'Togo'], '0.8'],
  ['/corridors/lagos-accra', 'Lagos to Accra Transport | BLM Motors', 'Book Lagos to Accra road transport through Benin Republic and Togo, with scheduled stops and cross-border dispatch support.', 'Lagos to Accra passenger transport', ['Lagos', 'Cotonou', 'Lome', 'Accra', 'Nigeria', 'Benin Republic', 'Togo', 'Ghana'], '0.8'],
  ['/legal', 'Privacy & Terms | BLM Motors', 'Read the privacy policy, booking terms and service conditions for BLM Motors transport and logistics services.', null, [], '0.3'],
];

const escapeHtml = (value) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function replaceOrInsert(html, pattern, replacement) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function renderPage(template, page) {
  const [route, title, description, serviceType, areas] = page;
  const canonical = `${siteUrl}${route}`;
  let html = template;
  html = replaceOrInsert(html, /<title>.*?<\/title>/s, `<title>${escapeHtml(title)}</title>`);
  html = replaceOrInsert(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(description)}" />`);
  html = replaceOrInsert(html, /<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large" />');
  html = replaceOrInsert(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);

  const socialTags = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', 'BLM Motors'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:image', imageUrl],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl],
  ];
  for (const [attribute, key, content] of socialTags) {
    const pattern = new RegExp(`<meta\\s+(?:name|property)="${key.replace('.', '\\.')}"[^>]*>`, 'i');
    html = replaceOrInsert(html, pattern, `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`);
  }

  const graph = [
    {
      '@type': 'Organization',
      '@id': `${siteUrl}/#organization`,
      name: 'BLM Motors',
      legalName: 'BLM Motors',
      url: siteUrl,
      logo: `${siteUrl}/brand/blm-logo-wide.png`,
      image: imageUrl,
      description: 'Reliable 24/7 transport, car hire, touring, pickup, interstate movement, and cross-border trips from Nigeria to Benin Republic, Togo, and Ghana.',
      email: 'bookings@blmmotors.ng',
      telephone: '+2290142439626',
      areaServed: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
      contactPoint: {
        '@type': 'ContactPoint',
        telephone: '+2290142439626',
        contactType: 'reservations',
        areaServed: ['NG', 'BJ', 'TG', 'GH'],
        availableLanguage: ['English', 'French'],
      },
    },
    {
      '@type': 'WebSite',
      '@id': `${siteUrl}/#website`,
      url: siteUrl,
      name: 'BLM Motors',
      publisher: { '@id': `${siteUrl}/#organization` },
      inLanguage: ['en', 'fr'],
    },
  ];
  if (serviceType) {
    graph.push({
      '@type': 'Service',
      '@id': `${canonical}#service`,
      name: serviceType,
      description,
      url: canonical,
      provider: { '@id': `${siteUrl}/#organization` },
      areaServed: areas,
      serviceType,
    });
  }
  const jsonLd = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replaceAll('<', '\\u003c');
  html = html.replace(/\s*<script id="seo-structured-data"[^>]*>.*?<\/script>/s, '');
  html = html.replace('</head>', `    <script id="seo-structured-data" type="application/ld+json">${jsonLd}</script>\n  </head>`);
  return html;
}

const distDir = path.resolve('dist');
const template = await readFile(path.join(distDir, 'index.html'), 'utf8');

for (const page of pages) {
  const [route] = page;
  const outputDirectory = route === '/' ? distDir : path.join(distDir, route.slice(1));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), renderPage(template, page));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([route, , , , , priority]) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${lastModified}</lastmod>
    <priority>${priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

await writeFile(path.join(distDir, 'sitemap.xml'), sitemap);
await writeFile(path.join(distDir, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
console.log(`Generated ${pages.length} search-ready pages for ${siteUrl}`);
