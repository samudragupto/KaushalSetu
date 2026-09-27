// Reference data shared by the seed script, the API and the web app.

export interface DistrictInfo {
  name: string;
  code: string;
  division: string;
  weight: number;
}

// All 36 districts of Maharashtra. `weight` drives the seeded trainee distribution.
export const DISTRICTS: DistrictInfo[] = [
  { name: 'Mumbai City', code: 'MUM', division: 'Konkan', weight: 3 },
  { name: 'Mumbai Suburban', code: 'MSU', division: 'Konkan', weight: 8 },
  { name: 'Thane', code: 'THN', division: 'Konkan', weight: 8 },
  { name: 'Palghar', code: 'PAL', division: 'Konkan', weight: 2 },
  { name: 'Raigad', code: 'RGD', division: 'Konkan', weight: 2.5 },
  { name: 'Ratnagiri', code: 'RTN', division: 'Konkan', weight: 1.5 },
  { name: 'Sindhudurg', code: 'SIN', division: 'Konkan', weight: 1 },
  { name: 'Pune', code: 'PUN', division: 'Pune', weight: 10 },
  { name: 'Satara', code: 'STR', division: 'Pune', weight: 2.5 },
  { name: 'Sangli', code: 'SNG', division: 'Pune', weight: 2 },
  { name: 'Kolhapur', code: 'KOP', division: 'Pune', weight: 3 },
  { name: 'Solapur', code: 'SOL', division: 'Pune', weight: 3 },
  { name: 'Nashik', code: 'NSK', division: 'Nashik', weight: 7 },
  { name: 'Ahilyanagar', code: 'AHL', division: 'Nashik', weight: 3 },
  { name: 'Dhule', code: 'DHL', division: 'Nashik', weight: 1.5 },
  { name: 'Nandurbar', code: 'NDB', division: 'Nashik', weight: 1 },
  { name: 'Jalgaon', code: 'JLG', division: 'Nashik', weight: 3 },
  { name: 'Chhatrapati Sambhajinagar', code: 'CSN', division: 'Chhatrapati Sambhajinagar', weight: 6 },
  { name: 'Jalna', code: 'JAL', division: 'Chhatrapati Sambhajinagar', weight: 1.5 },
  { name: 'Beed', code: 'BED', division: 'Chhatrapati Sambhajinagar', weight: 1.5 },
  { name: 'Dharashiv', code: 'DRS', division: 'Chhatrapati Sambhajinagar', weight: 1 },
  { name: 'Latur', code: 'LAT', division: 'Chhatrapati Sambhajinagar', weight: 2 },
  { name: 'Nanded', code: 'NND', division: 'Chhatrapati Sambhajinagar', weight: 2 },
  { name: 'Parbhani', code: 'PBN', division: 'Chhatrapati Sambhajinagar', weight: 1.2 },
  { name: 'Hingoli', code: 'HNG', division: 'Chhatrapati Sambhajinagar', weight: 0.8 },
  { name: 'Amravati', code: 'AMR', division: 'Amravati', weight: 2.5 },
  { name: 'Akola', code: 'AKL', division: 'Amravati', weight: 1.5 },
  { name: 'Washim', code: 'WSM', division: 'Amravati', weight: 0.8 },
  { name: 'Buldhana', code: 'BLD', division: 'Amravati', weight: 1.2 },
  { name: 'Yavatmal', code: 'YTL', division: 'Amravati', weight: 1.5 },
  { name: 'Nagpur', code: 'NGP', division: 'Nagpur', weight: 7 },
  { name: 'Wardha', code: 'WRD', division: 'Nagpur', weight: 1.2 },
  { name: 'Bhandara', code: 'BHN', division: 'Nagpur', weight: 1 },
  { name: 'Gondia', code: 'GND', division: 'Nagpur', weight: 1 },
  { name: 'Chandrapur', code: 'CHD', division: 'Nagpur', weight: 2 },
  { name: 'Gadchiroli', code: 'GAD', division: 'Nagpur', weight: 0.8 },
];

export const DISTRICT_BY_NAME: Record<string, DistrictInfo> = Object.fromEntries(
  DISTRICTS.map((d) => [d.name, d]),
);

export interface SectorInfo {
  name: string;
  short: string;
  wageMin: number;
  wageMedian: number;
  wageMax: number;
  placementRate: number;
  selfEmploymentShare: number;
}

