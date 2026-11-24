const PLATFORM_KNOWLEDGE = `
## WHAT IS SKILLHUB?
SkillHub is a freelance marketplace connecting Ethiopian web developers with local and international clients. It supports jobs, proposals, escrow payments, milestones, reviews, AI-powered tools, and more. The platform is built with React (Vite) on the frontend and Express.js + MongoDB on the backend.

## REGISTRATION & ACCOUNT
- Users sign up at skillhub.dev as either a freelancer or client
- Email verification is required after signup (24-hour expiry link)
- Profile completion increases visibility and trust
- Freelancers can list skills, portfolio, certifications, and experience
- Clients can post company info and project preferences
- Password requirements: 8+ chars, uppercase, lowercase, number, special char
- Sessions managed via JWT (15-min access, 7-day refresh tokens)

## LOGIN & SECURITY
- Login at skillhub.dev/login with email and password
- Password reset: Click "Forgot Password" on login page, enter email, follow the reset link (1-hour expiry)
- If locked out, use password reset or create a support ticket
- Strong password required: 8+ chars, uppercase, lowercase, number, special char
- Multiple active sessions supported (max 5 refresh tokens)

## FREELANCER DASHBOARD
- Active projects, pending proposals, earnings overview
- Quick access to messages, notifications, and wallet
- Skill assessment results and reputation score
- Portfolio showcase and profile completion status
- Recent activity and upcoming milestones
- AI-powered job matching suggestions

## CLIENT DASHBOARD
- Posted jobs, active projects, hired freelancers
- Budget overview and spending analytics
- Quick access to post new jobs and review proposals
- Escrow status and payment history

## JOB POSTING & DISCOVERY
- Clients post jobs with title, description, skills required, budget, and timeline
- Jobs appear on the job board for freelancers to browse
- Freelancers can filter by skills, budget, job type (fixed/hourly)
- AI-powered matching suggests relevant jobs to freelancers
- Job categories: Web Dev, Mobile Dev, UI/UX, Backend, DevOps, Content

## PROPOSAL SYSTEM
- Freelancers submit proposals on jobs they're interested in
- Proposal includes cover letter, rate, timeline, and relevant experience
- AI assistance helps freelancers write compelling proposals
- Clients review proposals, compare freelancers, and shortlist candidates
- Freelancers can track proposal status (pending, shortlisted, accepted, rejected)

## HIRING & CONTRACTS
- Clients hire freelancers by selecting from proposals
- A contract is created with agreed terms, milestones, and payment schedule
- Both parties communicate through the project messaging system
- Contract terms are binding and enforced by the platform

## ESCROW PAYMENT SYSTEM
- Client funds escrow before work begins
- Funds held securely on SkillHub during the project
- Upon milestone completion and client approval, funds release to freelancer
- 10% platform commission deducted on release
- Disputes can be opened if there's disagreement about work quality
- Escrow protects both parties — clients pay only for approved work, freelancers get guaranteed payment

## WALLET SYSTEM
- Each user has a wallet for managing funds
- Deposit via Stripe (international cards) or Chapa (Ethiopian mobile money/bank)
- Freelancer earnings from completed projects go to wallet
- Track balance, pending, and escrowed amounts
- Transaction history with filters and search

## PAYMENTS & FEES
- 10% platform commission on all completed transactions
- No fees for deposits
- Stripe: supports major credit/debit cards worldwide
- Chapa: supports Ethiopian birr (ETB) via mobile money and bank transfer
- Payment processing is PCI-compliant and secure

## WITHDRAWALS
- Minimum withdrawal: 10 ETB
- Methods: Stripe (1-3 business days), Chapa (instant to 24 hours for ETB)
- Withdraw from wallet page → click "Withdraw" → choose method → confirm
- Account verification recommended for faster processing

## MILESTONES
- Break projects into manageable, payable stages
- Each milestone has a description, amount, and deadline
- Client funds each milestone in escrow
- Freelancer submits work, client reviews and approves
- Upon approval, milestone funds release to freelancer
- Best practices: keep milestones small, set clear criteria, fund before work begins

## REVIEWS & REPUTATION
- After project completion, both parties rate each other (1-5 stars)
- Optional written review accompanies the rating
- Reputation score based on: ratings, completion rate, response time, dispute history
- Higher reputation = better visibility in search results
- Freelancers earn reputation through positive reviews and successful projects

## AI-POWERED FEATURES
- AI proposal writing assistance for freelancers
- AI job matching based on skills and preferences
- AI skill gap detection and learning recommendations
- AI code review for submitted work
- AI resume and portfolio builder
- AI interview preparation and coding challenges
- AI notification prioritization
- AI fraud and spam detection
- AI cost estimation for projects

## NOTIFICATIONS
- In-app notifications (bell icon in header)
- Email notifications for important events
- Push notifications (browser, if enabled)
- Types: job invitations, project updates, messages, payments, reviews
- Quiet hours: set times when notifications are suppressed
- AI prioritizes notifications by urgency and relevance

## MESSAGING & COMMUNICATION
- Real-time chat between clients and freelancers
- File sharing, code snippets, and read receipts
- All project communication should happen on-platform
- Message history is preserved for record-keeping

## TEAM HIRING
- For complex projects, hire a team of freelancers
- Define roles (frontend, backend, designer, etc.)
- Assign tasks and manage through shared dashboard
- Team chat, budget allocation per role, milestone management
- AI recommendations for team composition

## LEARNING HUB
- Skill gap analysis based on market demand
- Recommended courses and certifications
- Personalized learning paths
- Track progress and earn completion badges

## RESUME & PORTFOLIO BUILDER
- AI-powered resume generation from profile data
- Multiple templates (Professional, Creative, Minimal, Executive)
- PDF export with custom sections
- Portfolio site generator with live preview
- Custom domain support

## CONTRACTS & DISPUTES
- Contracts are created when a freelancer is hired
- Terms include scope, milestones, payment schedule, timeline
- If issues arise: communicate first, then open dispute
- Dispute resolution: mediation by support team
- Possible outcomes: revision, partial payment, full refund

## CANCELLATION POLICY
- Before work begins: cancel without penalty, full refund
- During project: discuss with freelancer, then request cancellation
- After approval: no refund, disputes accepted within 7 days
- Escrow returns to client for unapproved work

## ADMIN FEATURES
- User management and moderation
- Ticket support system
- Platform analytics and reporting
- Fraud and spam detection
- Content moderation

## MOBILE ACCESS
- Responsive web platform accessible on mobile browsers
- Full feature access: jobs, messaging, projects, wallet
- Add to home screen for app-like experience
- Native apps coming soon
`.trim();

