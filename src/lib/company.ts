export const company = {
  name: 'BLM Motors',
  legalName: 'BLM Motors',
  tagline: "It's not just a ride, it's an adventure.",
  homeBase: 'Nigeria',
  summary:
    'Reliable 24/7 transport, car hire, touring, pickup, interstate movement, and cross-border trips from Nigeria to Benin Republic, Togo, and Ghana.',
  email: 'bookings@blmmotors.ng',
  phone: '+2349064090276',
  phoneDisplay: '+234 906 409 0276',
  beninPhone: '+2290142439626',
  beninPhoneDisplay: '+229 01 42 43 96 26',
  whatsapp: '+2349064090276',
  whatsappDisplay: '+234 906 409 0276',
  address: 'Nigeria operations desk',
  logo: '/brand/blm-logo.png',
  heroImage: '/brand/transport-service.png',
  servicesImage: '/brand/weekend-services.jpeg',
  qualities: ['Fast', 'Secure', 'Reliable'],
  routes: [
    'Within Nigeria',
    'Benin Republic to Nigeria',
    'Nigeria to Benin Republic',
    'Ghana to Togo',
    'Togo to Benin Republic',
    'Interstate movement',
  ],
  services: [
    {
      icon: 'schedule',
      title: '24/7 transport services',
      desc: 'Round-the-clock private and business transport with booking records, payment tracking, and dispatch updates.',
    },
    {
      icon: 'route',
      title: 'Cross-border trips',
      desc: 'Nigeria, Benin Republic, Togo, and Ghana routes for planned passenger movement and logistics support.',
    },
    {
      icon: 'explore',
      title: 'Touring',
      desc: 'Tour plans, airport pickup, city movement, and guided multi-stop travel for visitors and groups.',
    },
    {
      icon: 'local_taxi',
      title: 'Car hire',
      desc: 'Short-term and scheduled car hire for errands, executive movement, events, and family travel.',
    },
    {
      icon: 'inventory_2',
      title: 'Pickup and logistics',
      desc: 'Document, parcel, retail, and business pickup with traceable booking and delivery status.',
    },
    {
      icon: 'moving',
      title: 'Long and short distance trips',
      desc: 'Flexible local, interstate, and regional trips with the right vehicle class for the route.',
    },
  ],
  hubs: [
    { name: 'Lagos', address: 'Lagos, Nigeria' },
    { name: 'Abuja', address: 'Abuja, Nigeria' },
    { name: 'Port Harcourt', address: 'Port Harcourt, Nigeria' },
    { name: 'Cotonou', address: 'Cotonou, Benin Republic' },
    { name: 'Lome', address: 'Lome, Togo' },
    { name: 'Accra', address: 'Accra, Ghana' },
  ],
};

export const defaultVehicles = [
  { title: 'City Ride', desc: 'Pickup, errands, short trips, and city movement.', price: 25000, icon: 'directions_car' },
  { title: 'Interstate SUV', desc: 'Comfortable long-distance and interstate travel.', price: 85000, icon: 'airport_shuttle' },
  { title: 'Touring Van', desc: 'Group touring, airport pickup, and multi-stop movement.', price: 120000, icon: 'travel_explore' },
  { title: 'Logistics Van', desc: 'Parcel, retail, and business pickup support.', price: 65000, icon: 'local_shipping' },
  { title: 'Cross-Border Trip', desc: 'Nigeria, Benin Republic, Togo, and Ghana routes.', price: 180000, icon: 'route' },
  { title: 'Car Hire', desc: 'Scheduled private hire for events, meetings, and family movement.', price: 70000, icon: 'car_rental' },
];