export const SECTORS: SectorInfo[] = [
  { name: 'Capital Goods & Manufacturing', short: 'Manufacturing', wageMin: 12000, wageMedian: 16500, wageMax: 28000, placementRate: 0.66, selfEmploymentShare: 0.04 },
  { name: 'Electrical & Green Energy', short: 'Electrical', wageMin: 11000, wageMedian: 15500, wageMax: 26000, placementRate: 0.65, selfEmploymentShare: 0.14 },
  { name: 'Automotive', short: 'Automotive', wageMin: 11000, wageMedian: 14500, wageMax: 24000, placementRate: 0.63, selfEmploymentShare: 0.1 },
  { name: 'Retail', short: 'Retail', wageMin: 9000, wageMedian: 11500, wageMax: 17000, placementRate: 0.62, selfEmploymentShare: 0.05 },
  { name: 'IT-ITeS', short: 'IT-ITeS', wageMin: 13000, wageMedian: 21000, wageMax: 42000, placementRate: 0.6, selfEmploymentShare: 0.06 },
  { name: 'Beauty & Wellness', short: 'Beauty', wageMin: 9000, wageMedian: 12000, wageMax: 22000, placementRate: 0.58, selfEmploymentShare: 0.42 },
  { name: 'BFSI', short: 'BFSI', wageMin: 11000, wageMedian: 14000, wageMax: 23000, placementRate: 0.61, selfEmploymentShare: 0.08 },
  { name: 'Tourism & Hospitality', short: 'Hospitality', wageMin: 10000, wageMedian: 13000, wageMax: 21000, placementRate: 0.65, selfEmploymentShare: 0.05 },
];

export const SECTOR_BY_NAME: Record<string, SectorInfo> = Object.fromEntries(SECTORS.map((s) => [s.name, s]));

export interface SkillEntry {
  key: string;
  label: string;
  // Lower-case fragments in English, Marathi and Hindi used by the deterministic extractor.
  synonyms: string[];
}

export const SKILL_TAXONOMY: SkillEntry[] = [
  { key: 'cnc_5axis', label: '5-axis CNC machining', synonyms: ['5-axis', '5 axis', 'five axis', '5axis', '५-अक्ष', '५ अक्ष', '5-अक्ष', 'पाच अक्ष', '5 अ‍ॅक्सिस', '5-अ‍ॅक्सिस', 'फाइव्ह अ‍ॅक्सिस'] },
  { key: 'cam_programming', label: 'CAM programming (Mastercam)', synonyms: ['cam programming', 'mastercam', 'cam software', 'कॅम'] },
  { key: 'gdt', label: 'GD&T drawing reading', synonyms: ['gd&t', 'gdt', 'geometric tolerance', 'ड्रॉइंग वाचन'] },
  { key: 'siemens_control', label: 'Siemens Sinumerik controller', synonyms: ['sinumerik', 'siemens control', 'सीमेन्स'] },
  { key: 'tig_welding', label: 'TIG welding (stainless)', synonyms: ['tig', 'argon welding', 'आर्गन', 'टिग'] },
  { key: 'robotic_welding', label: 'Robotic welding cell operation', synonyms: ['robotic weld', 'robot welding', 'रोबोट'] },
  { key: 'plc', label: 'PLC basics', synonyms: ['plc', 'पीएलसी', 'automation panel'] },
  { key: 'ev_battery', label: 'EV battery diagnostics', synonyms: ['ev battery', 'electric vehicle', 'इलेक्ट्रिक वाहन', 'बॅटरी'] },
  { key: 'solar_hybrid', label: 'Hybrid inverter commissioning', synonyms: ['hybrid inverter', 'on-grid', 'net meter', 'नेट मीटर', 'इन्व्हर्टर'] },
  { key: 'bs6_diagnostics', label: 'BS-VI engine diagnostics (OBD scanner)', synonyms: ['bs6', 'bs-vi', 'obd', 'scanner', 'स्कॅनर'] },
  { key: 'react', label: 'React.js', synonyms: ['react', 'रिएक्ट', 'रिॲक्ट', 'रिअ‍ॅक्ट'] },
  { key: 'typescript', label: 'TypeScript', synonyms: ['typescript', 'टाइपस्क्रिप्ट'] },
  { key: 'git', label: 'Git and code review workflow', synonyms: ['git', 'github', 'गिट'] },
  { key: 'cloud_basics', label: 'Cloud deployment basics', synonyms: ['aws', 'cloud', 'azure', 'क्लाउड'] },
  { key: 'spoken_english', label: 'Spoken English for customer interaction', synonyms: ['english', 'इंग्रजी', 'अंग्रेजी', 'spoken'] },
  { key: 'digital_billing', label: 'POS and digital billing', synonyms: ['pos', 'billing', 'बिलिंग', 'upi'] },
  { key: 'advanced_excel', label: 'Advanced Excel', synonyms: ['excel', 'एक्सेल', 'pivot'] },
  { key: 'gst_returns', label: 'GST return filing (GSTR-1/3B)', synonyms: ['gstr', 'gst return', 'रिटर्न', 'जीएसटी रिटर्न'] },
  { key: 'tally_prime', label: 'Tally Prime with e-invoicing', synonyms: ['tally', 'टॅली', 'टैली', 'e-invoice'] },
  { key: 'bridal_airbrush', label: 'Airbrush and HD bridal makeup', synonyms: ['airbrush', 'hd makeup', 'bridal', 'ब्रायडल', 'एअरब्रश'] },
  { key: 'hair_chemical', label: 'Hair chemical treatments (keratin)', synonyms: ['keratin', 'smoothening', 'केराटिन', 'हेअर ट्रीटमेंट'] },
  { key: 'social_media_marketing', label: 'Instagram and WhatsApp Business marketing', synonyms: ['instagram', 'social media', 'marketing', 'मार्केटिंग', 'इंस्टाग्राम'] },
  { key: 'continental_cuisine', label: 'Continental cuisine', synonyms: ['continental', 'कॉन्टिनेंटल', 'pasta'] },
  { key: 'food_safety', label: 'FSSAI food safety supervision', synonyms: ['fssai', 'food safety', 'हायजीन'] },
  { key: 'pms_software', label: 'Hotel PMS software', synonyms: ['pms', 'opera', 'reservation software'] },
];

