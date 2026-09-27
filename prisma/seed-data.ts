// Static pools used by the deterministic seed. All organisations and people are fictional.

export const MALE_NAMES = [
  'Ramesh', 'Suresh', 'Ganesh', 'Mahesh', 'Rahul', 'Amol', 'Sachin', 'Nitin', 'Prashant', 'Akash',
  'Vishal', 'Sagar', 'Swapnil', 'Pravin', 'Sandip', 'Tushar', 'Omkar', 'Aniket', 'Rohit', 'Sunil',
  'Vijay', 'Santosh', 'Yogesh', 'Kiran', 'Nilesh', 'Dnyaneshwar', 'Shubham', 'Pratik', 'Harshal', 'Vaibhav',
  'Ajinkya', 'Tejas', 'Mangesh', 'Vikas', 'Anil', 'Dattatray', 'Balaji', 'Ravindra', 'Siddharth', 'Rushikesh',
  'Imran', 'Sameer', 'Kunal', 'Nikhil', 'Umesh', 'Hemant', 'Gajanan', 'Laxman', 'Bhushan', 'Chetan',
  'Abhijit', 'Sanket', 'Saurabh', 'Mayur', 'Ashish', 'Vinod', 'Arjun', 'Pandurang', 'Salim', 'Akshay',
];

export const FEMALE_NAMES = [
  'Sneha', 'Pooja', 'Priya', 'Kavita', 'Swati', 'Rohini', 'Ashwini', 'Pallavi', 'Snehal', 'Komal',
  'Manisha', 'Jyoti', 'Rupali', 'Sonali', 'Dipali', 'Madhuri', 'Shital', 'Priyanka', 'Aarti', 'Vaishali',
  'Pranali', 'Rutuja', 'Shraddha', 'Gauri', 'Neha', 'Anjali', 'Sayali', 'Mrunal', 'Trupti', 'Rekha',
  'Sujata', 'Kajal', 'Nikita', 'Apurva', 'Tejaswini', 'Bhagyashree', 'Shabana', 'Ruksar', 'Archana', 'Varsha',
  'Supriya', 'Minal', 'Harshada', 'Seema', 'Yogita', 'Monika', 'Dhanashree', 'Namrata', 'Ujwala', 'Savita',
];

export const SURNAMES = [
  'Patil', 'Pawar', 'Jadhav', 'Shinde', 'Deshmukh', 'More', 'Kale', 'Gaikwad', 'Kamble', 'Bhosale',
  'Chavan', 'Kulkarni', 'Joshi', 'Deshpande', 'Salunkhe', 'Mane', 'Shelke', 'Wagh', 'Sonawane', 'Thorat',
  'Mhatre', 'Naik', 'Sawant', 'Kadam', 'Nikam', 'Ghule', 'Bhoir', 'Dhole', 'Waghmare', 'Khandare',
  'Borse', 'Mahajan', 'Chaudhari', 'Wankhede', 'Raut', 'Thakare', 'Bansode', 'Gawande', 'Lokhande', 'Shaikh',
  'Pathan', 'Ingle', 'Tayde', 'Hiwale', 'Dongre', 'Meshram', 'Uike', 'Atram', 'Kumbhar', 'Suryawanshi',
];

export interface ProviderSeed {
  name: string;
  type: 'ITI' | 'PMKK' | 'PRIVATE' | 'POLYTECHNIC';
  district: string;
  courses: string[];
  quality: number;
}

const ITI = ['CSC/Q0110', 'CSC/Q0204', 'CSC/Q0302', 'PSS/Q0101', 'PSS/Q2301', 'ASC/Q1411', 'ASC/Q1402', 'SGJ/Q0101'];
const PMKK = ['RAS/Q0104', 'RAS/Q0203', 'LSC/Q2305', 'SSC/Q2212', 'SSC/Q2210', 'BWS/Q0102', 'BWS/Q0201', 'BSC/Q8101', 'THC/Q0301', 'THC/Q0202', 'SGJ/Q0101'];
const POLY = ['SSC/Q0503', 'SSC/Q1301', 'SGJ/Q1402', 'CSC/Q0415', 'SGJ/Q0101', 'BSC/Q0702'];

