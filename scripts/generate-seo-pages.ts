/**
 * Runs after `vite build`. Writes a ready-made HTML file for each public page (so search
 * engines see the right title and description without running JavaScript), plus
 * sitemap.xml and robots.txt. Text comes from src/lib/seo.ts, the same list the site uses.
 *
 * The live address comes from VITE_SITE_URL, or APP_URL if that is not set.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { company } from '../src/lib/company';
import { seoEntries, structuredData, type SeoEntry } from '../src/lib/seo';

const siteUrl = (process.env.VITE_SITE_URL || process.env.APP_URL || 'https://blm-v1.vercel.app').replace(/\/$/, '');
const imageUrl = `${siteUrl}${company.transportHeroImage}`;
const today = new Date().toISOString().slice(0, 10);

const escapeHtml = (value: string) => value.replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');

function replaceOrInsert(html: string, pattern: RegExp, replacement: string) {
  return pattern.test(html) ? html.replace(pattern, replacement) : html.replace('</head>', `    ${replacement}\n  </head>`);
}

function renderPage(template: string, route: string, entry: SeoEntry) {
  const canonical = `${siteUrl}${route}`;
  let html = template;
  html = replaceOrInsert(html, /<title>.*?<\/title>/s, `<title>${escapeHtml(entry.title)}</title>`);
  html = replaceOrInsert(html, /<meta\s+name="description"[^>]*>/i, `<meta name="description" content="${escapeHtml(entry.description)}" />`);
  html = replaceOrInsert(html, /<meta\s+name="robots"[^>]*>/i, '<meta name="robots" content="index, follow, max-image-preview:large" />');
  html = replaceOrInsert(html, /<link\s+rel="canonical"[^>]*>/i, `<link rel="canonical" href="${canonical}" />`);

  const socialTags: Array<[string, string, string]> = [
    ['property', 'og:type', 'website'],
    ['property', 'og:site_name', company.name],
    ['property', 'og:title', entry.title],
    ['property', 'og:description', entry.description],
    ['property', 'og:url', canonical],
    ['property', 'og:image', imageUrl],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', entry.title],
    ['name', 'twitter:description', entry.description],
    ['name', 'twitter:image', imageUrl],
  ];
  for (const [attribute, key, content] of socialTags) {
    const pattern = new RegExp(`<meta\\s+(?:name|property)="${key.replace('.', '\\.')}"[^>]*>`, 'i');
    html = replaceOrInsert(html, pattern, `<meta ${attribute}="${key}" content="${escapeHtml(content)}" />`);
  }

  const data = structuredData(route, entry, {
    name: company.name,
    legalName: company.legalName,
    logo: company.logo,
    image: company.transportHeroImage,
    summary: company.summary,
    email: company.email,
    phone: company.phone,
  });
  const jsonLd = JSON.stringify(data).replaceAll('<', '\\u003c');
  html = html.replace(/\s*<script id="seo-structured-data"[^>]*>.*?<\/script>/s, '');
  return html.replace('</head>', `    <script id="seo-structured-data" type="application/ld+json">${jsonLd}</script>\n  </head>`);
}

const distDir = path.resolve('dist');
const template = (await readFile(path.join(distDir, 'index.html'), 'utf8')).replaceAll('https://blm-v1.vercel.app', siteUrl);
const pages = Object.entries(seoEntries).filter(([, entry]) => entry.priority);

for (const [route, entry] of pages) {
  const outputDirectory = route === '/' ? distDir : path.join(distDir, route.slice(1));
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(path.join(outputDirectory, 'index.html'), renderPage(template, route, entry));
}

const sitemap = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map(([route, entry]) => `  <url>
    <loc>${siteUrl}${route}</loc>
    <lastmod>${today}</lastmod>
    <priority>${entry.priority}</priority>
  </url>`).join('\n')}
</urlset>
`;

await writeFile(path.join(distDir, 'sitemap.xml'), sitemap);
await writeFile(
  path.join(distDir, 'robots.txt'),
  `User-agent: *\nAllow: /\nDisallow: /admin\nDisallow: /checkout\nDisallow: /driver\nDisallow: /dashboard\nSitemap: ${siteUrl}/sitemap.xml\n`,
);
console.log(`Generated ${pages.length} search-ready pages for ${siteUrl}`);
