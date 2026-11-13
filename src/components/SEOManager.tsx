import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { company } from '../lib/company';
import { getSeoEntry, siteUrl, structuredData } from '../lib/seo';

function setMeta(attribute: 'name' | 'property', key: string, content: string) {
  let element = document.head.querySelector<HTMLMetaElement>(`meta[${attribute}="${key}"]`);
  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute, key);
    document.head.appendChild(element);
  }
  element.content = content;
}

/** Keeps the page title, description, social preview and Google data in step with the route. */
export default function SEOManager() {
  const { pathname } = useLocation();

  useEffect(() => {
    const entry = getSeoEntry(pathname);
    const cleanPath = pathname === '/' ? '/' : pathname.replace(/\/$/, '');
    const canonicalUrl = `${siteUrl}${cleanPath}`;
    const imageUrl = `${siteUrl}${company.transportHeroImage}`;

    document.title = entry.title;
    setMeta('name', 'description', entry.description);
    setMeta('name', 'robots', entry.index === false ? 'noindex, nofollow' : 'index, follow, max-image-preview:large');
    setMeta('property', 'og:type', 'website');
    setMeta('property', 'og:site_name', company.name);
    setMeta('property', 'og:title', entry.title);
    setMeta('property', 'og:description', entry.description);
    setMeta('property', 'og:url', canonicalUrl);
    setMeta('property', 'og:image', imageUrl);
    setMeta('name', 'twitter:card', 'summary_large_image');
    setMeta('name', 'twitter:title', entry.title);
    setMeta('name', 'twitter:description', entry.description);
    setMeta('name', 'twitter:image', imageUrl);

    let canonical = document.head.querySelector<HTMLLinkElement>('link[rel="canonical"]');
    if (!canonical) {
      canonical = document.createElement('link');
      canonical.rel = 'canonical';
      document.head.appendChild(canonical);
    }
    canonical.href = canonicalUrl;

    let schema = document.head.querySelector<HTMLScriptElement>('#seo-structured-data');
    if (!schema) {
      schema = document.createElement('script');
      schema.id = 'seo-structured-data';
      schema.type = 'application/ld+json';
      document.head.appendChild(schema);
    }
    schema.textContent = JSON.stringify(structuredData(cleanPath, entry, {
      name: company.name,
      legalName: company.legalName,
      logo: company.logo,
      image: company.transportHeroImage,
      summary: company.summary,
      email: company.email,
      phone: company.phone,
    }));
  }, [pathname]);

  return null;
}
