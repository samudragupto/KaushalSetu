// Follow-up bot state machine definitions. The engine lives in apps/api/src/services/bot.ts;
// the same definitions drive the web simulator and the WhatsApp Cloud API adapter.
import type { Lang } from './types';

export const BOT_STATES = [
  'ASK_STATUS',
  'JOB_EMPLOYER',
  'JOB_DESIGNATION',
  'JOB_WAGE',
  'JOB_CONFIRM',
  'JOB_SKILLS',
  'SELF_TYPE',
  'SELF_UDYAM',
  'SELF_INCOME',
  'SELF_PROOF',
  'APPR_ESTABLISHMENT',
  'APPR_STIPEND',
  'NW_REASON',
  'NW_SKILLS',
  'DONE',
] as const;

export type BotState = (typeof BOT_STATES)[number];

export const BOT_INPUT_KIND: Record<BotState, 'buttons' | 'text' | 'upload' | 'closed'> = {
  ASK_STATUS: 'buttons',
  JOB_EMPLOYER: 'text',
  JOB_DESIGNATION: 'text',
  JOB_WAGE: 'text',
  JOB_CONFIRM: 'buttons',
  JOB_SKILLS: 'text',
  SELF_TYPE: 'buttons',
  SELF_UDYAM: 'text',
  SELF_INCOME: 'buttons',
  SELF_PROOF: 'upload',
  APPR_ESTABLISHMENT: 'text',
  APPR_STIPEND: 'text',
  NW_REASON: 'buttons',
  NW_SKILLS: 'text',
  DONE: 'closed',
};

export const UDYAM_PATTERN = /^UDYAM-[A-Z]{2}-\d{2}-\d{7}$/;

export const WAGE_BANDS = [
  { id: 'w_lt10', value: 9000 },
  { id: 'w_10_15', value: 12500 },
  { id: 'w_15_20', value: 17500 },
  { id: 'w_20_30', value: 24000 },
  { id: 'w_30p', value: 32000 },
] as const;

export const INCOME_BANDS = [
  { id: 'i_lt8', value: 6500 },
  { id: 'i_8_15', value: 11500 },
  { id: 'i_15_25', value: 20000 },
  { id: 'i_25p', value: 30000 },
] as const;

export const NW_REASON_TO_ENUM: Record<string, string> = {
  r_low_wage: 'LOW_WAGE',
  r_relocated: 'RELOCATION',
  r_conditions: 'WORKING_CONDITIONS',
  r_skills: 'SKILL_MISMATCH',
  r_family: 'FAMILY',
  r_health: 'HEALTH',
};

export const DESIGNATIONS_BY_COURSE: Record<string, string[]> = {
  'CSC/Q0110': ['CNC Operator', 'Senior CNC Operator'],
  'CSC/Q0204': ['Welder', 'Fabrication Welder'],
  'CSC/Q0302': ['Fitter', 'Fabrication Fitter'],
  'CSC/Q0415': ['VMC Setter', 'VMC Programmer'],
  'PSS/Q0101': ['Electrician', 'Maintenance Electrician'],
  'SGJ/Q0101': ['Solar Technician', 'Site Installer'],
  'PSS/Q2301': ['Wireman', 'Panel Wireman'],
  'SGJ/Q1402': ['EV Charger Technician', 'Field Service Technician'],
  'ASC/Q1411': ['Service Technician', 'Senior Technician'],
  'ASC/Q1402': ['Two-Wheeler Mechanic', 'Service Advisor'],
  'ASC/Q1203': ['Body Painter', 'Paint Shop Technician'],
  'RAS/Q0104': ['Sales Associate', 'Floor Executive'],
  'RAS/Q0203': ['Store Assistant', 'Inventory Associate'],
  'LSC/Q2305': ['Warehouse Associate', 'Picker Packer'],
  'SSC/Q0503': ['Junior Web Developer', 'Trainee Software Engineer'],
  'SSC/Q2212': ['Data Entry Operator', 'Back Office Executive'],
  'SSC/Q2210': ['Customer Care Executive', 'CRM Associate'],
  'SSC/Q1301': ['QA Trainee', 'Software Tester'],
  'BWS/Q0102': ['Beauty Therapist', 'Salon Assistant'],
  'BWS/Q0201': ['Hair Stylist', 'Junior Stylist'],
  'BWS/Q0301': ['Makeup Artist', 'Bridal Makeup Assistant'],
  'BSC/Q8101': ['Accounts Assistant', 'GST Assistant'],
  'BSC/Q0702': ['Accounts Executive', 'Tally Operator'],
  'BSC/Q7301': ['Field Officer', 'Relationship Officer'],
  'THC/Q0301': ['F&B Steward', 'Captain'],
  'THC/Q3002': ['Commis Chef', 'Kitchen Helper'],
  'THC/Q0102': ['Front Office Associate', 'Guest Relations Executive'],
  'THC/Q0202': ['Room Attendant', 'Housekeeping Associate'],
};

