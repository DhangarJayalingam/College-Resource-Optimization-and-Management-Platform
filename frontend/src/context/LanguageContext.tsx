import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useState
} from 'react';

export type AppLanguage = 'en' | 'ta' | 'hi';

interface LanguageContextValue {
  language: AppLanguage;
  setLanguage: (language: AppLanguage) => void;
  t: (key: string, fallback?: string) => string;
  languageLabel: string;
  languages: Array<{ value: AppLanguage; label: string }>;
}

const STORAGE_KEY = 'cop_language_v1';

const dictionaries: Record<AppLanguage, Record<string, string>> = {
  en: {
    'language.english': 'English',
    'language.tamil': 'Tamil',
    'language.hindi': 'Hindi',
    'nav.dashboard': 'Dashboard',
    'nav.resources': 'Resources',
    'nav.departments': 'Departments',
    'nav.identity': 'Identity & Access',
    'nav.timetable': 'Timetable',
    'nav.aiAssistant': 'AI Assistant',
    'nav.laboratories': 'Laboratories',
    'nav.announcements': 'Announcements',
    'nav.settings': 'Settings',
    'nav.bookings': 'Bookings',
    'nav.bookingHistory': 'Booking History',
    'nav.bookingApprovals': 'Booking Approvals',
    'nav.platform': 'Platform',
    'nav.bookingFlow': 'Booking Flow',
    'common.logout': 'Logout',
    'common.theme': 'Theme',
    'common.save': 'Save',
    'common.done': 'Done',
    'common.viewAllAnnouncements': 'View all announcements',
    'common.bookResource': 'Book Resource',
    'common.myProfile': 'My Profile',
    'common.loadingDashboard': 'Preparing your personalized dashboard...',
    'layout.campusControlCenter': 'Campus Control Center',
    'layout.defaultTitle': 'College Resource Optimization',
    'layout.defaultSubtitle': 'Smart scheduling, allocation, and campus operations',
    'layout.platformName': 'CollegeOpt AI',
    'layout.platformTag': 'Resource Optimization',
    'layout.principalControl': 'Principal Control',
    'layout.departmentOperations': 'Department Operations',
    'layout.facultyWorkspace': 'Faculty Workspace',
    'layout.studentWorkspace': 'Student Workspace',
    'landing.capabilities': 'Capabilities',
    'landing.workflow': 'Workflow',
    'landing.impact': 'Impact',
    'landing.signIn': 'Sign In',
    'landing.aiPowered': 'AI-powered college resource optimization',
    'landing.heroTitle': 'Run the campus like a live operating system.',
    'landing.heroDescription': 'Optimize schedules, faculty workload, laboratories, classrooms, and equipment from one intelligent control layer.',
    'landing.launchPlatform': 'Launch Platform',
    'landing.exploreCapabilities': 'Explore Capabilities',
    'login.welcome': 'Welcome!',
    'login.welcomeSubtitle': 'To College Resource Optimization.',
    'login.welcomeBody': 'Managed by Principal & HODs. Login with your Real Name identity and verified credentials.',
    'login.signIn': 'Sign In',
    'login.signUp': 'Sign Up',
    'login.resetPassword': 'Reset Password',
    'login.loginEmail': 'Login Email / Real Identity',
    'login.password': 'Password',
    'login.rememberMe': 'Remember me',
    'login.forgotPassword': 'Forgot password?',
    'login.signingIn': 'Signing In...',
    'login.orContinue': 'or continue with',
    'login.noAccount': "Don't have an account?",
    'login.haveAccount': 'Already have an account?',
    'login.createAccount': 'Create Account',
    'login.creating': 'Creating...',
    'login.sendCode': 'Send Code',
    'login.realFullName': 'Real Full Name',
    'login.email': 'Email',
    'login.verificationCode': 'Email Verification Code',
    'login.resetVerificationCode': 'Reset Verification Code',
    'login.newPassword': 'New Password',
    'login.backTo': 'Back to',
    'dashboard.principalTitle': 'Principal Dashboard',
    'dashboard.adminTitle': 'Department Admin',
    'dashboard.facultyTitle': 'Faculty Portal',
    'dashboard.studentTitle': 'Student Hub',
    'dashboard.executiveView': 'Executive View',
    'dashboard.operationsView': 'Operations View',
    'dashboard.facultyView': 'Faculty View',
    'dashboard.studentView': 'Student View',
    'dashboard.recentUpdates': 'Recent Updates',
    'dashboard.departmentBroadcasts': 'Department broadcasts',
    'dashboard.quickActions': 'Quick Actions',
    'dashboard.emailIdentifier': 'Email Identifier',
    'dashboard.status': 'Status',
    'dashboard.activeInstitutional': 'Active • Institutional Account',
    'settings.systemTitle': 'Role-Based Configuration',
    'settings.languageLabel': 'Application Language',
    'settings.languageDescription': 'Choose the language used across the application for better readability.',
    'settings.languageSaved': 'Language updated.',
    'settings.languageOption.en': 'English',
    'settings.languageOption.ta': 'Tamil',
    'settings.languageOption.hi': 'Hindi'
  },
  ta: {
    'language.english': 'ஆங்கிலம்',
    'language.tamil': 'தமிழ்',
    'language.hindi': 'இந்தி',
    'nav.dashboard': 'டாஷ்போர்டு',
    'nav.resources': 'வளங்கள்',
    'nav.departments': 'துறைகள்',
    'nav.identity': 'அடையாளம் மற்றும் அணுகல்',
    'nav.timetable': 'நேர அட்டவணை',
    'nav.aiAssistant': 'ஏஐ உதவியாளர்',
    'nav.laboratories': 'ஆய்வகங்கள்',
    'nav.announcements': 'அறிவிப்புகள்',
    'nav.settings': 'அமைப்புகள்',
    'nav.bookings': 'பதிவுகள்',
    'nav.bookingHistory': 'பதிவு வரலாறு',
    'nav.bookingApprovals': 'பதிவு ஒப்புதல்கள்',
    'nav.platform': 'தளம்',
    'nav.bookingFlow': 'பதிவு நடைமுறை',
    'common.logout': 'வெளியேறு',
    'common.theme': 'தீம்',
    'common.save': 'சேமிக்கவும்',
    'common.done': 'முடிந்தது',
    'common.viewAllAnnouncements': 'அனைத்து அறிவிப்புகளையும் காண்க',
    'common.bookResource': 'வளத்தை பதிவு செய்',
    'common.myProfile': 'என் சுயவிவரம்',
    'common.loadingDashboard': 'உங்கள் தனிப்பயன் டாஷ்போர்டு தயாராகிறது...',
    'layout.campusControlCenter': 'வளாக கட்டுப்பாட்டு மையம்',
    'layout.defaultTitle': 'கல்லூரி வள மேம்பாடு',
    'layout.defaultSubtitle': 'புத்திசாலி திட்டமிடல், ஒதுக்கீடு மற்றும் வளாக செயல்பாடுகள்',
    'layout.platformName': 'காலேஜ்ஆப்ட் ஏஐ',
    'layout.platformTag': 'வள மேம்பாடு',
    'layout.principalControl': 'முதல்வர் கட்டுப்பாடு',
    'layout.departmentOperations': 'துறை செயல்பாடுகள்',
    'layout.facultyWorkspace': 'ஆசிரியர் பகுதி',
    'layout.studentWorkspace': 'மாணவர் பகுதி',
    'landing.capabilities': 'திறன்கள்',
    'landing.workflow': 'செயல்முறை',
    'landing.impact': 'விளைவு',
    'landing.signIn': 'உள்நுழை',
    'landing.aiPowered': 'ஏஐ இயக்கும் கல்லூரி வள மேம்பாடு',
    'landing.heroTitle': 'வளாகத்தை ஒரு செயல்பாட்டு அமைப்பைப் போல இயக்குங்கள்.',
    'landing.heroDescription': 'ஒரே நுண்ணறிவு கட்டுப்பாட்டு அடுக்கில் அட்டவணைகள், ஆசிரியர் பணிச்சுமை, ஆய்வகங்கள், வகுப்பறைகள் மற்றும் உபகரணங்களை மேம்படுத்துங்கள்.',
    'landing.launchPlatform': 'தளத்தை தொடங்கு',
    'landing.exploreCapabilities': 'திறன்களை பாருங்கள்',
    'login.welcome': 'வரவேற்கிறோம்!',
    'login.welcomeSubtitle': 'கல்லூரி வள மேம்பாட்டிற்கு.',
    'login.welcomeBody': 'முதல்வர் மற்றும் HOD கள் நிர்வகிக்கின்றனர். உங்கள் உண்மை அடையாளத்துடன் மற்றும் சரிபார்க்கப்பட்ட சான்றுகளுடன் உள்நுழைக.',
    'login.signIn': 'உள்நுழை',
    'login.signUp': 'பதிவு செய்',
    'login.resetPassword': 'கடவுச்சொல்லை மீட்டமை',
    'login.loginEmail': 'உள்நுழைவு மின்னஞ்சல் / உண்மை அடையாளம்',
    'login.password': 'கடவுச்சொல்',
    'login.rememberMe': 'என்னை நினைவில் கொள்',
    'login.forgotPassword': 'கடவுச்சொல் மறந்துவிட்டதா?',
    'login.signingIn': 'உள்நுழைகிறது...',
    'login.orContinue': 'அல்லது இதன் மூலம் தொடரவும்',
    'login.noAccount': 'கணக்கு இல்லையா?',
    'login.haveAccount': 'ஏற்கனவே கணக்கு உள்ளதா?',
    'login.createAccount': 'கணக்கு உருவாக்கு',
    'login.creating': 'உருவாக்கப்படுகிறது...',
    'login.sendCode': 'குறியீட்டை அனுப்பு',
    'login.realFullName': 'உண்மையான முழுப்பெயர்',
    'login.email': 'மின்னஞ்சல்',
    'login.verificationCode': 'மின்னஞ்சல் சரிபார்ப்பு குறியீடு',
    'login.resetVerificationCode': 'மீட்டமைப்பு சரிபார்ப்பு குறியீடு',
    'login.newPassword': 'புதிய கடவுச்சொல்',
    'login.backTo': 'திரும்ப',
    'dashboard.principalTitle': 'முதல்வர் டாஷ்போர்டு',
    'dashboard.adminTitle': 'துறை நிர்வாகம்',
    'dashboard.facultyTitle': 'ஆசிரியர் தளம்',
    'dashboard.studentTitle': 'மாணவர் மையம்',
    'dashboard.executiveView': 'நிர்வாக பார்வை',
    'dashboard.operationsView': 'செயல்பாட்டு பார்வை',
    'dashboard.facultyView': 'ஆசிரியர் பார்வை',
    'dashboard.studentView': 'மாணவர் பார்வை',
    'dashboard.recentUpdates': 'சமீபத்திய புதுப்பிப்புகள்',
    'dashboard.departmentBroadcasts': 'துறை அறிவிப்புகள்',
    'dashboard.quickActions': 'விரைவு செயல்கள்',
    'dashboard.emailIdentifier': 'மின்னஞ்சல் அடையாளம்',
    'dashboard.status': 'நிலை',
    'dashboard.activeInstitutional': 'செயலில் • நிறுவனம் கணக்கு',
    'settings.systemTitle': 'பாத்திர அடிப்படையிலான அமைப்பு',
    'settings.languageLabel': 'பயன்பாட்டு மொழி',
    'settings.languageDescription': 'மேலும் வாசிக்க எளிதாகவும் வசதியாகவும் பயன்பாட்டின் மொழியை தேர்வு செய்யவும்.',
    'settings.languageSaved': 'மொழி புதுப்பிக்கப்பட்டது.',
    'settings.languageOption.en': 'English',
    'settings.languageOption.ta': 'தமிழ்',
    'settings.languageOption.hi': 'हिन्दी'
  },
  hi: {
    'language.english': 'अंग्रेज़ी',
    'language.tamil': 'तमिल',
    'language.hindi': 'हिंदी',
    'nav.dashboard': 'डैशबोर्ड',
    'nav.resources': 'संसाधन',
    'nav.departments': 'विभाग',
    'nav.identity': 'पहचान और पहुंच',
    'nav.timetable': 'समय सारिणी',
    'nav.aiAssistant': 'एआई सहायक',
    'nav.laboratories': 'प्रयोगशालाएं',
    'nav.announcements': 'घोषणाएं',
    'nav.settings': 'सेटिंग्स',
    'nav.bookings': 'बुकिंग',
    'nav.bookingHistory': 'बुकिंग इतिहास',
    'nav.bookingApprovals': 'बुकिंग स्वीकृतियां',
    'nav.platform': 'प्लेटफ़ॉर्म',
    'nav.bookingFlow': 'बुकिंग प्रवाह',
    'common.logout': 'लॉगआउट',
    'common.theme': 'थीम',
    'common.save': 'सेव करें',
    'common.done': 'पूर्ण',
    'common.viewAllAnnouncements': 'सभी घोषणाएं देखें',
    'common.bookResource': 'संसाधन बुक करें',
    'common.myProfile': 'मेरी प्रोफाइल',
    'common.loadingDashboard': 'आपका व्यक्तिगत डैशबोर्ड तैयार किया जा रहा है...',
    'layout.campusControlCenter': 'कैंपस कंट्रोल सेंटर',
    'layout.defaultTitle': 'कॉलेज संसाधन अनुकूलन',
    'layout.defaultSubtitle': 'स्मार्ट शेड्यूलिंग, आवंटन और कैंपस संचालन',
    'layout.platformName': 'कॉलेजऑप्ट एआई',
    'layout.platformTag': 'संसाधन अनुकूलन',
    'layout.principalControl': 'प्रिंसिपल नियंत्रण',
    'layout.departmentOperations': 'विभाग संचालन',
    'layout.facultyWorkspace': 'फैकल्टी कार्यक्षेत्र',
    'layout.studentWorkspace': 'छात्र कार्यक्षेत्र',
    'landing.capabilities': 'क्षमताएं',
    'landing.workflow': 'कार्यप्रवाह',
    'landing.impact': 'प्रभाव',
    'landing.signIn': 'साइन इन',
    'landing.aiPowered': 'एआई संचालित कॉलेज संसाधन अनुकूलन',
    'landing.heroTitle': 'कैंपस को एक लाइव ऑपरेटिंग सिस्टम की तरह चलाएं।',
    'landing.heroDescription': 'एक ही बुद्धिमान कंट्रोल लेयर से शेड्यूल, फैकल्टी वर्कलोड, लैब, कक्षाएं और उपकरण अनुकूलित करें।',
    'landing.launchPlatform': 'प्लेटफ़ॉर्म खोलें',
    'landing.exploreCapabilities': 'क्षमताएं देखें',
    'login.welcome': 'स्वागत है!',
    'login.welcomeSubtitle': 'कॉलेज संसाधन अनुकूलन में।',
    'login.welcomeBody': 'प्रिंसिपल और HOD द्वारा प्रबंधित। अपनी वास्तविक पहचान और सत्यापित क्रेडेंशियल्स के साथ लॉगिन करें।',
    'login.signIn': 'साइन इन',
    'login.signUp': 'साइन अप',
    'login.resetPassword': 'पासवर्ड रीसेट करें',
    'login.loginEmail': 'लॉगिन ईमेल / वास्तविक पहचान',
    'login.password': 'पासवर्ड',
    'login.rememberMe': 'मुझे याद रखें',
    'login.forgotPassword': 'पासवर्ड भूल गए?',
    'login.signingIn': 'साइन इन हो रहा है...',
    'login.orContinue': 'या इसके साथ जारी रखें',
    'login.noAccount': 'क्या आपका खाता नहीं है?',
    'login.haveAccount': 'क्या आपका पहले से खाता है?',
    'login.createAccount': 'खाता बनाएं',
    'login.creating': 'बनाया जा रहा है...',
    'login.sendCode': 'कोड भेजें',
    'login.realFullName': 'पूरा वास्तविक नाम',
    'login.email': 'ईमेल',
    'login.verificationCode': 'ईमेल सत्यापन कोड',
    'login.resetVerificationCode': 'रीसेट सत्यापन कोड',
    'login.newPassword': 'नया पासवर्ड',
    'login.backTo': 'वापस',
    'dashboard.principalTitle': 'प्रिंसिपल डैशबोर्ड',
    'dashboard.adminTitle': 'विभाग प्रशासक',
    'dashboard.facultyTitle': 'फैकल्टी पोर्टल',
    'dashboard.studentTitle': 'छात्र केंद्र',
    'dashboard.executiveView': 'कार्यकारी दृश्य',
    'dashboard.operationsView': 'संचालन दृश्य',
    'dashboard.facultyView': 'फैकल्टी दृश्य',
    'dashboard.studentView': 'छात्र दृश्य',
    'dashboard.recentUpdates': 'हाल के अपडेट',
    'dashboard.departmentBroadcasts': 'विभाग घोषणाएं',
    'dashboard.quickActions': 'त्वरित क्रियाएं',
    'dashboard.emailIdentifier': 'ईमेल पहचान',
    'dashboard.status': 'स्थिति',
    'dashboard.activeInstitutional': 'सक्रिय • संस्थागत खाता',
    'settings.systemTitle': 'भूमिका आधारित कॉन्फ़िगरेशन',
    'settings.languageLabel': 'एप्लिकेशन भाषा',
    'settings.languageDescription': 'बेहतर पठनीयता और सुविधा के लिए पूरी एप्लिकेशन की भाषा चुनें।',
    'settings.languageSaved': 'भाषा अपडेट हो गई।',
    'settings.languageOption.en': 'English',
    'settings.languageOption.ta': 'தமிழ்',
    'settings.languageOption.hi': 'हिंदी'
  }
};