export const SKILL_BY_KEY: Record<string, SkillEntry> = Object.fromEntries(SKILL_TAXONOMY.map((s) => [s.key, s]));

export interface CourseInfo {
  code: string;
  name: string;
  nsqfLevel: number;
  sector: string;
  durationHours: number;
  skills: string[];
  gapSkills: string[];
}

export const COURSES: CourseInfo[] = [
  { code: 'CSC/Q0110', name: 'CNC Machine Operator (Turning)', nsqfLevel: 4, sector: 'Capital Goods & Manufacturing', durationHours: 480, skills: ['CNC turning', 'G-code and M-code basics', 'Fanuc 0i controller', 'Vernier and micrometer', 'Tool offset setting'], gapSkills: ['cnc_5axis', 'cam_programming', 'gdt', 'siemens_control'] },
  { code: 'CSC/Q0204', name: 'Welder (Arc and Gas)', nsqfLevel: 3, sector: 'Capital Goods & Manufacturing', durationHours: 390, skills: ['SMAW arc welding', 'Gas cutting', 'Joint preparation', 'Weld inspection'], gapSkills: ['tig_welding', 'robotic_welding', 'gdt'] },
  { code: 'CSC/Q0302', name: 'Fitter Fabrication', nsqfLevel: 4, sector: 'Capital Goods & Manufacturing', durationHours: 420, skills: ['Marking and layout', 'Sheet metal fabrication', 'Drilling and tapping', 'Blueprint reading'], gapSkills: ['gdt', 'robotic_welding', 'plc'] },
  { code: 'CSC/Q0415', name: 'VMC Programmer and Setter', nsqfLevel: 5, sector: 'Capital Goods & Manufacturing', durationHours: 540, skills: ['VMC setting', 'Part programming', 'Fixture setting', 'Quality inspection'], gapSkills: ['cnc_5axis', 'cam_programming', 'siemens_control'] },
  { code: 'PSS/Q0101', name: 'Electrician (Domestic Solutions)', nsqfLevel: 3, sector: 'Electrical & Green Energy', durationHours: 390, skills: ['House wiring', 'MCB and ELCB installation', 'Earthing', 'Load calculation'], gapSkills: ['plc', 'solar_hybrid', 'ev_battery'] },
  { code: 'SGJ/Q0101', name: 'Solar PV Installer (Suryamitra)', nsqfLevel: 4, sector: 'Electrical & Green Energy', durationHours: 600, skills: ['Rooftop structure mounting', 'PV module wiring', 'Off-grid inverter setup', 'Site survey'], gapSkills: ['solar_hybrid', 'plc'] },
  { code: 'PSS/Q2301', name: 'Wireman (Industrial)', nsqfLevel: 3, sector: 'Electrical & Green Energy', durationHours: 360, skills: ['Panel wiring', 'Cable laying', 'Motor connections', 'Safety practices'], gapSkills: ['plc', 'ev_battery'] },
  { code: 'SGJ/Q1402', name: 'EV Charging Station Technician', nsqfLevel: 4, sector: 'Electrical & Green Energy', durationHours: 420, skills: ['AC charger installation', 'Charger fault diagnosis', 'Electrical safety', 'Customer handover'], gapSkills: ['ev_battery', 'plc'] },
  { code: 'ASC/Q1411', name: 'Automotive Service Technician', nsqfLevel: 4, sector: 'Automotive', durationHours: 480, skills: ['Periodic maintenance', 'Brake and clutch service', 'Engine basics', 'Workshop safety'], gapSkills: ['bs6_diagnostics', 'ev_battery'] },
  { code: 'ASC/Q1402', name: 'Two-Wheeler Service Technician', nsqfLevel: 3, sector: 'Automotive', durationHours: 390, skills: ['Carburettor service', 'Chain and sprocket', 'Electrical fault finding', 'Job card handling'], gapSkills: ['bs6_diagnostics', 'ev_battery'] },
  { code: 'ASC/Q1203', name: 'Auto Body Painter', nsqfLevel: 3, sector: 'Automotive', durationHours: 360, skills: ['Surface preparation', 'Spray painting', 'Colour mixing', 'Polishing'], gapSkills: ['bs6_diagnostics'] },
  { code: 'RAS/Q0104', name: 'Retail Sales Associate', nsqfLevel: 4, sector: 'Retail', durationHours: 330, skills: ['Customer greeting', 'Product display', 'Stock counting', 'Cash handling'], gapSkills: ['digital_billing', 'spoken_english'] },
  { code: 'RAS/Q0203', name: 'Store Operations Assistant', nsqfLevel: 3, sector: 'Retail', durationHours: 300, skills: ['Inventory receiving', 'Shelf replenishment', 'Store hygiene', 'Returns processing'], gapSkills: ['digital_billing', 'advanced_excel'] },
  { code: 'LSC/Q2305', name: 'E-commerce Warehouse Associate', nsqfLevel: 3, sector: 'Retail', durationHours: 300, skills: ['Pick and pack', 'Handheld scanner', 'Dispatch documentation', 'Safety in warehouse'], gapSkills: ['advanced_excel', 'spoken_english'] },
  { code: 'SSC/Q0503', name: 'Full-Stack Web Development', nsqfLevel: 5, sector: 'IT-ITeS', durationHours: 600, skills: ['HTML and CSS', 'JavaScript', 'Node.js with Express', 'MySQL', 'REST APIs'], gapSkills: ['react', 'typescript', 'git', 'cloud_basics'] },
  { code: 'SSC/Q2212', name: 'Domestic Data Entry Operator', nsqfLevel: 3, sector: 'IT-ITeS', durationHours: 240, skills: ['Typing speed 35 wpm', 'MS Office basics', 'Data validation', 'Record keeping'], gapSkills: ['advanced_excel', 'spoken_english'] },
  { code: 'SSC/Q2210', name: 'CRM Domestic Voice', nsqfLevel: 4, sector: 'IT-ITeS', durationHours: 300, skills: ['Call handling', 'CRM ticketing', 'Complaint resolution', 'Marathi and Hindi communication'], gapSkills: ['spoken_english', 'advanced_excel'] },
  { code: 'SSC/Q1301', name: 'Junior Software Tester', nsqfLevel: 4, sector: 'IT-ITeS', durationHours: 420, skills: ['Manual testing', 'Test case writing', 'Bug reporting', 'SQL queries'], gapSkills: ['git', 'typescript', 'cloud_basics'] },
  { code: 'BWS/Q0102', name: 'Assistant Beauty Therapist', nsqfLevel: 3, sector: 'Beauty & Wellness', durationHours: 330, skills: ['Facial and clean-up', 'Waxing and threading', 'Manicure and pedicure', 'Salon hygiene'], gapSkills: ['bridal_airbrush', 'social_media_marketing'] },
  { code: 'BWS/Q0201', name: 'Assistant Hair Stylist', nsqfLevel: 3, sector: 'Beauty & Wellness', durationHours: 330, skills: ['Hair cutting basics', 'Blow drying', 'Hair colouring', 'Client consultation'], gapSkills: ['hair_chemical', 'social_media_marketing'] },
  { code: 'BWS/Q0301', name: 'Bridal and Party Makeup Artist', nsqfLevel: 4, sector: 'Beauty & Wellness', durationHours: 390, skills: ['Party makeup', 'Saree draping', 'Hair styling for events', 'Kit management'], gapSkills: ['bridal_airbrush', 'social_media_marketing'] },
  { code: 'BSC/Q8101', name: 'GST Accounts Assistant', nsqfLevel: 4, sector: 'BFSI', durationHours: 300, skills: ['GST registration basics', 'Invoice preparation', 'Ledger entries', 'Input tax credit basics'], gapSkills: ['gst_returns', 'tally_prime', 'advanced_excel'] },
  { code: 'BSC/Q0702', name: 'Tally Accounts Executive', nsqfLevel: 4, sector: 'BFSI', durationHours: 300, skills: ['Tally ERP voucher entry', 'Bank reconciliation', 'Payroll basics', 'TDS basics'], gapSkills: ['tally_prime', 'gst_returns', 'advanced_excel'] },
  { code: 'BSC/Q7301', name: 'Microfinance Field Executive', nsqfLevel: 4, sector: 'BFSI', durationHours: 270, skills: ['JLG formation', 'KYC documentation', 'Loan collection', 'Financial literacy sessions'], gapSkills: ['advanced_excel', 'spoken_english'] },
  { code: 'THC/Q0301', name: 'F&B Service Steward', nsqfLevel: 4, sector: 'Tourism & Hospitality', durationHours: 360, skills: ['Table laying', 'Order taking', 'Beverage service', 'Guest handling'], gapSkills: ['spoken_english', 'food_safety'] },
  { code: 'THC/Q3002', name: 'Commis Chef', nsqfLevel: 4, sector: 'Tourism & Hospitality', durationHours: 450, skills: ['Indian gravies', 'Knife skills', 'Kitchen hygiene', 'Mise en place'], gapSkills: ['continental_cuisine', 'food_safety'] },
  { code: 'THC/Q0102', name: 'Front Office Associate', nsqfLevel: 4, sector: 'Tourism & Hospitality', durationHours: 360, skills: ['Check-in and check-out', 'Reservation handling', 'Guest relations', 'Telephone etiquette'], gapSkills: ['pms_software', 'spoken_english'] },
  { code: 'THC/Q0202', name: 'Housekeeping Attendant', nsqfLevel: 3, sector: 'Tourism & Hospitality', durationHours: 300, skills: ['Room make-up', 'Linen handling', 'Public area cleaning', 'Chemical safety'], gapSkills: ['spoken_english', 'food_safety'] },
];