export const PROVIDERS: ProviderSeed[] = [
  { name: 'Kohinoor Technical Institute, Pune', type: 'PRIVATE', district: 'Pune', courses: ['SSC/Q0503', 'SSC/Q1301', 'SSC/Q2210', 'BSC/Q8101', 'BSC/Q0702'], quality: 1.05 },
  { name: 'L&T Skills Academy, Chakan', type: 'PRIVATE', district: 'Pune', courses: ['CSC/Q0110', 'CSC/Q0415', 'CSC/Q0204', 'CSC/Q0302'], quality: 1.12 },
  { name: 'Government ITI Aundh, Pune', type: 'ITI', district: 'Pune', courses: ITI, quality: 1.02 },
  { name: 'PMKK Hadapsar, Pune', type: 'PMKK', district: 'Pune', courses: [...PMKK, 'BWS/Q0301'], quality: 0.98 },
  { name: 'Bharati Polytechnic Skills Wing, Pune', type: 'POLYTECHNIC', district: 'Pune', courses: POLY, quality: 1.0 },
  { name: 'Government ITI Borivali', type: 'ITI', district: 'Mumbai Suburban', courses: ITI, quality: 0.97 },
  { name: 'PMKK Kurla', type: 'PMKK', district: 'Mumbai Suburban', courses: PMKK, quality: 0.95 },
  { name: 'Western Skills Academy, Andheri', type: 'PRIVATE', district: 'Mumbai Suburban', courses: ['RAS/Q0104', 'THC/Q0301', 'THC/Q0102', 'BWS/Q0102', 'BWS/Q0301', 'SSC/Q2210'], quality: 1.0 },
  { name: 'Mumbai Skills Centre, Parel', type: 'PRIVATE', district: 'Mumbai City', courses: ['SSC/Q2210', 'RAS/Q0104', 'THC/Q0301', 'THC/Q3002', 'BWS/Q0201'], quality: 0.99 },
  { name: 'Government ITI Thane', type: 'ITI', district: 'Thane', courses: ITI, quality: 0.98 },
  { name: 'PMKK Kalyan', type: 'PMKK', district: 'Thane', courses: PMKK, quality: 0.94 },
  { name: 'Konkan Hospitality Institute, Thane', type: 'PRIVATE', district: 'Thane', courses: ['THC/Q0301', 'THC/Q3002', 'THC/Q0102', 'THC/Q0202'], quality: 1.03 },
  { name: 'Government ITI Palghar', type: 'ITI', district: 'Palghar', courses: ITI, quality: 0.92 },
  { name: 'Government ITI Panvel', type: 'ITI', district: 'Raigad', courses: ITI, quality: 0.96 },
  { name: 'Government ITI Ratnagiri', type: 'ITI', district: 'Ratnagiri', courses: [...ITI, 'THC/Q3002'], quality: 0.93 },
  { name: 'Government ITI Nashik', type: 'ITI', district: 'Nashik', courses: ITI, quality: 1.0 },
  { name: 'PMKK Nashik Road', type: 'PMKK', district: 'Nashik', courses: PMKK, quality: 0.96 },
  { name: 'Godavari Tool Room Training Centre, Satpur', type: 'PRIVATE', district: 'Nashik', courses: ['CSC/Q0110', 'CSC/Q0415', 'CSC/Q0302'], quality: 1.02 },
  { name: 'K.K. Polytechnic Skills Wing, Nashik', type: 'POLYTECHNIC', district: 'Nashik', courses: POLY, quality: 1.0 },
  { name: 'Government ITI Ahilyanagar', type: 'ITI', district: 'Ahilyanagar', courses: ITI, quality: 0.95 },
  { name: 'Sai Vocational Institute, Jalgaon', type: 'PRIVATE', district: 'Jalgaon', courses: ['RAS/Q0104', 'SSC/Q2212', 'PSS/Q0101', 'CSC/Q0204', 'SSC/Q2210'], quality: 1.0 },
  { name: 'Government ITI Jalgaon', type: 'ITI', district: 'Jalgaon', courses: ITI, quality: 0.95 },
  { name: 'PMKK Dhule', type: 'PMKK', district: 'Dhule', courses: PMKK, quality: 0.9 },
  { name: 'Government ITI Chhatrapati Sambhajinagar', type: 'ITI', district: 'Chhatrapati Sambhajinagar', courses: ITI, quality: 1.0 },
  { name: 'Waluj Industrial Skills Centre', type: 'PRIVATE', district: 'Chhatrapati Sambhajinagar', courses: ['CSC/Q0110', 'CSC/Q0204', 'SGJ/Q1402', 'ASC/Q1411', 'ASC/Q1203'], quality: 1.05 },
  { name: 'Deogiri Polytechnic Skills Wing', type: 'POLYTECHNIC', district: 'Chhatrapati Sambhajinagar', courses: POLY, quality: 0.98 },
  { name: 'PMKK Jalna', type: 'PMKK', district: 'Jalna', courses: PMKK, quality: 0.9 },
  { name: 'Government ITI Beed', type: 'ITI', district: 'Beed', courses: ITI, quality: 0.9 },
  { name: 'Rajarshi Shahu Skill Centre, Latur', type: 'PRIVATE', district: 'Latur', courses: ['BSC/Q8101', 'BSC/Q0702', 'BSC/Q7301', 'BWS/Q0102', 'SSC/Q2212'], quality: 1.0 },
  { name: 'Government ITI Nanded', type: 'ITI', district: 'Nanded', courses: ITI, quality: 0.93 },
  { name: 'PMKK Parbhani', type: 'PMKK', district: 'Parbhani', courses: PMKK, quality: 0.9 },
  { name: 'Government ITI Kolhapur', type: 'ITI', district: 'Kolhapur', courses: ITI, quality: 1.0 },
  { name: 'Panchganga Skills Institute, Ichalkaranji', type: 'PRIVATE', district: 'Kolhapur', courses: ['CSC/Q0204', 'CSC/Q0302', 'PSS/Q0101', 'PSS/Q2301'], quality: 0.98 },
  { name: 'Government ITI Satara', type: 'ITI', district: 'Satara', courses: ITI, quality: 0.97 },
  { name: 'Government ITI Solapur', type: 'ITI', district: 'Solapur', courses: ITI, quality: 0.95 },
  { name: 'PMKK Nagpur', type: 'PMKK', district: 'Nagpur', courses: PMKK, quality: 0.97 },
  { name: 'Government ITI Nagpur', type: 'ITI', district: 'Nagpur', courses: ITI, quality: 0.99 },
  { name: 'Vidarbha Institute of IT, Nagpur', type: 'PRIVATE', district: 'Nagpur', courses: ['SSC/Q0503', 'SSC/Q1301', 'SSC/Q2212', 'SSC/Q2210'], quality: 0.96 },
  { name: 'Government Polytechnic Skills Wing, Nagpur', type: 'POLYTECHNIC', district: 'Nagpur', courses: POLY, quality: 0.98 },
  { name: 'Government ITI Amravati', type: 'ITI', district: 'Amravati', courses: ITI, quality: 0.94 },
  { name: 'PMKK Akola', type: 'PMKK', district: 'Akola', courses: PMKK, quality: 0.92 },
  { name: 'Government ITI Yavatmal', type: 'ITI', district: 'Yavatmal', courses: ITI, quality: 0.9 },
  { name: 'Government ITI Wardha', type: 'ITI', district: 'Wardha', courses: ITI, quality: 0.93 },
  { name: 'PMKK Chandrapur', type: 'PMKK', district: 'Chandrapur', courses: PMKK, quality: 0.93 },
  { name: 'Government ITI Bhandara', type: 'ITI', district: 'Bhandara', courses: ITI, quality: 0.9 },
  { name: 'Government ITI Gadchiroli', type: 'ITI', district: 'Gadchiroli', courses: [...ITI, 'BSC/Q7301'], quality: 0.88 },
];

