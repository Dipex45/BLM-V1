import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';

type Language = 'en' | 'fr';

const translations = {
  en: {
    services: 'Services', track: 'Track booking', reviews: 'Reviews', book: 'Book', login: 'Log in', createAccount: 'Create account',
    chooseService: 'Choose a service', serviceHeading: 'Select your service to view options and pricing.',
    serviceBody: 'Every service includes a clear price breakdown, route options, and secure payment checkout.',
    trackingTitle: 'Track your BLM booking or shipment', trackingBody: 'Enter your tracking ID or booking reference to view verified transit milestones and dispatch progress.',
    trackingAction: 'Track movement', paymentChannels: 'Payment channels', selectPayment: 'Select payment method', checkout: 'Secure checkout',
  },
  fr: {
    services: 'Services', track: 'Suivre une reservation', reviews: 'Avis', book: 'Reserver', login: 'Connexion', createAccount: 'Creer un compte',
    chooseService: 'Choisissez un service', serviceHeading: 'Selectionnez un service pour consulter les options et les tarifs.',
    serviceBody: 'Chaque service comprend un detail transparent du prix, des options de trajet et un paiement securise.',
    trackingTitle: 'Suivez votre reservation ou votre envoi BLM', trackingBody: 'Saisissez votre identifiant de suivi ou votre reference de reservation pour consulter les etapes verifiees du trajet.',
    trackingAction: 'Suivre le trajet', paymentChannels: 'Moyens de paiement', selectPayment: 'Choisissez un moyen de paiement', checkout: 'Paiement securise',
  },
} as const;

type TranslationKey = keyof typeof translations.en;
type LocaleContextValue = { language: Language; setLanguage: (language: Language) => void; t: (key: TranslationKey) => string };
const LocaleContext = createContext<LocaleContextValue>({ language: 'en', setLanguage: () => undefined, t: (key) => translations.en[key] });

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => localStorage.getItem('blm_language') === 'fr' ? 'fr' : 'en');
  useEffect(() => {
    localStorage.setItem('blm_language', language);
    document.documentElement.lang = language;
  }, [language]);
  const value = useMemo(() => ({ language, setLanguage, t: (key: TranslationKey) => translations[language][key] }), [language]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export const useLocale = () => useContext(LocaleContext);

