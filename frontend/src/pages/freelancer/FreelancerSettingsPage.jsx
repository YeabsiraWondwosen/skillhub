import { useTranslation } from 'react-i18next';
import {
  CogIcon, GlobeAltIcon, UserCircleIcon, ShieldCheckIcon, BellIcon,
  LockClosedIcon,
} from '@heroicons/react/24/outline';
import ProfileInfoSection from '@/components/accountSettings/ProfileInfoSection';
import AvatarSection from '@/components/accountSettings/AvatarSection';
import EmailInfoSection from '@/components/accountSettings/EmailInfoSection';
import ChangePasswordForm from '@/components/accountSettings/ChangePasswordForm';
import NotificationsSettings from '@/components/accountSettings/NotificationsSettings';
import PrivacySettings from '@/components/accountSettings/PrivacySettings';
import PageHeader from '@/components/ui/PageHeader';

const TABS = [
  { key: 'account', label: 'Account', icon: UserCircleIcon },
  { key: 'security', label: 'Security', icon: ShieldCheckIcon },
  { key: 'notifications', label: 'Notifications', icon: BellIcon },
  { key: 'privacy', label: 'Privacy', icon: LockClosedIcon },
  { key: 'language', label: 'Language', icon: GlobeAltIcon },
];

export default function FreelancerSettingsPage() {
  const { i18n } = useTranslation();
  const isAmharic = i18n.language === 'am';

  return (
    <div className="page-container space-y-6">
      <PageHeader icon={CogIcon} title="Settings" subtitle="Manage your account, security, privacy and preferences" />

      <div className="grid lg:grid-cols-4 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="card p-2 space-y-1 sticky top-24">
            {TABS.map(tab => (
              <a
                key={tab.key}
                href={`#settings-${tab.key}`}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-700 transition-colors"
              >
                <tab.icon className="w-5 h-5 text-gray-400" />
                {tab.label}
              </a>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3 space-y-6">
          <section id="settings-account" className="scroll-mt-24 space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">Account</h2>
            <AvatarSection />
            <ProfileInfoSection />
            <EmailInfoSection />
          </section>

          <section id="settings-security" className="scroll-mt-24 space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">Security</h2>
            <ChangePasswordForm />
          </section>

          <section id="settings-notifications" className="scroll-mt-24 space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">Notifications</h2>
            <NotificationsSettings variant="freelancer" />
          </section>

          <section id="settings-privacy" className="scroll-mt-24 space-y-6">
            <PrivacySettings />
          </section>

          <section id="settings-language" className="scroll-mt-24 space-y-6">
            <h2 className="font-semibold text-gray-900 dark:text-white">Language</h2>
            <div className="card p-6">
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">
                Choose your preferred display language.
              </p>
              <div className="flex gap-2">
                {[
                  { code: 'en', label: 'English' },
                  { code: 'am', label: 'አማርኛ' },
                ].map(lang => (
                  <button
                    key={lang.code}
                    onClick={() => i18n.changeLanguage(lang.code)}
                    className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-medium border transition-colors ${
                      i18n.language === lang.code
                        ? 'bg-primary-600 text-white border-primary-600'
                        : 'border-gray-200 dark:border-gray-700 text-gray-600 dark:text-gray-300 hover:border-primary-400'
                    }`}
                  >
                    {lang.label}
                  </button>
                ))}
              </div>
              <p className="text-xs text-gray-400 mt-3">{isAmharic ? 'ቋንቋ ተመርጧል' : 'Language applied immediately'}</p>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
