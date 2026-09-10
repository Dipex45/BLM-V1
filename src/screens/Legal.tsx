import { motion } from 'framer-motion';
import { company } from '../lib/company';

const privacySections = [
  {
    title: 'Information we collect',
    body: 'We collect identity and contact details, booking and route information, package declarations, payment references, support conversations, review content, device and login security data, and driver location data while an assigned trip is active.',
  },
  {
    title: 'Why we process it',
    body: 'We process data to perform a transport or logistics contract, collect payment, protect passengers and property, meet legal obligations, prevent fraud, provide support, and improve service reliability. Where consent is the lawful basis, you may withdraw it at any time.',
  },
  {
    title: 'Who receives it',
    body: 'Relevant details may be shared with assigned drivers, payment processors, identity and fraud-prevention providers, email or messaging providers, hosting providers, professional advisers, regulators, border authorities, or law enforcement where legally required. Providers receive only the information needed for their role.',
  },
  {
    title: 'Retention and security',
    body: 'We retain records only for operational, accounting, dispute, fraud-prevention, and legal periods that apply to each record type. Access is role restricted, sensitive actions are audited, and payment card details are handled by the selected payment processor rather than stored by BLM Motors.',
  },
  {
    title: 'Your data rights',
    body: 'Subject to applicable law, you may request access, correction, deletion, restriction, portability, or objection; withdraw consent; request human review of an automated decision; and lodge a complaint with the Nigeria Data Protection Commission. We may verify your identity before completing a request.',
  },
  {
    title: 'Cookies and device storage',
    body: 'Strictly necessary storage keeps authentication, security, language, currency, and booking functions working. Optional analytics or replay technology must remain disabled until you consent through the cookie controls.',
  },
  {
    title: 'Cross-border processing',
    body: 'A cross-border trip or an international technology provider may require information to be processed outside Nigeria. We use contractual, legal, and security safeguards appropriate to the transfer and the service requested.',
  },
];

const termsSections = [
  {
    title: 'Quotes, bookings, and payment',
    body: 'A booking is confirmed only after the platform records successful payment or an authorised finance administrator approves a bank transfer. Prices are calculated from the selected service, route, distance, vehicle, timing, package weight, tour package, and applicable fees shown before payment.',
  },
  {
    title: 'Cancellations and refunds',
    body: 'Cancellation eligibility and any refund depend on the booking status, time remaining before departure, non-refundable third-party costs, and the service selected. Approved refunds return through the original payment method where supported. Bank-transfer refunds require account verification.',
  },
  {
    title: 'Passenger and package obligations',
    body: 'Customers must provide accurate passenger, route, identity, and package information. BLM Motors does not carry illegal, prohibited, dangerous, or falsely declared materials and may inspect, reject, report, or stop a shipment when safety or law requires it.',
  },
  {
    title: 'Car hire',
    body: 'The named hirer must accept the vehicle condition record, authorised-driver rules, usage restrictions, and caution-deposit terms before collection. Verified damage, traffic penalties, missing items, excess cleaning, or unauthorised use may be deducted from the deposit, with supporting records.',
  },
  {
    title: 'Touring and cross-border travel',
    body: 'Customers are responsible for valid passports, visas, permits, health documentation, and border requirements unless a written package expressly includes assistance. Border queues, road closures, weather, security restrictions, and government action can change a route or arrival time.',
  },
  {
    title: 'Service interruptions and liability',
    body: 'We take reasonable steps to provide safe, timely service and will communicate material changes. Nothing in these terms excludes liability that cannot legally be excluded. Claims should include the booking reference and supporting evidence so they can be investigated promptly.',
  },
];

export default function Legal() {
  return (
    <main className="min-h-screen bg-background px-4 pb-20 pt-28 sm:px-6 md:px-8">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        className="mx-auto max-w-4xl"
      >
        <header className="border-b border-outline pb-8">
          <p className="mb-3 text-xs font-bold uppercase tracking-widest text-primary">Policies and customer terms</p>
          <h1 className="text-3xl font-black leading-tight text-on-surface sm:text-4xl md:text-5xl">Legal information</h1>
          <p className="mt-3 text-sm font-semibold text-on-surface-variant">Version 2.0 | Effective 8 September 2026</p>
        </header>

        <section className="py-10" id="privacy">
          <h2 className="text-2xl font-bold text-on-surface">Privacy notice</h2>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            {company.legalName} processes personal data under the Nigeria Data Protection Act 2023, the Nigeria Data Protection Regulation where applicable, and other relevant Nigerian laws. This notice explains our current website and transport operations.
          </p>
          <div className="mt-8 grid gap-7">
            {privacySections.map((section, index) => (
              <article key={section.title} className="border-t border-outline pt-6">
                <h3 className="text-base font-bold text-on-surface">{index + 1}. {section.title}</h3>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
              </article>
            ))}
          </div>
          <div className="mt-8 rounded-lg border border-outline bg-surface-container p-5 text-sm leading-6 text-on-surface-variant">
            Send privacy and data-rights requests to <a className="font-bold text-primary underline" href={`mailto:${company.email}`}>{company.email}</a>. You may also contact the <a className="font-bold text-primary underline" href="https://ndpc.gov.ng/" target="_blank" rel="noreferrer">Nigeria Data Protection Commission</a>.
          </div>
        </section>

        <section className="border-t border-outline py-10" id="terms">
          <h2 className="text-2xl font-bold text-on-surface">Terms of service</h2>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            By placing an order, you confirm that the booking details are accurate and that you have authority to book for every passenger, package, or vehicle user included in the request.
          </p>
          <div className="mt-8 grid gap-7">
            {termsSections.map((section, index) => (
              <article key={section.title} className="border-t border-outline pt-6">
                <h3 className="text-base font-bold text-on-surface">{index + 1}. {section.title}</h3>
                <p className="mt-2 text-sm leading-7 text-on-surface-variant">{section.body}</p>
              </article>
            ))}
          </div>
        </section>

        <section className="border-t border-outline pt-10">
          <h2 className="text-2xl font-bold text-on-surface">Contact and complaints</h2>
          <p className="mt-4 text-sm leading-7 text-on-surface-variant">
            Contact the operations desk by email at <a className="font-bold text-primary underline" href={`mailto:${company.email}`}>{company.email}</a> or call <a className="font-bold text-primary underline" href={`tel:${company.phone}`}>{company.phoneDisplay}</a>. Include your booking or payment reference when the matter concerns an existing order.
          </p>
        </section>
      </motion.div>
    </main>
  );
}
