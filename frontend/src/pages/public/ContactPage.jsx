import { useState } from 'react';
import { motion } from 'framer-motion';
import { useForm } from 'react-hook-form';
import toast from 'react-hot-toast';
import {
  EnvelopeIcon, ClockIcon,
} from '@heroicons/react/24/outline';
import { Check } from 'lucide-react';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import Button from '@/components/ui/Button';
import { contactService } from '@/services/contact.service';

const CONTACT_INFO = [
  {
    icon: EnvelopeIcon,
    label: 'Email',
    value: 'support@skillhub.et',
    link: 'mailto:support@skillhub.et',
  },
  {
    icon: ClockIcon,
    label: 'Business Hours',
    value: 'Available 24/7',
    link: null,
  },
];

const SOCIAL_LINKS = [
  {
    label: 'Telegram',
    href: 'https://t.me/Skillhubmarketplace',
    icon: 'TG',
  },
];

export default function ContactPage() {
  const [submitted, setSubmitted] = useState(false);
  const { register, handleSubmit, reset, formState: { errors, isSubmitting } } = useForm();
  const [isLoading, setIsLoading] = useState(false);

  const onSubmit = async (data) => {
    if (isLoading) return;
    setIsLoading(true);
    try {
      await contactService.submitContactMessage({
        name: data.name,
        email: data.email,
        subject: data.subject,
        message: data.message,
      });
      toast.success('Your message has been received. Our team will get back to you within 24 hours.');
      reset();
      setSubmitted(true);
      setTimeout(() => setSubmitted(false), 8000);
    } catch (error) {
      const message = error?.response?.data?.message || 'We couldn\'t send your message. Please check your information and try again.';
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="premium-dark-page">
    <div className="page-container max-w-6xl">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="text-center mb-12"
      >
        <h1 className="text-4xl font-black text-gray-900 dark:text-white mb-3">
          Contact Us
        </h1>
        <p className="text-lg text-gray-500 dark:text-gray-400 max-w-xl mx-auto">
          Have a question, suggestion, or need help? We are here for you.
          Our team responds within 24 hours.
        </p>
      </motion.div>

      <div className="grid lg:grid-cols-5 gap-10">
        {/* Contact Info */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
          className="lg:col-span-2 space-y-6"
        >
          <div className="card p-6 space-y-5">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white">Get in Touch</h2>
            {CONTACT_INFO.map(({ icon: Icon, label, value, link }) => (
              <div key={label} className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center flex-shrink-0">
                  <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                </div>
                <div>
                  <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-0.5">
                    {label}
                  </p>
                  {link ? (
                    <a
                      href={link}
                      target={link.startsWith('http') ? '_blank' : undefined}
                      rel="noopener noreferrer"
                      className="text-sm text-gray-700 dark:text-gray-200 hover:text-primary-600 transition-colors"
                    >
                      {value}
                    </a>
                  ) : (
                    <p className="text-sm text-gray-700 dark:text-gray-200">{value}</p>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Social links */}
          <div className="card p-6">
            <h2 className="font-bold text-sm text-gray-900 dark:text-white mb-4 uppercase tracking-wider">
              Follow Us
            </h2>
            <div className="flex gap-3">
              {SOCIAL_LINKS.map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 p-2.5 rounded-lg border border-gray-100 dark:border-gray-700 hover:border-primary-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition-all text-sm text-gray-600 dark:text-gray-300"
                >
                  <span className="w-7 h-7 rounded-lg bg-primary-600 text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                    {s.icon}
                  </span>
                  {s.label}
                </a>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Contact Form */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.15 }}
          className="lg:col-span-3"
        >
          <div className="card p-8">
            <h2 className="font-bold text-lg text-gray-900 dark:text-white mb-6">
              Send us a Message
            </h2>

            {submitted ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center py-12"
              >
                <div className="w-16 h-16 rounded-full bg-green-100 dark:bg-green-900/30 flex items-center justify-center mx-auto mb-4">
                  <Check size={30} className="text-green-600" strokeWidth={3} />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2">
                  Message Received!
                </h3>
                <p className="text-sm text-gray-500 dark:text-gray-400">
                  Thank you for reaching out. Your message has been received and our
                  team will respond within 24 hours.
                </p>
              </motion.div>
            ) : (
              <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                <div className="grid sm:grid-cols-2 gap-4">
                  <Input
                    label="Your Name"
                    placeholder="Abebe Kebede"
                    error={errors.name?.message}
                    {...register('name', { required: 'Name is required' })}
                  />
                  <Input
                    label="Email Address"
                    type="email"
                    placeholder="you@example.com"
                    error={errors.email?.message}
                    {...register('email', {
                      required: 'Email is required',
                      pattern: { value: /\S+@\S+\.\S+/, message: 'Invalid email' },
                    })}
                  />
                </div>

                <div>
                  <label className="label">Subject</label>
                  <select
                    className="input"
                    {...register('subject', { required: 'Please select a subject' })}
                  >
                    <option value="">Select a subject…</option>
                    <option value="General Inquiry">General Inquiry</option>
                    <option value="Technical Support">Technical Support</option>
                    <option value="Billing & Payments">Billing & Payments</option>
                    <option value="Dispute Resolution">Dispute Resolution</option>
                    <option value="Partnership">Partnership</option>
                    <option value="Feedback">Feedback</option>
                    <option value="Other">Other</option>
                  </select>
                  {errors.subject && <p className="error-msg">{errors.subject.message}</p>}
                </div>

                <Textarea
                  label="Message"
                  rows={6}
                  placeholder="Describe your question or issue in detail…"
                  error={errors.message?.message}
                  {...register('message', {
                    required: 'Message is required',
                    minLength: { value: 20, message: 'Message must be at least 20 characters' },
                  })}
                />

                <Button type="submit" className="w-full btn-lg" loading={isLoading} disabled={isLoading || isSubmitting}>
                  Send Message
                </Button>

                <p className="text-xs text-center text-gray-400">
                  We respect your privacy. Your information will never be shared.
                </p>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </div>
    </div>
  );
}
