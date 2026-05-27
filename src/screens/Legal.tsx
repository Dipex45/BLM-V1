import React from 'react';
import { motion } from 'framer-motion';

export default function Legal() {
  return (
    <div className="p-8 md:p-12 max-w-4xl mx-auto flex flex-col gap-12 bg-background min-h-screen pt-32">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="space-y-12"
      >
        <section>
          <h1 className="text-5xl font-sans font-bold mb-4">Legal information.</h1>
          <p className="text-on-surface-variant font-semibold text-sm">Version 1.0.2 | Effective May 2026</p>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold border-b border-outline pb-4">Privacy policy</h2>
          <div className="text-sm text-on-surface-variant space-y-4 leading-relaxed font-medium">
            <p>At BLM MOTORS, we respect your privacy and are committed to protecting your personal data. This privacy policy informs you how we look after your personal data when you visit our website.</p>
            <h3 className="font-bold text-on-surface text-sm pt-4">1. Data we collect</h3>
            <p>We collect and process personal information such as your name, email address, and booking history to provide our transport services. We also collect technical data including your IP address and localized currency preferences.</p>
            <h3 className="font-bold text-on-surface text-sm pt-4">2. GDPR compliance</h3>
            <p>If you are located in the EU, you have rights under the General Data Protection Regulation (GDPR) including the right to access, correct, or erase your personal data.</p>
            <h3 className="font-bold text-on-surface text-sm pt-4">3. Data security</h3>
            <p>Your data is encrypted and stored in our secure Firestore clusters. Only authorized staff with "Admin" level clearance can access operational logs.</p>
          </div>
        </section>

        <section className="space-y-6">
          <h2 className="text-2xl font-bold border-b border-outline pb-4">Terms of service</h2>
          <div className="text-sm text-on-surface-variant space-y-4 leading-relaxed font-medium">
            <p>By using BLM MOTORS services, you agree to comply with the following terms regarding logistics and transport.</p>
            <h3 className="font-bold text-on-surface text-sm pt-4">1. Booking and cancellation</h3>
            <p>All bookings are final once confirmed. Cancellations must be made through support at least 12 hours before scheduled departure.</p>
            <h3 className="font-bold text-on-surface text-sm pt-4">2. Liability</h3>
            <p>BLM MOTORS acts as the transport provider. While we work to keep bookings on schedule, we are not responsible for delays caused by road closures, border delays, weather, or other external disruptions.</p>
          </div>
        </section>
      </motion.div>
    </div>
  );
}
