import { useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useAuthStore } from '@/store/authStore';
import { useSupportTickets, useCreateSupportTicket } from '@/hooks/useSupport';
import { useMyBadges } from '@/hooks/useBadges';
import Input from '@/components/ui/Input';
import Button from '@/components/ui/Button';
import Badge from '@/components/ui/Badge';
import {
  QuestionMarkCircleIcon, TicketIcon, ChatBubbleLeftRightIcon,
  BookOpenIcon, CurrencyDollarIcon, UserIcon, WrenchIcon,
  PlusIcon, MagnifyingGlassIcon,
} from '@heroicons/react/24/outline';

const FAQ_ITEMS = [
  { q: 'How do I create an account?', a: 'Click "Create Free Account" on the homepage, choose your role (freelancer or client), and fill in your details. You\'ll need to verify your email address.' },
  { q: 'How does escrow payment work?', a: 'When a client hires a freelancer, funds are held in escrow. The freelancer works on milestones, and upon client approval, funds are released minus the 10% platform fee.' },
  { q: 'How do I withdraw my earnings?', a: 'Go to your Wallet page, click "Withdraw", and choose your preferred method. Funds from completed milestones are available for withdrawal after a brief holding period.' },
  { q: 'What is the platform fee?', a: 'SkillHub charges a 10% commission on all payments. This covers payment processing, platform maintenance, and support services.' },
  { q: 'How do I dispute a project?', a: 'If you have a disagreement with the other party, you can open a dispute from the Project Workspace. Our team will review and mediate the situation.' },
  { q: 'Can I change my account type?', a: 'Currently, you cannot change your role after registration. You would need to create a new account with the desired role.' },
];

const HELP_CATEGORIES = [
  { icon: UserIcon, label: 'Account & Profile', description: 'Registration, login, profile setup', color: 'text-blue-500 bg-blue-50 dark:bg-blue-900/20' },
  { icon: CurrencyDollarIcon, label: 'Payments & Billing', description: 'Deposits, withdrawals, invoices', color: 'text-green-500 bg-green-50 dark:bg-green-900/20' },
  { icon: TicketIcon, label: 'Jobs & Proposals', description: 'Posting, applying, hiring', color: 'text-yellow-500 bg-yellow-50 dark:bg-yellow-900/20' },
  { icon: ChatBubbleLeftRightIcon, label: 'Messaging', description: 'Chat, notifications', color: 'text-purple-500 bg-purple-50 dark:bg-purple-900/20' },
  { icon: WrenchIcon, label: 'Technical Issues', description: 'Bugs, errors, performance', color: 'text-red-500 bg-red-50 dark:bg-red-900/20' },
  { icon: BookOpenIcon, label: 'Guides & Tutorials', description: 'How-to articles', color: 'text-indigo-500 bg-indigo-50 dark:bg-indigo-900/20' },
];