export const COURSE_BY_CODE: Record<string, CourseInfo> = Object.fromEntries(COURSES.map((c) => [c.code, c]));

export interface BridgeCourse {
  skillKey: string;
  title: string;
  hours: number;
  mode: string;
  nsqfLevel: number;
}

export const BRIDGE_COURSES: BridgeCourse[] = [
  { skillKey: 'cnc_5axis', title: 'Advanced 5-Axis CNC Machining (Bridge)', hours: 120, mode: 'Weekend batches at Govt ITI Nashik and Tool Room Aurangabad', nsqfLevel: 5 },
  { skillKey: 'cam_programming', title: 'CAM Programming with Mastercam', hours: 90, mode: 'Blended, 6 weekends', nsqfLevel: 5 },
  { skillKey: 'gdt', title: 'GD&T for Shop-floor Technicians', hours: 40, mode: 'Evening batch, 3 weeks', nsqfLevel: 4 },
  { skillKey: 'siemens_control', title: 'Siemens Sinumerik Operations', hours: 60, mode: 'OEM-partnered lab, Chakan', nsqfLevel: 5 },
  { skillKey: 'tig_welding', title: 'TIG Welding for Stainless Steel', hours: 80, mode: 'Practical lab, 4 weeks', nsqfLevel: 4 },
  { skillKey: 'robotic_welding', title: 'Robotic Welding Cell Operator', hours: 100, mode: 'Industry lab, Chakan and Waluj', nsqfLevel: 5 },
  { skillKey: 'plc', title: 'PLC and Industrial Automation Basics', hours: 90, mode: 'Govt ITI evening batch', nsqfLevel: 4 },
  { skillKey: 'ev_battery', title: 'EV Battery Diagnostics and Safety', hours: 80, mode: 'Blended with OEM workshop', nsqfLevel: 4 },
  { skillKey: 'solar_hybrid', title: 'Hybrid and On-grid Solar Commissioning', hours: 60, mode: 'Field-based, 3 weeks', nsqfLevel: 5 },
  { skillKey: 'bs6_diagnostics', title: 'BS-VI Diagnostics with OBD Scanners', hours: 60, mode: 'Dealer workshop partnership', nsqfLevel: 4 },
  { skillKey: 'react', title: 'React.js for Web Developers', hours: 80, mode: 'Online with weekend labs', nsqfLevel: 5 },
  { skillKey: 'typescript', title: 'TypeScript Fundamentals', hours: 40, mode: 'Online, self-paced with mentor calls', nsqfLevel: 5 },
  { skillKey: 'git', title: 'Git and Team Workflows', hours: 24, mode: 'Online, 2 weeks', nsqfLevel: 4 },
  { skillKey: 'cloud_basics', title: 'Cloud Deployment Basics', hours: 40, mode: 'Online with sandbox credits', nsqfLevel: 5 },
  { skillKey: 'spoken_english', title: 'Workplace Spoken English', hours: 60, mode: 'Evening batch at nearest PMKK', nsqfLevel: 3 },
  { skillKey: 'digital_billing', title: 'POS and UPI Billing Operations', hours: 24, mode: 'Weekend batch', nsqfLevel: 3 },
  { skillKey: 'advanced_excel', title: 'Advanced Excel for Operations', hours: 36, mode: 'Online with practice sheets', nsqfLevel: 4 },
  { skillKey: 'gst_returns', title: 'GST Return Filing Practice Lab', hours: 45, mode: 'Blended, with live GSTN sandbox', nsqfLevel: 4 },
  { skillKey: 'tally_prime', title: 'Tally Prime with e-Invoicing', hours: 45, mode: 'Classroom, 4 weeks', nsqfLevel: 4 },
  { skillKey: 'bridal_airbrush', title: 'Airbrush and HD Bridal Makeup', hours: 60, mode: 'Studio practice, 5 weekends', nsqfLevel: 4 },
  { skillKey: 'hair_chemical', title: 'Hair Chemical Treatments', hours: 45, mode: 'Salon partnership', nsqfLevel: 4 },
  { skillKey: 'social_media_marketing', title: 'Digital Marketing for Micro-entrepreneurs', hours: 30, mode: 'Online, Marathi medium', nsqfLevel: 3 },
  { skillKey: 'continental_cuisine', title: 'Continental Cuisine Basics', hours: 90, mode: 'Hotel kitchen attachment', nsqfLevel: 4 },
  { skillKey: 'food_safety', title: 'FSSAI Food Safety Supervisor', hours: 24, mode: 'Classroom with certification', nsqfLevel: 4 },
  { skillKey: 'pms_software', title: 'Hotel PMS Operations', hours: 30, mode: 'Hotel school lab', nsqfLevel: 4 },
];

export const ATTRITION_REASON_LABELS: Record<string, string> = {
  LOW_WAGE: 'Low wage',
  RELOCATION: 'Relocation',
  WORKING_CONDITIONS: 'Working conditions',
  SKILL_MISMATCH: 'Skill mismatch',
  FAMILY: 'Family responsibilities',
  HEALTH: 'Health',
  OTHER: 'Other',
};

export const MILESTONE_DAYS: Record<string, number> = {
  MONTH_3: 90,
  MONTH_6: 180,
  MONTH_12: 365,
  MONTH_24: 730,
};

export const MILESTONE_LABELS: Record<string, string> = {
  MONTH_3: 'Month 3',
  MONTH_6: 'Month 6',
  MONTH_12: 'Month 12',
  MONTH_24: 'Month 24',
};

export const MILESTONES = ['MONTH_3', 'MONTH_6', 'MONTH_12', 'MONTH_24'] as const;

export const SOCIAL_CATEGORY_LABELS: Record<string, string> = {
  SC: 'SC',
  ST: 'ST',
  OBC: 'OBC',
  OPEN: 'Open',
  EWS: 'EWS',
};

export const AGE_BANDS = ['18-21', '22-25', '26-30', '31+'] as const;
