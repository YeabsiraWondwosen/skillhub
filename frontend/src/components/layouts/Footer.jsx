import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { FaFacebookF, FaLinkedinIn, FaXTwitter, FaInstagram, FaYoutube, FaTelegram } from 'react-icons/fa6';

const SOCIALS = [
  { icon: FaFacebookF, label: 'Facebook', href: '#', color: 'hover:bg-blue-600' },
  { icon: FaLinkedinIn, label: 'LinkedIn', href: '#', color: 'hover:bg-blue-700' },
  { icon: FaXTwitter, label: 'X (Twitter)', href: '#', color: 'hover:bg-gray-800' },
  { icon: FaInstagram, label: 'Instagram', href: '#', color: 'hover:bg-pink-600' },
  { icon: FaYoutube, label: 'YouTube', href: '#', color: 'hover:bg-red-600' },
  { icon: FaTelegram, label: 'Telegram', href: '#', color: 'hover:bg-blue-500' },
];

const container = { hidden: {}, show: { transition: { staggerChildren: 0.04 } } };
const item = { hidden: { opacity: 0, y: 12 }, show: { opacity: 1, y: 0 } };

function FooterLinkColumn({ section }) {
  return (
    <motion.div variants={item} className="space-y-4">
      <h3 className="text-sm font-bold text-white tracking-wide uppercase">{section.title}</h3>
      <ul className="space-y-2.5">
        {section.links.map((link) => (
          <li key={link.label}>
            <Link
              to={link.to}
              className="group flex items-center gap-1.5 text-sm text-gray-400 hover:text-white transition-colors duration-200"
            >
              <span className="w-1 h-1 rounded-full bg-gray-600 group-hover:bg-primary-400 transition-colors" />
              {link.label}
            </Link>
          </li>
        ))}
      </ul>
    </motion.div>
  );
}

export default function Footer() {
  const { t } = useTranslation();

  const FOOTER_LINKS = [
    {
      title: t('footer.forClients'),
      links: [
        { label: t('footer.postJob'), to: '/jobs' },
        { label: t('footer.findFreelancers'), to: '/freelancers' },
        { label: t('footer.browseServices'), to: '/catalogs' },
        { label: t('footer.howSkillHubWorks'), to: '/about' },
      ],
    },
    {
      title: t('footer.forFreelancers'),
      links: [
        { label: t('footer.findWork'), to: '/jobs' },
        { label: t('footer.browseJobs'), to: '/jobs' },
        { label: t('footer.createProfile'), to: '/freelancer/profile' },
        { label: t('footer.buildPortfolio'), to: '/freelancer/profile' },
      ],
    },
    {
      title: t('footer.company'),
      links: [
        { label: t('footer.aboutUs'), to: '/about' },
        { label: t('footer.careers'), to: '/careers' },
        { label: t('footer.contactUs'), to: '/contact' },
        { label: t('footer.howSkillHubWorks'), to: '/about' },
      ],
    },
    {
      title: t('footer.support'),
      links: [
        { label: t('footer.helpCenter'), to: '/help' },
        { label: t('footer.faq'), to: '/faq' },
        { label: t('footer.contactSupport'), to: '/support' },
        { label: t('footer.trustAndSafety'), to: '/trust-safety' },
      ],
    },
    {
      title: t('footer.legal'),
      links: [
        { label: t('footer.termsOfService'), to: '/terms' },
        { label: t('footer.privacyPolicy'), to: '/privacy' },
        { label: t('footer.cookiePolicy'), to: '/cookies' },
      ],
    },
  ];

  return (
    <footer className="relative bg-dark-950 overflow-hidden" role="contentinfo">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-primary-500/5 via-secondary-500/3 to-transparent rounded-full blur-3xl" />
      </div>

      <div className="relative">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-16 pb-12">
          <motion.div
            variants={container}
            initial="hidden"
            whileInView="show"
            viewport={{ once: true, margin: '-40px' }}
            className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-10 lg:gap-8"
          >
            <motion.div variants={item} className="sm:col-span-2 lg:col-span-3 space-y-5">
              <Link to="/" className="inline-flex items-center group" aria-label="SkillHub Home">
                <img src="/images/skillhub-logo-light.png" alt="SkillHub" className="h-9 w-auto object-contain" />
              </Link>
              <p className="text-sm text-gray-400 leading-relaxed max-w-sm">
                {t('footer.tagline')}
              </p>

              <div className="flex items-center gap-2">
                {SOCIALS.map(({ icon: Icon, label, href, color }) => (
                  <a
                    key={label}
                    href={href}
                    aria-label={label}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-gray-400 hover:text-white hover:border-white/10 transition-all duration-300 ${color}`}
                  >
                    <Icon className="w-4 h-4" />
                  </a>
                ))}
              </div>
            </motion.div>

            <div className="sm:col-span-2 lg:col-span-9 grid grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-6">
              {FOOTER_LINKS.map((section) => (
                <FooterLinkColumn key={section.title} section={section} />
              ))}
            </div>
          </motion.div>
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent" />
        </div>

        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <p className="text-center text-xs text-gray-500">
            &copy; {new Date().getFullYear()} SkillHub. {t('footer.allRights')}
          </p>
        </div>
      </div>
    </footer>
  );
}