export default function SupportPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState('faq');
  const [openFaq, setOpenFaq] = useState(null);
  const [showTicketForm, setShowTicketForm] = useState(false);
  const [ticketForm, setTicketForm] = useState({ subject: '', category: 'general_inquiry', priority: 'medium', initialMessage: '' });

  const { data: ticketsData } = useSupportTickets({ limit: 10 });
  const { mutate: createTicket, isPending } = useCreateSupportTicket();
  const tickets = ticketsData?.data?.data || [];

  const handleCreateTicket = (e) => {
    e.preventDefault();
    createTicket(ticketForm, {
      onSuccess: () => {
        setShowTicketForm(false);
        setTicketForm({ subject: '', category: 'general_inquiry', priority: 'medium', initialMessage: '' });
      },
    });
  };

  return (
    <div className="page-container max-w-5xl mx-auto space-y-8">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="text-center">
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white mb-2">Help & Support</h1>
        <p className="text-gray-500 dark:text-gray-400">Find answers, get help, or contact our support team</p>
      </motion.div>

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link to="/support/chat" className="card-hover p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-primary-50 dark:bg-primary-900/20 flex items-center justify-center mx-auto mb-3">
            <ChatBubbleLeftRightIcon className="w-6 h-6 text-primary-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">AI Chat Support</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Get instant answers from our AI assistant</p>
        </Link>

        <button onClick={() => { setActiveTab('tickets'); setShowTicketForm(true); }} className="card-hover p-6 text-center">
          <div className="w-12 h-12 rounded-xl bg-green-50 dark:bg-green-900/20 flex items-center justify-center mx-auto mb-3">
            <TicketIcon className="w-6 h-6 text-green-500" />
          </div>
          <h3 className="font-semibold text-gray-900 dark:text-white mb-1">Submit Ticket</h3>
          <p className="text-xs text-gray-500 dark:text-gray-400">Create a support ticket for assistance</p>
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-dark-800 rounded-xl p-1">
        {[
          { id: 'faq', label: 'FAQ' },
          { id: 'categories', label: 'Help Categories' },
          { id: 'tickets', label: 'My Tickets' },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2.5 px-4 rounded-lg text-sm font-medium transition-colors ${
              activeTab === tab.id
                ? 'bg-white dark:bg-dark-700 text-gray-900 dark:text-white shadow-sm'
                : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* FAQ Tab */}
      {activeTab === 'faq' && (
        <div className="space-y-3">
          {FAQ_ITEMS.map((item, i) => (
            <div key={i} className="card overflow-hidden">
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                className="w-full flex items-center justify-between p-4 text-left"
              >
                <span className="font-medium text-gray-900 dark:text-white text-sm">{item.q}</span>
                <svg className={`w-5 h-5 text-gray-400 transition-transform ${openFaq === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              {openFaq === i && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  className="px-4 pb-4"
                >
                  <p className="text-sm text-gray-500 dark:text-gray-400 leading-relaxed">{item.a}</p>
                </motion.div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Categories Tab */}
      {activeTab === 'categories' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {HELP_CATEGORIES.map((cat) => (
            <div key={cat.label} className="card-hover p-5 cursor-pointer" onClick={() => { setActiveTab('tickets'); setShowTicketForm(true); setTicketForm((f) => ({ ...f, category: cat.label.toLowerCase().replace(/ & /g, '_').replace(/ /g, '_') })); }}>
              <div className="flex items-center gap-4">
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${cat.color}`}>
                  <cat.icon className="w-6 h-6" />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900 dark:text-white text-sm">{cat.label}</h3>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{cat.description}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Tickets Tab */}
      {activeTab === 'tickets' && (
        <div className="space-y-4">
          {showTicketForm && (
            <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="card p-6">
              <h3 className="font-semibold text-gray-900 dark:text-white mb-4">Create Support Ticket</h3>
              <form onSubmit={handleCreateTicket} className="space-y-4">
                <Input
                  label="Subject"
                  value={ticketForm.subject}
                  onChange={(e) => setTicketForm({ ...ticketForm, subject: e.target.value })}
                  placeholder="Brief description of your issue"
                  required
                />
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="label">Category</label>
                    <select
                      value={ticketForm.category}
                      onChange={(e) => setTicketForm({ ...ticketForm, category: e.target.value })}
                      className="input"
                    >
                      <option value="general_inquiry">General Inquiry</option>
                      <option value="account_issue">Account Issue</option>
                      <option value="payment_problem">Payment Problem</option>
                      <option value="project_dispute">Project Dispute</option>
                      <option value="technical_issue">Technical Issue</option>
                      <option value="billing">Billing</option>
                      <option value="feature_request">Feature Request</option>
                      <option value="bug_report">Bug Report</option>
                    </select>
                  </div>
                  <div>
                    <label className="label">Priority</label>
                    <select
                      value={ticketForm.priority}
                      onChange={(e) => setTicketForm({ ...ticketForm, priority: e.target.value })}
                      className="input"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="label">Description</label>
                  <textarea
                    value={ticketForm.initialMessage}
                    onChange={(e) => setTicketForm({ ...ticketForm, initialMessage: e.target.value })}
                    className="input min-h-[120px]"
                    placeholder="Describe your issue in detail..."
                    required
                  />
                </div>
                <div className="flex gap-3">
                  <Button type="submit" loading={isPending}>Submit Ticket</Button>
                  <button type="button" onClick={() => setShowTicketForm(false)} className="btn-secondary">Cancel</button>
                </div>
              </form>
            </motion.div>
          )}

          {!showTicketForm && user && (
            <Button onClick={() => setShowTicketForm(true)} className="mb-4">
              <PlusIcon className="w-4 h-4 mr-2" /> New Ticket
            </Button>
          )}

          {tickets.length > 0 ? (
            <div className="space-y-3">
              {tickets.map((ticket) => (
                <Link key={ticket._id} to={`/support/${ticket.ticketId}`} className="card p-4 flex items-center justify-between hover:shadow-md transition-shadow">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-xs font-mono text-gray-400">{ticket.ticketId}</span>
                      <Badge status={ticket.status}>{ticket.status.replace(/_/g, ' ')}</Badge>
                      <Badge status={ticket.priority}>{ticket.priority}</Badge>
                    </div>
                    <h4 className="font-medium text-gray-900 dark:text-white text-sm truncate">{ticket.subject}</h4>
                    <p className="text-xs text-gray-400 mt-0.5">{new Date(ticket.createdAt).toLocaleDateString()}</p>
                  </div>
                </Link>
              ))}
            </div>
          ) : !showTicketForm && (
            <div className="card p-8 text-center">
              <TicketIcon className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-3" />
              <h3 className="font-semibold text-gray-900 dark:text-white mb-1">No tickets yet</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4">Create a support ticket if you need help</p>
              <Button onClick={() => setShowTicketForm(true)}>
                <PlusIcon className="w-4 h-4 mr-2" /> Create Ticket
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