type BotTextKey =
  | 'greeting'
  | 'reminder'
  | 'askEmployer'
  | 'askDesignation'
  | 'askWage'
  | 'confirmJob'
  | 'jobDone'
  | 'verificationSent'
  | 'askJobSkills'
  | 'askSelfType'
  | 'askUdyam'
  | 'udyamInvalid'
  | 'askIncome'
  | 'askProof'
  | 'proofReceived'
  | 'selfDone'
  | 'askApprEstablishment'
  | 'askStipend'
  | 'apprDone'
  | 'askReason'
  | 'askSkills'
  | 'nwDone'
  | 'pickOption'
  | 'wageInvalid'
  | 'closed';

export const BOT_TEXT: Record<Lang, Record<BotTextKey, string>> = {
  mr: {
    greeting:
      'नमस्कार {name}! मी कौशल्यसेतू, महाराष्ट्र शासन कौशल्य विकास विभागाचा सहाय्यक. तुमचे "{course}" प्रशिक्षण पूर्ण होऊन {months} महिने झाले. सध्या तुम्ही काय करत आहात?',
    reminder: 'नमस्कार {name}, आमच्या मागील संदेशाला उत्तर मिळाले नाही. फक्त एक मिनिट लागेल. सध्या तुम्ही काय करत आहात?',
    askEmployer: 'तुमच्या कंपनीचे / आस्थापनेचे नाव काय आहे?',
    askDesignation: 'तुमचे पद (designation) काय आहे?',
    askWage: 'तुमचा सध्याचा मासिक पगार किती आहे? रक्कम अंकांमध्ये लिहा किंवा पर्याय निवडा.',
    confirmJob: 'कृपया तपासा:\n{employer}\n{designation}\n₹{wage} प्रति महिना\nही माहिती बरोबर आहे का?',
    jobDone: 'धन्यवाद! तुमची नोंद झाली आहे. पडताळणीनंतर ती "सत्यापित" म्हणून दिसेल.',
    verificationSent: 'तुमच्या नियोक्त्याला पडताळणीसाठी सुरक्षित लिंक पाठवली आहे.',
    askJobSkills: 'कामावर एखादे कौशल्य कमी पडते असे वाटते का? असल्यास तुमच्या शब्दांत लिहा, नसल्यास "काही नाही" निवडा.',
    askSelfType: 'छान! तुमचा व्यवसाय कोणत्या प्रकारचा आहे?',
    askUdyam: 'तुमचा उद्यम नोंदणी क्रमांक पाठवा (उदा. UDYAM-MH-26-0012345). नसल्यास "अजून नाही" निवडा.',
    udyamInvalid: 'हा क्रमांक योग्य स्वरूपात नाही. उदाहरण: UDYAM-MH-26-0012345',
    askIncome: 'तुमचे सरासरी मासिक उत्पन्न किती आहे?',
    askProof: 'कृपया पुरावा पाठवा: उद्यम प्रमाणपत्र, दुकानाचा फोटो किंवा UPI व्यवहार सारांश.',
    proofReceived: 'पुरावा मिळाला. धन्यवाद!',
    selfDone: 'धन्यवाद! तुमच्या व्यवसायाची नोंद झाली आहे. पुढील संपर्क {next} मध्ये.',
    askApprEstablishment: 'अप्रेंटिसशिप कोणत्या आस्थापनेत करत आहात?',
    askStipend: 'मासिक विद्यावेतन (stipend) किती मिळते? रक्कम अंकांमध्ये लिहा.',
    apprDone: 'धन्यवाद! तुमची अप्रेंटिसशिप नोंदवली आहे.',
    askReason: 'काम नसण्याचे मुख्य कारण काय आहे?',
    askSkills: 'नोकरी मिळवण्यासाठी किंवा टिकवण्यासाठी कोणती कौशल्ये कमी पडली? तुमच्या शब्दांत लिहा.',
    nwDone: 'धन्यवाद. तुमच्या उत्तरावरून आम्ही योग्य ब्रिज कोर्स सुचवू आणि जवळच्या केंद्राचा प्रतिनिधी संपर्क करेल.',
    pickOption: 'कृपया खालीलपैकी एक पर्याय निवडा.',
    wageInvalid: 'कृपया रक्कम अंकांमध्ये लिहा, उदा. 18500',
    closed: 'हा संवाद पूर्ण झाला आहे. पुढील संपर्क {next} मध्ये होईल.',
  },
  hi: {
    greeting:
      'नमस्ते {name}! मैं कौशल्यसेतु हूँ, महाराष्ट्र शासन कौशल विकास विभाग का सहायक। आपका "{course}" प्रशिक्षण पूरा हुए {months} महीने हो गए। अभी आप क्या कर रहे हैं?',
    reminder: 'नमस्ते {name}, हमारे पिछले संदेश का उत्तर नहीं मिला। बस एक मिनट लगेगा। अभी आप क्या कर रहे हैं?',
    askEmployer: 'आपकी कंपनी / संस्थान का नाम क्या है?',
    askDesignation: 'आपका पद (designation) क्या है?',
    askWage: 'आपका वर्तमान मासिक वेतन कितना है? राशि अंकों में लिखें या विकल्प चुनें।',
    confirmJob: 'कृपया जाँचें:\n{employer}\n{designation}\n₹{wage} प्रति माह\nक्या यह जानकारी सही है?',
    jobDone: 'धन्यवाद! आपकी जानकारी दर्ज हो गई है। सत्यापन के बाद यह "सत्यापित" दिखेगी।',
    verificationSent: 'आपके नियोक्ता को सत्यापन के लिए सुरक्षित लिंक भेजा गया है।',
    askJobSkills: 'क्या काम पर कोई कौशल कम पड़ता है? हो तो अपने शब्दों में लिखें, नहीं तो "कुछ नहीं" चुनें।',
    askSelfType: 'बहुत अच्छा! आपका व्यवसाय किस प्रकार का है?',
    askUdyam: 'अपना उद्यम पंजीकरण नंबर भेजें (उदा. UDYAM-MH-26-0012345)। न हो तो "अभी नहीं" चुनें।',
    udyamInvalid: 'यह नंबर सही प्रारूप में नहीं है। उदाहरण: UDYAM-MH-26-0012345',
    askIncome: 'आपकी औसत मासिक आय कितनी है?',
    askProof: 'कृपया प्रमाण भेजें: उद्यम प्रमाणपत्र, दुकान की फोटो या UPI लेनदेन सारांश।',
    proofReceived: 'प्रमाण मिल गया। धन्यवाद!',
    selfDone: 'धन्यवाद! आपके व्यवसाय की जानकारी दर्ज हो गई है। अगला संपर्क {next} में।',
    askApprEstablishment: 'आप किस संस्थान में अप्रेंटिसशिप कर रहे हैं?',
    askStipend: 'मासिक स्टाइपेंड कितना मिलता है? राशि अंकों में लिखें।',
    apprDone: 'धन्यवाद! आपकी अप्रेंटिसशिप दर्ज हो गई है।',
    askReason: 'काम न होने का मुख्य कारण क्या है?',
    askSkills: 'नौकरी पाने या टिकाने में कौन से कौशल कम पड़े? अपने शब्दों में लिखें।',
    nwDone: 'धन्यवाद। आपके उत्तर के आधार पर हम उपयुक्त ब्रिज कोर्स सुझाएँगे और नज़दीकी केंद्र का प्रतिनिधि संपर्क करेगा।',
    pickOption: 'कृपया नीचे दिए गए विकल्पों में से एक चुनें।',
    wageInvalid: 'कृपया राशि अंकों में लिखें, जैसे 18500',
    closed: 'यह बातचीत पूरी हो गई है। अगला संपर्क {next} में होगा।',
  },
  en: {
    greeting:
      'Namaskar {name}! This is KaushalSetu, the follow-up assistant of the Skill Development Department, Government of Maharashtra. It has been {months} months since you completed "{course}". What are you doing currently?',
    reminder: 'Namaskar {name}, we did not receive a reply to our last message. It takes one minute. What are you doing currently?',
    askEmployer: 'What is the name of your employer?',
    askDesignation: 'What is your designation?',
    askWage: 'What is your current monthly salary? Type the amount or pick a range.',
    confirmJob: 'Please check:\n{employer}\n{designation}\nRs {wage} per month\nIs this correct?',
    jobDone: 'Thank you. Your update is recorded and will show as "Verified" once your employer confirms.',
    verificationSent: 'A secure verification link has been sent to your employer.',
    askJobSkills: 'Is there any skill you feel you are missing at work? Write it in your own words, or pick "Nothing".',
    askSelfType: 'Good to hear. What kind of business do you run?',
    askUdyam: 'Please send your Udyam registration number (e.g. UDYAM-MH-26-0012345). Pick "Not yet" if you do not have one.',
    udyamInvalid: 'That number is not in the expected format. Example: UDYAM-MH-26-0012345',
    askIncome: 'What is your average monthly income?',
    askProof: 'Please share proof: Udyam certificate, a photo of your shop, or a UPI transaction summary.',
    proofReceived: 'Proof received. Thank you.',
    selfDone: 'Thank you. Your business details are recorded. Next check-in: {next}.',
    askApprEstablishment: 'Where are you doing your apprenticeship?',
    askStipend: 'What is your monthly stipend? Type the amount.',
    apprDone: 'Thank you. Your apprenticeship is recorded.',
    askReason: 'What is the main reason you are not working right now?',
    askSkills: 'Which skills were missing when looking for or keeping a job? Write in your own words.',
    nwDone: 'Thank you. Based on your answer we will suggest a bridge course, and your nearest centre will call you.',
    pickOption: 'Please pick one of the options below.',
    wageInvalid: 'Please type the amount in numbers, for example 18500',
    closed: 'This conversation is complete. Next check-in: {next}.',
  },
};