export const EMPLOYER_PREFIXES = [
  'Sahyadri', 'Deccan', 'Godavari', 'Krishna', 'Shivneri', 'Sinhagad', 'Ajanta', 'Vidarbha', 'Konkan', 'Tapi',
  'Bhima', 'Indrayani', 'Pawana', 'Shree Ganesh', 'Jay Bhavani', 'Mauli', 'Siddhivinayak', 'Ashtavinayak', 'Rajgad', 'Purna',
  'Varad', 'Shubham', 'Omkar', 'Trimurti', 'Navratna', 'Saptashrungi', 'Kamdhenu', 'Pratik', 'Yashoda', 'Meghdoot',
];

export const EMPLOYER_NOUNS: Record<string, string[]> = {
  'Capital Goods & Manufacturing': ['Precision Components', 'Engineering Works', 'Auto Stampings', 'Forgings', 'Machine Tools', 'Fabricators', 'Tooling Solutions', 'Castings', 'Press Components', 'Gears and Shafts'],
  'Electrical & Green Energy': ['Electricals', 'Solar Energy Solutions', 'Power Systems', 'Electro Controls', 'EV Charging Services', 'Switchgear'],
  Automotive: ['Motors', 'Auto Service Centre', 'Automobiles', 'Two Wheelers', 'Car Care', 'Auto Body Works'],
  Retail: ['Mart', 'Super Bazaar', 'Retail', 'Fashion Hub', 'Hypermarket', 'Warehousing and Logistics'],
  'IT-ITeS': ['Infotech', 'Software Solutions', 'Technologies', 'Digital Services', 'BPO Services', 'Data Systems'],
  'Beauty & Wellness': ['Beauty Salon', 'Unisex Salon', 'Bridal Studio', 'Wellness Spa'],
  BFSI: ['and Associates', 'Tax Consultants', 'Microfinance Foundation', 'Urban Credit Co-operative Society', 'Accounting Services'],
  'Tourism & Hospitality': ['Hotel', 'Residency', 'Caterers', 'Restaurant', 'Resorts', 'Food Court'],
};