const labels: Record<AppLanguage, string> = {
  en: 'English',
  ta: 'தமிழ்',
  hi: 'हिंदी'
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

export function LanguageProvider({ children }: PropsWithChildren) {
  const [language, setLanguage] = useState<AppLanguage>(() => {
    if (typeof window === 'undefined') {
      return 'en';
    }

    const persisted = window.localStorage.getItem(STORAGE_KEY) as AppLanguage | null;
    if (persisted && dictionaries[persisted]) {
      return persisted;
    }
    return 'en';
  });

  useEffect(() => {
    window.localStorage.setItem(STORAGE_KEY, language);
    document.documentElement.lang = language;
  }, [language]);

  const value = useMemo<LanguageContextValue>(
    () => ({
      language,
      setLanguage,
      t: (key: string, fallback?: string) => dictionaries[language][key] ?? fallback ?? key,
      languageLabel: labels[language],
      languages: [
        { value: 'en', label: dictionaries[language]['settings.languageOption.en'] ?? 'English' },
        { value: 'ta', label: dictionaries[language]['settings.languageOption.ta'] ?? 'Tamil' },
        { value: 'hi', label: dictionaries[language]['settings.languageOption.hi'] ?? 'Hindi' }
      ]
    }),
    [language]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('Language context is not available.');
  }
  return context;
}
