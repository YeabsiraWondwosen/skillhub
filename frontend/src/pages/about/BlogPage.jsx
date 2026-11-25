import { motion } from 'framer-motion';
import { Link } from 'react-router-dom';
import { CalendarIcon, ArrowRightIcon, TagIcon, CheckBadgeIcon, RocketLaunchIcon } from '@heroicons/react/24/outline';

const fadeUp = { hidden: { opacity: 0, y: 20 }, show: { opacity: 1, y: 0 } };
const fadeLeft = { hidden: { opacity: 0, x: -30 }, show: { opacity: 1, x: 0 } };
const fadeRight = { hidden: { opacity: 0, x: 30 }, show: { opacity: 1, x: 0 } };
const stagger = { hidden: {}, show: { transition: { staggerChildren: 0.08 } } };

const FEATURES = [
  'Industry Insights',
  'Freelancing Tips',
  'Career Development',
  'Product Updates',
  'Success Stories',
  'AI & Technology',
];

const POSTS = [
  {
    title: 'Introducing SkillHub: The Future of Freelancing in Ethiopia',
    excerpt: 'We\'re excited to launch Ethiopia\'s first multi-category freelance marketplace. Learn about our vision, features, and what\'s coming next.',
    date: 'Jan 15, 2026',
    tag: 'Announcement',
    tagColor: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400',
  },
  {
    title: 'How to Write a Winning Freelancer Profile',
    excerpt: 'Your profile is your first impression. Here are 7 tips to create a profile that attracts clients and wins projects.',
    date: 'Jan 22, 2026',
    tag: 'Guide',
    tagColor: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500',
  },
  {
    title: 'Understanding Escrow: How SkillHub Protects Your Payments',
    excerpt: 'A deep dive into our escrow system — how it works, why it matters, and how both clients and freelancers benefit.',
    date: 'Feb 3, 2026',
    tag: 'Education',
    tagColor: 'bg-warning-50 text-warning-700 dark:bg-warning-500/10 dark:text-warning-500',
  },
  {
    title: 'Top 10 In-Demand Skills on SkillHub in 2026',
    excerpt: 'Based on our data, these skills are seeing the highest demand from clients. Find out where the opportunities are.',
    date: 'Feb 10, 2026',
    tag: 'Insights',
    tagColor: 'bg-secondary-50 text-secondary-600 dark:bg-secondary-900/20 dark:text-secondary-400',
  },
  {
    title: 'Building Trust: How Freelancer Verification Works',
    excerpt: 'Learn how identity, GitHub, and portfolio verification build trust, why verified badges increase your chances of winning projects, and how to get verified.',
    date: 'Feb 18, 2026',
    tag: 'Guide',
    tagColor: 'bg-success-50 text-success-700 dark:bg-success-500/10 dark:text-success-500',
  },
  {
    title: 'SkillHub Roadmap: What\'s Coming in Q2 2026',
    excerpt: 'AI-powered matching, team hiring, advanced analytics, and more. Here\'s what we\'re building next.',
    date: 'Mar 1, 2026',
    tag: 'Product',
    tagColor: 'bg-primary-50 text-primary-600 dark:bg-primary-900/20 dark:text-primary-400',
  },
];

export default function BlogPage() {
  return (
    <div className="min-h-screen premium-dark-page">
      {/* Split Hero */}
      <section className="bg-gray-50 dark:bg-dark-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16 lg:py-24">
          <div className="grid lg:grid-cols-5 gap-10 lg:gap-16 items-center">
            {/* Left — Image (45%) */}
            <motion.div
              variants={fadeLeft}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
              className="lg:col-span-2"
            >
              <div className="relative group">
                <img
                  src="https://images.unsplash.com/photo-1531482615713-2afd69097998?w=800&q=80&auto=format&fit=crop"
                  alt="SkillHub community insights"
                  loading="lazy"
                  decoding="async"
                  className="w-full aspect-[4/3] object-cover rounded-[20px] shadow-lg shadow-gray-200 dark:shadow-black/30 transition-transform duration-500 ease-out group-hover:scale-[1.03]"
                />
                {/* Decorative accent */}
                <div className="absolute -bottom-3 -right-3 w-24 h-24 rounded-2xl bg-gradient-to-br from-primary-500 to-secondary-500 opacity-20 blur-sm -z-10" />
                <div className="absolute -top-3 -left-3 w-16 h-16 rounded-2xl bg-gradient-to-br from-primary-400 to-secondary-400 opacity-10 blur-sm -z-10" />
              </div>
            </motion.div>

            {/* Right — Content (55%) */}
            <motion.div
              variants={fadeRight}
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, ease: 'easeOut', delay: 0.15 }}
              className="lg:col-span-3"
            >
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-300 text-xs font-semibold mb-5">
                <RocketLaunchIcon className="w-3.5 h-3.5" />
                Blog
              </span>

              <h1 className="text-3xl lg:text-4xl xl:text-5xl font-black text-gray-900 dark:text-white leading-tight mb-5">
                Insights &amp; Updates
              </h1>

              <p className="text-gray-500 dark:text-gray-400 text-lg leading-relaxed mb-4 max-w-xl">
                Tips, guides, product updates, and stories from the SkillHub community.
              </p>

              <p className="text-gray-500 dark:text-gray-400 text-sm leading-relaxed mb-8 max-w-lg">
                Stay ahead with expert advice on freelancing, career growth, and the latest platform features.
                Whether you are just starting out or scaling your business, our blog has something for you.
              </p>

              {/* Feature highlights */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-x-6 gap-y-2.5 mb-10">
                {FEATURES.map((feature) => (
                  <div key={feature} className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-300">
                    <CheckBadgeIcon className="w-4 h-4 text-primary-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>

              {/* CTA Buttons */}
              <div className="flex flex-wrap gap-3">
                <Link
                  to="/blog"
                  className="btn bg-primary-600 text-white hover:bg-primary-700 btn-lg font-bold shadow-md shadow-primary-500/20"
                >
                  Explore Articles
                  <ArrowRightIcon className="w-5 h-5 ml-2" />
                </Link>
                <Link
                  to="/blog"
                  className="btn border-2 border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 btn-lg font-bold"
                >
                  Latest Updates
                </Link>
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* Posts */}
      <section className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-12 lg:py-16">
        <motion.div variants={stagger} initial="hidden" whileInView="show" viewport={{ once: true }} className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {POSTS.map((post) => (
            <motion.article key={post.title} variants={fadeUp} className="group p-5 rounded-2xl bg-white dark:bg-dark-800 border border-gray-100 dark:border-gray-700/50 shadow-card hover:shadow-card-hover transition-all duration-300">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${post.tagColor}`}>{post.tag}</span>
              </div>
              <h3 className="font-bold text-gray-900 dark:text-white mb-2 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors leading-snug">{post.title}</h3>
              <p className="text-sm text-gray-500 dark:text-gray-400 mb-4 leading-relaxed line-clamp-3">{post.excerpt}</p>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs text-gray-400">
                  <CalendarIcon className="w-3.5 h-3.5" /> {post.date}
                </div>
                <span className="text-xs font-semibold text-primary-600 dark:text-primary-400 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  Read more <ArrowRightIcon className="w-3 h-3" />
                </span>
              </div>
            </motion.article>
          ))}
        </motion.div>
      </section>
    </div>
  );
}