export const EMPLOYER_SUFFIX = ['Pvt Ltd', 'Pvt Ltd', 'LLP', '', 'Pvt Ltd', ''];

export const INDUSTRIAL_HUBS: Record<string, string[]> = {
  'Capital Goods & Manufacturing': ['Pune', 'Pune', 'Pune', 'Nashik', 'Nashik', 'Chhatrapati Sambhajinagar', 'Chhatrapati Sambhajinagar', 'Thane', 'Kolhapur', 'Nagpur', 'Satara', 'Raigad'],
  Automotive: ['Pune', 'Pune', 'Chhatrapati Sambhajinagar', 'Nashik', 'Mumbai Suburban', 'Thane', 'Nagpur'],
};

// Quotes are the kind of free-text replies trainees send the bot or tell field agents.
export const SKILL_QUOTES: Record<string, string[]> = {
  cnc_5axis: [
    'कंपनीत नवीन 5-axis CNC मशीन आल्या, आम्हाला फक्त 2-axis लेथ शिकवला होता.',
    '५-अक्ष मशीनवर काम येत नाही म्हणून सुपरवायझरने दुसऱ्या लाईनवर टाकले.',
    'Chakan madhe sagle 5-axis VMC var kaam magtat, training madhe te navhta.',
    '5 axis programming yet nahi mhanun pagar vadhla nahi.',
    'प्लांटमध्ये 5-axis मशीन आल्यावर आमच्यासारख्या ऑपरेटरची गरज कमी झाली.',
  ],
  cam_programming: ['Mastercam शिकायला हवं होतं, कंपनी प्रोग्रामिंग करणाऱ्यांनाच ठेवते.', 'CAM programming yet nahi mhanun setter chi post nahi milali.'],
  gdt: ['ड्रॉइंग वाचन (GD&T) नीट येत नव्हते, QC मध्ये रिजेक्शन जास्त आले.', 'GD&T symbols samajle nahit, supervisor ne line badalli.'],
  siemens_control: ['आमच्या शॉपमध्ये Siemens control आहे, आम्ही फक्त Fanuc शिकलो.'],
  tig_welding: ['Stainless कामासाठी TIG welding पाहिजे होते.', 'Argon welding yet nahi mhanun contractor ne kaadhla.'],
  robotic_welding: ['प्लांटमध्ये रोबोट welding line आली, आमची गरज कमी झाली.'],
  plc: ['PLC panel चे काम येत नाही म्हणून maintenance मध्ये घेतले नाही.', 'Company mein PLC wiring maangte hain, humne nahi seekha.'],
  ev_battery: ['EV battery चे काम शिकवले नाही, शोरूममध्ये आता तेच जास्त येते.', 'Electric vehicle ki battery ka kaam nahi aata.'],
  solar_hybrid: ['Hybrid inverter आणि net meter चे काम येत नव्हते.', 'On-grid system commissioning nahi aata tha.'],
  bs6_diagnostics: ['BS6 गाड्यांसाठी OBD scanner वापरता येत नाही.', 'Scanner se fault code padhna nahi aata.'],
  react: [
    'Nagpur madhe sagle interviews React madhe hote, amhala fakt JavaScript shikavla.',
    'सगळ्या कंपन्या React.js विचारतात, कोर्समध्ये नव्हते.',
    'React aur TypeScript ke bina koi interview clear nahi hua.',
    'Every company asked for a React project in the portfolio.',
  ],
  typescript: ['TypeScript विचारलं, आम्हाला माहितच नव्हतं.'],
  git: ['Git वापरता येत नव्हते, टीममध्ये काम करताना अडचण आली.', 'GitHub par project dikhana tha, nahi aata tha.'],
  cloud_basics: ['Deployment and AWS basics were asked in every interview.'],
  spoken_english: [
    'ग्राहकांशी इंग्रजीत बोलता येत नाही म्हणून मॉलमध्ये निवड झाली नाही.',
    'English mein baat karni padti hai, confidence nahi tha.',
    'Spoken English kami padla, hotel ne dusrya la ghetla.',
  ],
  digital_billing: ['POS billing machine चालवता येत नव्हती.', 'UPI aur billing software ka kaam aana chahiye tha.'],
  advanced_excel: ['Excel मध्ये pivot आणि vlookup विचारले.', 'Advanced Excel yet nahi mhanun office job nahi milala.'],
  gst_returns: ['GSTR-1 आणि 3B filing प्रत्यक्ष करता येत नव्हते.', 'CA office madhe GST return filing magtat.'],
  tally_prime: ['Tally Prime आणि e-invoice चे काम मागत होते.'],
  bridal_airbrush: ['लग्नसराईत airbrush makeup ची मागणी आहे, ते शिकलो नाही.', 'HD makeup aur airbrush sab maangte hain.'],
  hair_chemical: ['Keratin आणि smoothening treatment येत नव्हते.'],
  social_media_marketing: ['Instagram वर काम कसे दाखवायचे ते माहीत नव्हते, ग्राहक मिळाले नाहीत.', 'Social media marketing yet nahi, customer kami aale.'],
  continental_cuisine: ['हॉटेलमध्ये continental dishes विचारल्या.', 'Continental aur pasta banana nahi aata tha.'],
  food_safety: ['FSSAI hygiene certificate मागितले.'],
  pms_software: ['Hotel reservation software (PMS) वापरता येत नव्हते.'],
};

export const AGENT_NOTES = [
  'Spoke to trainee on alternate number; details confirmed.',
  'Trainee was travelling; call back scheduled and completed next day.',
  'Mother answered first; trainee joined the call and gave details.',
  'Number switched off twice; reached on WhatsApp number.',
  'Trainee confirmed status, requested information on bridge courses.',
];
