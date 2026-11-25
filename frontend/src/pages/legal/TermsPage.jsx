import LegalPage from '../legal/LegalPage';

export default function TermsPage() {
  return (
    <LegalPage title="Terms of Service" subtitle="The rules and guidelines for using SkillHub" lastUpdated="January 1, 2026">
      <h2>1. Acceptance of Terms</h2>
      <p>By accessing or using SkillHub ("Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.</p>

      <h2>2. Eligibility</h2>
      <p>You must be at least 18 years old to create an account. By registering, you represent that you meet this requirement and have the legal capacity to enter binding agreements.</p>

      <h2>3. Account Registration</h2>
      <ul>
        <li>You must provide accurate, complete information during registration.</li>
        <li>You are responsible for maintaining the confidentiality of your credentials.</li>
        <li>You must notify us immediately of any unauthorized use of your account.</li>
        <li>One person may not maintain more than one account.</li>
      </ul>

      <h2>4. Platform Role</h2>
      <p>SkillHub acts as an intermediary connecting clients and freelancers. We are not a party to any agreement between users. We do not guarantee the quality, safety, or legality of services offered.</p>

      <h2>5. Freelancer Obligations</h2>
      <ul>
        <li>Deliver work that meets the agreed-upon specifications and deadlines.</li>
        <li>Maintain professional communication with clients.</li>
        <li>Comply with all applicable laws and platform policies.</li>
        <li>Ensure that work submitted is original and does not infringe on third-party rights.</li>
      </ul>

      <h2>6. Client Obligations</h2>
      <ul>
        <li>Provide clear project requirements and timely feedback.</li>
        <li>Fund escrow before work begins on milestone-based projects.</li>
        <li>Release payment promptly upon satisfactory delivery of milestones.</li>
        <li>Treat freelancers with respect and professionalism.</li>
      </ul>

      <h2>7. Payments & Fees</h2>
      <ul>
        <li>SkillHub charges a 10% service fee on all transactions.</li>
        <li>Payments are processed in Ethiopian Birr (ETB) through our secure payment partners.</li>
        <li>Escrow funds are held securely and released upon milestone approval.</li>
        <li>Refund requests are handled on a case-by-case basis per our dispute resolution policy.</li>
      </ul>

      <h2>8. Escrow System</h2>
      <p>Clients fund milestones into escrow before work begins. Funds are released to freelancers upon milestone approval. Disputed milestones are subject to review by the SkillHub dispute resolution team.</p>

      <h2>9. Dispute Resolution</h2>
      <p>We encourage users to resolve disputes amicably. If resolution fails, either party may escalate to SkillHub support. Our team will review evidence and render a decision, which is binding on both parties.</p>

      <h2>10. Intellectual Property</h2>
      <p>Freelancers retain ownership of their work until payment is received in full. Upon full payment, the client receives full ownership and rights to the delivered work, unless otherwise specified in the contract.</p>

      <h2>11. Prohibited Conduct</h2>
      <ul>
        <li>Fraud, misrepresentation, or identity theft.</li>
        <li>Circumventing platform fees by conducting transactions off-platform.</li>
        <li>Harassment, discrimination, or abusive behavior.</li>
        <li>Posting spam, malware, or misleading content.</li>
        <li>Violating any applicable laws or regulations.</li>
      </ul>

      <h2>12. Account Suspension</h2>
      <p>We reserve the right to suspend or terminate accounts that violate these terms. Suspended users may appeal through our support channel.</p>

      <h2>13. Limitation of Liability</h2>
      <p>SkillHub shall not be liable for any indirect, incidental, or consequential damages arising from your use of the Platform. Our total liability shall not exceed the fees paid by you in the twelve months preceding the claim.</p>

      <h2>14. Modifications</h2>
      <p>We may update these terms from time to time. Continued use of the Platform after changes constitutes acceptance of the modified terms. We will notify users of material changes via email or platform notification.</p>

      <h2>15. Contact</h2>
      <p>Questions about these Terms? Contact us at <strong>legal@skillhub.et</strong> or visit our <a href="/contact">Contact page</a>.</p>
    </LegalPage>
  );
}
