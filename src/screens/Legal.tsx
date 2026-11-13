import { company } from '../lib/company';
import { Reveal } from '../components/ui/motion';

const privacySections = [
  {
    title: 'What we collect',
    body: 'Your name and contact details, your bookings and routes, what is inside packages you send, payment references, messages to our support team, reviews you post, basic sign-in and device details for security, and your driver’s location while your trip is in progress.',
  },
  {
    title: 'Why we use it',
    body: 'To carry out your trip or delivery, take payment, keep passengers and goods safe, follow the law, stop fraud, help you when you contact us, and improve our service. Where we rely on your permission, you can withdraw it at any time.',
  },
  {
    title: 'Who we share it with',
    body: 'Only the people and companies who need it to serve you: your assigned driver, payment companies, fraud-checking services, email and SMS providers, our hosting provider, our professional advisers, and — when the law requires it — regulators, border officials or the police. Each one gets only what they need.',
  },
  {
    title: 'How long we keep it and how we protect it',
    body: 'We keep records only as long as we need them for running the service, accounting, disputes, fraud checks and legal requirements. Only authorised staff can see your information, important actions are logged, and your card details are handled by the payment company — BLM Motors never stores them.',
  },
  {
    title: 'Your rights',
    body: 'You can ask to see, correct or delete your information, limit how we use it, get a copy of it, or object to how we use it. You can also withdraw your permission, ask for a person to review any automatic decision, and complain to the Nigeria Data Protection Commission. We may confirm your identity first.',
  },
  {
    title: 'Cookies and storage on your device',
    body: 'We only store what the site needs to work: keeping you signed in, security, your language, your currency and your bookings. We do not use advertising cookies, and any optional tracking stays off unless you agree to it.',
  },
  {
    title: 'Information sent outside Nigeria',
    body: 'Cross-border trips and some of our technology providers may need your information to be handled outside Nigeria. When that happens, we use agreements and security measures to protect it.',
  },
];

const termsSections = [
  {
    title: 'Prices, bookings and payment',
    body: 'Your booking is confirmed once your payment goes through, or once our finance team confirms your bank transfer. The price is worked out from the service, route, distance, vehicle, date and time, package weight or tour package you choose, and every charge is shown before you pay.',
  },
  {
    title: 'Cancelling and refunds',
    body: 'Whether you can cancel, and how much is refunded, depends on the booking’s progress, how close it is to departure, any costs we have already paid to others, and the service. Refunds go back to the way you paid where possible. Bank transfer refunds need your account details confirmed first.',
  },
  {
    title: 'Passengers and packages',
    body: 'Please give us correct details about passengers, routes, identity and packages. We do not carry anything illegal, dangerous, banned or wrongly described, and we may check, refuse, report or stop a package if safety or the law requires it.',
  },
  {
    title: 'Car hire',
    body: 'Before collecting the car, the person hiring it must agree to the vehicle condition report, who may drive it, how it can be used, and the refundable deposit. We may take the cost of proven damage, traffic fines, missing items, heavy cleaning or misuse from the deposit, and we will show you the evidence.',
  },
  {
    title: 'Tours and cross-border travel',
    body: 'You are responsible for having valid passports, visas, permits and health documents, unless your package says in writing that we will help. Border queues, closed roads, weather, security issues and government decisions can change a route or arrival time.',
  },
  {
    title: 'Delays and our responsibility',
    body: 'We do our best to give you a safe, on-time service and will tell you about any important changes. Nothing here removes rights you have by law. If you need to make a claim, include your booking reference and any evidence so we can look into it quickly.',
  },
];

export default function Legal() {
  return (
    <main className="container-page max-w-4xl py-14">
      <Reveal>
        <header className="border-b border-outline pb-8">
          <p className="eyebrow">Policies</p>
          <h1 className="mt-3 text-4xl font-extrabold sm:text-5xl">Privacy and terms</h1>
          <p className="mt-3 text-sm text-on-surface-variant">Version 2.1 · Effective 8 September 2026</p>
        </header>
      </Reveal>

      <section className="py-10" id="privacy">
        <h2 className="text-2xl font-bold">Privacy notice</h2>
        <p className="mt-4 text-sm leading-7 text-on-surface-variant">
          This explains how {company.legalName} handles your personal information, in line with the Nigeria Data Protection Act 2023 and other Nigerian laws.
        </p>
        <div className="mt-8 grid gap-7">
          {privacySections.map((section, index) => (
            <article key={section.title} className="border-t border-outline pt-6">
              <h3 className="font-bold">{index + 1}. {section.title}</h3>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
            </article>
          ))}
        </div>
        <div className="mt-8 rounded-2xl bg-surface-container p-5 text-sm leading-6 text-on-surface-variant">
          For any privacy request, email <a className="font-bold text-primary underline" href={`mailto:${company.email}`}>{company.email}</a>. You can also contact the <a className="font-bold text-primary underline" href="https://ndpc.gov.ng/" target="_blank" rel="noreferrer">Nigeria Data Protection Commission</a>.
        </div>
      </section>

      <section className="border-t border-outline py-10" id="terms">
        <h2 className="text-2xl font-bold">Terms of service</h2>
        <p className="mt-4 text-sm leading-7 text-on-surface-variant">
          By booking, you confirm that your details are correct and that you are allowed to book for everyone and everything included.
        </p>
        <div className="mt-8 grid gap-7">
          {termsSections.map((section, index) => (
            <article key={section.title} className="border-t border-outline pt-6">
              <h3 className="font-bold">{index + 1}. {section.title}</h3>
              <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="border-t border-outline pt-10">
        <h2 className="text-2xl font-bold">Questions and complaints</h2>
        <p className="mt-4 text-sm leading-7 text-on-surface-variant">
          Email <a className="font-bold text-primary underline" href={`mailto:${company.email}`}>{company.email}</a> or call <a className="font-bold text-primary underline" href={`tel:${company.phone}`}>{company.phoneDisplay}</a>. If it’s about a booking, please include your booking or payment reference.
        </p>
      </section>
    </main>
  );
}