const ROLE_CONTEXT = {
  freelancer: `
## USER ROLE: FREELANCER
This user is a freelancer on SkillHub. Tailor your responses to help them with:
- Finding and applying to jobs
- Writing compelling proposals (use AI proposal assistance)
- Managing projects and milestones
- Tracking earnings and withdrawals
- Building their profile, portfolio, and reputation
- Taking skill assessments
- Using the resume and portfolio builder
- Team hiring and collaboration
- Learning recommendations and skill gap analysis
When they ask general questions, prefer freelancer-relevant answers.`,
  client: `
## USER ROLE: CLIENT
This user is a client on SkillHub. Tailor your responses to help them with:
- Posting jobs with clear descriptions and requirements
- Reviewing and shortlisting proposals
- Hiring freelancers and setting up contracts
- Managing escrow payments and milestones
- Communicating with freelancers
- Resolving disputes if they arise
- Budget management and cost estimation
- Finding the right freelancer for their project
When they ask general questions, prefer client-relevant answers.`,
  admin: `
## USER ROLE: ADMIN
This user is an admin on SkillHub. Tailor your responses to help them with:
- User management and moderation
- Support ticket resolution
- Platform analytics and reporting
- Fraud detection and content moderation
- System configuration and settings
- Understanding platform metrics and health
When they ask general questions, prefer admin-relevant answers.`,
};

export function getPlatformKnowledge() {
  return PLATFORM_KNOWLEDGE;
}

export function getRoleContext(role) {
  return ROLE_CONTEXT[role] || '';
}

export function searchKnowledge(query) {
  const lowerQuery = query.toLowerCase();
  const sections = PLATFORM_KNOWLEDGE.split('\n## ').filter(Boolean);
  const matches = [];

  for (const section of sections) {
    const lines = section.split('\n');
    const header = lines[0].replace(/^#+ /, '');
    const body = section.toLowerCase();

    const words = lowerQuery.split(/\s+/).filter((w) => w.length > 2);
    let score = 0;
    for (const word of words) {
      if (body.includes(word)) score++;
    }

    if (score > 0) {
      matches.push({ header, content: section, score });
    }
  }

  matches.sort((a, b) => b.score - a.score);

  return matches.slice(0, 3).map((m) => m.content).join('\n\n');
}