export const BOT_BUTTONS: Record<Lang, Record<string, string>> = {
  mr: {
    s_job: 'नोकरी',
    s_self: 'स्वयंरोजगार',
    s_appr: 'अप्रेंटिसशिप',
    s_none: 'सध्या काम नाही',
    c_yes: 'होय, बरोबर',
    c_edit: 'बदल करायचा आहे',
    k_skip: 'काही नाही',
    t_shop: 'दुकान / पार्लर',
    t_freelance: 'फ्रीलान्स',
    t_gig: 'गिग काम',
    u_skip: 'अजून नाही',
    p_later: 'नंतर पाठवतो',
    w_lt10: '₹10,000 पेक्षा कमी',
    w_10_15: '₹10,000–15,000',
    w_15_20: '₹15,000–20,000',
    w_20_30: '₹20,000–30,000',
    w_30p: '₹30,000 पेक्षा जास्त',
    i_lt8: '₹8,000 पेक्षा कमी',
    i_8_15: '₹8,000–15,000',
    i_15_25: '₹15,000–25,000',
    i_25p: '₹25,000 पेक्षा जास्त',
    r_low_wage: 'कमी पगार',
    r_relocated: 'स्थलांतर',
    r_conditions: 'कामाची परिस्थिती',
    r_skills: 'कौशल्य जुळत नाही',
    r_family: 'कौटुंबिक कारण',
    r_health: 'आरोग्य',
  },
  hi: {
    s_job: 'नौकरी',
    s_self: 'स्वरोज़गार',
    s_appr: 'अप्रेंटिसशिप',
    s_none: 'अभी काम नहीं',
    c_yes: 'हाँ, सही है',
    c_edit: 'बदलाव करना है',
    k_skip: 'कुछ नहीं',
    t_shop: 'दुकान / पार्लर',
    t_freelance: 'फ्रीलांस',
    t_gig: 'गिग काम',
    u_skip: 'अभी नहीं',
    p_later: 'बाद में भेजूँगा',
    w_lt10: '₹10,000 से कम',
    w_10_15: '₹10,000–15,000',
    w_15_20: '₹15,000–20,000',
    w_20_30: '₹20,000–30,000',
    w_30p: '₹30,000 से अधिक',
    i_lt8: '₹8,000 से कम',
    i_8_15: '₹8,000–15,000',
    i_15_25: '₹15,000–25,000',
    i_25p: '₹25,000 से अधिक',
    r_low_wage: 'कम वेतन',
    r_relocated: 'स्थानांतरण',
    r_conditions: 'काम की स्थितियाँ',
    r_skills: 'कौशल मेल नहीं',
    r_family: 'पारिवारिक कारण',
    r_health: 'स्वास्थ्य',
  },
  en: {
    s_job: 'Job',
    s_self: 'Self-employed',
    s_appr: 'Apprenticeship',
    s_none: 'Not working',
    c_yes: 'Yes, correct',
    c_edit: 'Edit details',
    k_skip: 'Nothing',
    t_shop: 'Shop / parlour',
    t_freelance: 'Freelance',
    t_gig: 'Gig work',
    u_skip: 'Not yet',
    p_later: 'Send later',
    w_lt10: 'Below Rs 10,000',
    w_10_15: 'Rs 10,000–15,000',
    w_15_20: 'Rs 15,000–20,000',
    w_20_30: 'Rs 20,000–30,000',
    w_30p: 'Above Rs 30,000',
    i_lt8: 'Below Rs 8,000',
    i_8_15: 'Rs 8,000–15,000',
    i_15_25: 'Rs 15,000–25,000',
    i_25p: 'Above Rs 25,000',
    r_low_wage: 'Low wage',
    r_relocated: 'Relocated',
    r_conditions: 'Working conditions',
    r_skills: 'Skills did not match',
    r_family: 'Family reasons',
    r_health: 'Health',
  },
};

export function fillTemplate(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => (key in vars ? String(vars[key]) : `{${key}}`));
}
