import { Link, Navigate, useParams } from 'react-router-dom';
import { company } from '../lib/company';
import { useLocale } from '../contexts/LocaleContext';

const corridors = {
  'lagos-cotonou': {
    from: 'Lagos', to: 'Cotonou', countries: 'Nigeria - Benin Republic',
    summary: { en: 'Planned passenger movement between Lagos and Cotonou with border-ready dispatch support.', fr: 'Transport de passagers planifie entre Lagos et Cotonou avec assistance operationnelle au passage frontalier.' },
    notes: { en: ['Travel time changes with traffic and border processing.', 'Departure is confirmed after passenger and document review.', 'BLM does not guarantee immigration clearance.'], fr: ['La duree varie selon la circulation et les formalites frontalieres.', 'Le depart est confirme apres verification des passagers et des documents.', "BLM ne garantit pas l'autorisation d'immigration."] },
  },
  'lagos-lome': {
    from: 'Lagos', to: 'Lome', countries: 'Nigeria - Benin Republic - Togo',
    summary: { en: 'A coordinated regional route through Benin Republic to Lome for scheduled travel.', fr: 'Un trajet regional coordonne via le Benin jusqua Lome pour les voyages planifies.' },
    notes: { en: ['This route includes two international border crossings.', 'Allow additional time for document and customs checks.', 'Final timing is confirmed by dispatch before departure.'], fr: ['Ce trajet comprend deux passages de frontiere.', 'Prevoyez du temps supplementaire pour les controles.', 'Lheure finale est confirmee par les operations avant le depart.'] },
  },
  'lagos-accra': {
    from: 'Lagos', to: 'Accra', countries: 'Nigeria - Benin Republic - Togo - Ghana',
    summary: { en: 'Long-distance West African transit to Accra with scheduled rest and border stops.', fr: 'Transport longue distance vers Accra avec des arrets planifies et plusieurs passages frontaliers.' },
    notes: { en: ['A valid travel document is required for every passenger.', 'Journey duration varies substantially at regional borders.', 'Dispatch confirms vehicle, departure point, and estimated arrival.'], fr: ['Un document de voyage valide est requis pour chaque passager.', 'La duree varie considerablement aux frontieres regionales.', 'Les operations confirment le vehicule, le depart et larrivee estimee.'] },
  },
} as const;

export default function Corridor() {
  const { slug } = useParams<{ slug: keyof typeof corridors }>();
  const { language } = useLocale();
  const corridor = slug ? corridors[slug] : undefined;
  if (!corridor) return <Navigate to="/services" replace />;
  const french = language === 'fr';
  const whatsappMessage = french ? `Bonjour BLM, je souhaite reserver le trajet ${corridor.from} - ${corridor.to}.` : `Good day BLM, I want to book the ${corridor.from} to ${corridor.to} service.`;

  return (
    <div className="min-h-screen bg-background">
      <header className="relative min-h-[68vh] overflow-hidden bg-black px-4 py-16 text-white sm:px-6 lg:px-8">
        <img src={company.transportHeroImage} alt={`BLM vehicle for ${corridor.from} to ${corridor.to} transport`} className="absolute inset-0 h-full w-full object-cover opacity-55" />
        <div className="absolute inset-0 bg-black/65" />
        <div className="relative mx-auto flex min-h-[52vh] max-w-7xl flex-col justify-end pb-6">
          <p className="text-xs font-bold uppercase text-primary">{corridor.countries}</p>
          <h1 className="mt-3 max-w-4xl text-4xl font-black sm:text-6xl">{corridor.from} to {corridor.to}</h1>
          <p className="mt-5 max-w-2xl text-base leading-7 text-white/85 sm:text-lg">{corridor.summary[language]}</p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link to="/services/cross-border-trips" className="rounded-lg bg-primary px-6 py-3.5 text-sm font-bold text-white">{french ? 'Voir le tarif et reserver' : 'View price and book'}</Link>
            <a href={`https://wa.me/${company.whatsapp.replace('+', '')}?text=${encodeURIComponent(whatsappMessage)}`} className="rounded-lg border border-white/40 bg-black/30 px-6 py-3.5 text-sm font-bold text-white">WhatsApp</a>
          </div>
        </div>
      </header>

      <main className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 lg:grid-cols-2 lg:px-8">
        <section>
          <p className="text-xs font-bold uppercase text-primary">{french ? 'Documents de voyage' : 'Travel documents'}</p>
          <h2 className="mt-2 text-2xl font-black text-on-surface">{french ? 'Preparez vos documents avant le depart' : 'Prepare your documents before departure'}</h2>
          <ul className="mt-6 divide-y divide-outline border-y border-outline">
            {(french ? ['Passeport ou document de voyage regional valide', 'Visa ou autorisation dentree lorsque necessaire', 'Documents requis pour les mineurs', 'Documents de douane pour les marchandises declarees'] : ['Valid passport or accepted regional travel document', 'Visa or entry permission where applicable', 'Required consent documents for minors', 'Customs documents for declared commercial goods']).map((item) => <li key={item} className="flex gap-3 py-4 text-sm font-semibold text-on-surface"><span className="material-symbols-outlined text-primary">check_circle</span>{item}</li>)}
          </ul>
        </section>
        <section className="rounded-lg border border-outline bg-white p-6 sm:p-8">
          <p className="text-xs font-bold uppercase text-primary">{french ? 'Informations importantes' : 'Important travel notes'}</p>
          <ul className="mt-5 space-y-4">{corridor.notes[language].map((note) => <li key={note} className="flex gap-3 text-sm leading-6 text-on-surface-variant"><span className="material-symbols-outlined text-primary">info</span>{note}</li>)}</ul>
          <p className="mt-7 border-t border-outline pt-5 text-xs leading-5 text-on-surface-variant">{french ? 'Les exigences frontalieres peuvent changer. Le voyageur doit confirmer les regles officielles en vigueur avant le depart.' : 'Border requirements can change. Travellers remain responsible for confirming current official entry rules before departure.'}</p>
        </section>
      </main>
    </div>
  );
}

