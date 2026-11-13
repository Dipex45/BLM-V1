import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { company } from '../lib/company';
import { getSeoEntry, siteUrl } from '../lib/seo';

function setMeta(selector: string, attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(selector);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

export default function SEOManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const entry = getSeoEntry(pathname);
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    const canonicalUrl = `${siteUrl}${cleanPath}`;
    const imageUrl = `${siteUrl}${company.transportHeroImage}`;

    document.title = entry.title;
    setMeta('meta[name="description"]', 'name', 'description', entry.description);
    setMeta('meta[name="robots"]', 'name', 'robots', entry.index === false ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setMeta('meta[property="og:type"]', 'property', 'og:type', 'website');
    setMeta('meta[property="og:site_name"]', 'property', 'og:site_name', company.name);
    setMeta('meta[property="og:title"]', 'property', 'og:title', entry.title);
    setMeta('meta[property="og:description"]', 'property', 'og:description', entry.description);
    setMeta('meta[property="og:url"]', 'property', 'og:url', canonicalUrl);
    setMeta('meta[property="og:image"]', 'property', 'og:image', imageUrl);
    setMeta('meta[name="twitter:card"]', 'name', 'twitter:card', 'summary_large_image');
    setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', entry.title);
    setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', entry.description);
    setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', imageUrl);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    const graph: Record<string, unknown>[] = [
      {
        '@type': 'Organization',
        '@id': `${siteUrl}/#organization`,
        name: company.name,
        legalName: company.legalName,
        url: siteUrl,
        logo: `${siteUrl}${company.logo}`,
        image: imageUrl,
        description: company.summary,
        email: company.email,
        telephone: company.phone,
        areaServed: ['Nigeria', 'Benin Republic', 'Togo', 'Ghana'],
        contactPoint: {
          '@type': 'ContactPoint',
          telephone: company.phone,
          contactType: 'reservations',
          areaServed: ['NG', 'BJ', 'TG', 'GH'],
          availableLanguage: ['English', 'French'],
        },
      },
      {
        '@type': 'WebSite',
        '@id': `${siteUrl}/#website`,
        url: siteUrl,
        name: company.name,
        publisher: { '@id': `${siteUrl}/#organization` },
        inLanguage: ['en', 'fr'],
      },
    ];

    if (entry.serviceType) {
      graph.push({
        '@type': 'Service',
        '@id': `${canonicalUrl}#service`,
        name: entry.serviceType,
        description: entry.description,
        url: canonicalUrl,
        provider: { '@id': `${siteUrl}/#organization` },
        areaServed: entry.areas,
        serviceType: entry.serviceType,
      });
    }

    let schema = document.head.querySelector<HTMLScriptElement>('#seo-structured-data');
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'seo-structured-data';
      schema.type = 'application/ld+json';
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify({ '@context': 'https://schema.org', '@graph': graph });
  }, [pathname]);

  return null;
}
