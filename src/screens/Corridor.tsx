import { Link, Navigate, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { company } from '../lib/company';
import { useLocale } from '../contexts/LocaleContext';
import { useCatalog } from '../hooks/useCatalog';
import { useCurrency } from '../contexts/CurrencyContext';
import { easeOutExpo, Reveal } from '../components/ui/motion';

type Text = { en: string; fr: string };
type Corridor = {
  from: string;
  to: string;
  countries: string;
  /** Country used for the cross-border price (matches an entry in the catalog). */
  priceCountry: string;
  summary: Text;
  overview: Text;
  notes: { en: string[]; fr: string[] };
};

export const corridors: Record<string, Corridor> = {
  'lagos-cotonou': {
    from: 'Lagos', to: 'Cotonou', countries: 'Nigeria → Benin Republic', priceCountry: 'Benin Republic',
    summary: { en: 'Comfortable trips from Lagos to Cotonou, with help at the border.', fr: 'Des trajets confortables de Lagos a Cotonou, avec assistance a la frontiere.' },
    overview: { en: 'We take individuals, families, business travellers and groups from Lagos to Cotonou. Book online to get your price straight away, and we’ll confirm your pickup before you travel.', fr: 'Nous transportons particuliers, familles, professionnels et groupes de Lagos a Cotonou. Reservez en ligne pour obtenir votre prix immediatement; nous confirmons la prise en charge avant le depart.' },
    notes: { en: ['Journey time depends on traffic and the border queue.', 'We confirm your trip once we’ve checked passenger details and documents.', 'Entry into another country is always decided by border officials.'], fr: ['La duree depend de la circulation et de la file a la frontiere.', 'Le trajet est confirme apres verification des passagers et des documents.', "L'entree dans un autre pays est toujours decidee par les agents frontaliers."] },
  },
  'cotonou-lagos': {
    from: 'Cotonou', to: 'Lagos', countries: 'Benin Republic → Nigeria', priceCountry: 'Benin Republic',
    summary: { en: 'Trips from Cotonou to Lagos, picking you up from our Cotonou station.', fr: 'Des trajets de Cotonou a Lagos, au depart de notre station de Cotonou.' },
    overview: { en: 'Travel from Cotonou to Lagos for personal, business or group trips. We confirm your pickup time and place before you set off, and check everyone’s travel documents first.', fr: 'Voyagez de Cotonou a Lagos pour des trajets personnels, professionnels ou de groupe. Nous confirmons l’heure et le lieu de prise en charge et verifions les documents de voyage.' },
    notes: { en: ['We confirm your pickup details before you travel.', 'Journey time depends on traffic and the border queue.', 'Every passenger needs valid travel documents.'], fr: ['Les informations de prise en charge sont confirmees avant le depart.', 'La duree depend de la circulation et de la file a la frontiere.', 'Chaque passager doit avoir des documents de voyage valides.'] },
  },
  'lagos-lome': {
    from: 'Lagos', to: 'Lomé', countries: 'Nigeria → Benin Republic → Togo', priceCountry: 'Togo',
    summary: { en: 'Planned trips from Lagos to Lomé, travelling through Benin Republic.', fr: 'Des trajets planifies de Lagos a Lome, via le Benin.' },
    overview: { en: 'We drive you from Lagos to Lomé through Benin Republic. Before you travel, we confirm your car, pickup point and what documents you need.', fr: 'Nous vous conduisons de Lagos a Lome via le Benin. Avant le depart, nous confirmons le vehicule, le point de prise en charge et les documents necessaires.' },
    notes: { en: ['This trip crosses two borders.', 'Allow extra time for document and customs checks.', 'We confirm the final departure time before you travel.'], fr: ['Ce trajet traverse deux frontieres.', 'Prevoyez du temps pour les controles.', 'L’heure de depart finale est confirmee avant le voyage.'] },
  },
  'lagos-accra': {
    from: 'Lagos', to: 'Accra', countries: 'Nigeria → Benin → Togo → Ghana', priceCountry: 'Ghana',
    summary: { en: 'Long-distance road trips to Accra, with planned rest and border stops.', fr: 'Des trajets longue distance vers Accra, avec des arrets planifies.' },
    overview: { en: 'Travel by road from Lagos to Accra through Benin Republic and Togo. We plan your stops, border crossings and departure time in advance.', fr: 'Voyagez par la route de Lagos a Accra via le Benin et le Togo. Nous planifions les arrets, les frontieres et le depart a l’avance.' },
    notes: { en: ['Every passenger needs a valid travel document.', 'Journey time can vary a lot at the borders.', 'We confirm your car, pickup point and expected arrival time.'], fr: ['Chaque passager doit avoir un document de voyage valide.', 'La duree peut beaucoup varier aux frontieres.', 'Nous confirmons le vehicule, le depart et l’arrivee prevue.'] },
  },
};

export default function CorridorPage() {
  const { slug = '' } = useParams<{ slug: string }>();
  const { language } = useLocale();
  const { catalog } = useCatalog();
  const { formatPrice } = useCurrency();
  const corridor = corridors[slug];
  if (!corridor) return <Navigate to="/services" replace />;

  const french = language === 'fr';
  const factor = catalog?.internationalTours.find((country) => country.name === corridor.priceCountry)?.factor;
  const fromPrice = catalog && factor ? Math.round(Number(catalog.rules.crossBorderBasePerPassenger) * factor) : null;
  const bookUrl = `/services/cross-border-trips?country=${encodeURIComponent(corridor.priceCountry)}`;
  const whatsappMessage = french
    ? `Bonjour BLM, je souhaite reserver le trajet ${corridor.from} - ${corridor.to}.`
    : `Good day BLM, I want to book the ${corridor.from} to ${corridor.to} trip.`;

  return (
    <div>
      <header className="relative isolate overflow-hidden bg-black text-white">
        <motion.img src={company.transportHeroImage} alt={`BLM car for ${corridor.from} to ${corridor.to} trips`} className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55" initial={{ scale: 1.08 }} animate={{ scale: 1 }} transition={{ duration: 1.4, ease: easeOutExpo }} />
        <div className="absolute inset-0 -z-10 bg-gradient-to-r from-black via-black/75 to-black/30" />
        <div className="hero-grid absolute inset-0 -z-10" />
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7, ease: easeOutExpo }} className="container-page flex min-h-[60vh] flex-col justify-end py-16">
          <p className="eyebrow">{corridor.countries}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-extrabold leading-[1.05] sm:text-6xl">{corridor.from} to {corridor.to} {french ? '' : 'transport'}</h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">{corridor.summary[language]}</p>
          {fromPrice && <p className="mt-4 text-sm font-semibold text-white/80">{french ? 'A partir de' : 'From'} <span className="text-2xl font-extrabold text-white">{formatPrice(fromPrice)}</span> {french ? 'par passager' : 'per passenger'}</p>}
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to={bookUrl} className="btn-primary btn-lg">{french ? 'Voir le prix et reserver' : 'See price and book'}</Link>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(whatsappMessage)}`} target="_blank" rel="noreferrer" className="btn btn-lg border border-white/30 bg-white/10 text-white backdrop-blur hover:bg-white/20">WhatsApp</a>
          </div>
        </motion.div>
      </header>

      <main className="container-page py-16">
        <Reveal className="max-w-3xl">
          <p className="eyebrow">{french ? 'Transport regional' : 'Cross-border travel'}</p>
          <h2 className="mt-3 text-3xl font-extrabold">{french ? `Voyager de ${corridor.from} a ${corridor.to}` : `Travelling from ${corridor.from} to ${corridor.to}`}</h2>
          <p className="mt-5 leading-7 text-on-surface-variant">{corridor.overview[language]}</p>
        </Reveal>

        <div className="mt-12 grid gap-6 lg:grid-cols-2">
          <Reveal className="card p-6 sm:p-8">
            <h2 className="text-xl font-bold">{french ? 'Documents a prevoir' : 'What to bring'}</h2>
            <ul className="mt-5 space-y-3">
              {(french
                ? ['Passeport ou document de voyage regional valide', 'Visa ou autorisation d’entree si necessaire', 'Documents requis pour les mineurs', 'Documents de douane pour les marchandises']
                : ['A valid passport or accepted regional travel document', 'A visa or entry permit, if you need one', 'Consent documents for children travelling', 'Customs papers for any goods you are carrying']
              ).map((item) => <li key={item} className="flex gap-3 text-sm"><span className="material-symbols-outlined text-primary">check_circle</span>{item}</li>)}
            </ul>
          </Reveal>
          <Reveal delay={0.08} className="card p-6 sm:p-8">
            <h2 className="text-xl font-bold">{french ? 'Bon a savoir' : 'Good to know'}</h2>
            <ul className="mt-5 space-y-3">{corridor.notes[language].map((note) => <li key={note} className="flex gap-3 text-sm text-on-surface-variant"><span className="material-symbols-outlined text-primary">info</span>{note}</li>)}</ul>
            <p className="mt-6 border-t border-outline pt-5 text-xs text-on-surface-variant">{french ? 'Les regles aux frontieres peuvent changer. Verifiez les regles officielles avant de partir.' : 'Border rules can change. Please check the official entry rules before you travel.'}</p>
          </Reveal>
        </div>

        <nav aria-label="Other routes" className="mt-14 border-t border-outline pt-10">
          <p className="eyebrow">{french ? 'Autres trajets' : 'Other popular routes'}</p>
          <div className="mt-4 flex flex-wrap gap-2">
            {Object.entries(corridors).filter(([key]) => key !== slug).map(([key, item]) => (
              <Link key={key} to={`/corridors/${key}`} className="chip hover:border-primary">{item.from} to {item.to}</Link>
            ))}
          </div>
        </nav>
      </main>
    </div>
  );
}
