import LegalPage from '../legal/LegalPage';

export default function PrivacyPage() {
  return (
    <LegalPage title="Privacy Policy" subtitle="How we collect, use, and protect your personal information" lastUpdated="January 1, 2026">
      <h2>1. Information We Collect</h2>
      <p>We collect information you provide directly and information generated through your use of the Platform.</p>
      <ul>
        <li><strong>Account Information:</strong> Name, email, phone number, profile photo, and professional details.</li>
        <li><strong>Payment Information:</strong> Bank account details and transaction history (processed securely via our payment partners).</li>
        <li><strong>Content:</strong> Proposals, messages, portfolio items, and job postings you create.</li>
        <li><strong>Usage Data:</strong> Pages visited, features used, time spent, and interaction patterns.</li>
        <li><strong>Device Data:</strong> Browser type, operating system, IP address, and device identifiers.</li>
      </ul>

      <h2>2. How We Use Your Information</h2>
      <ul>
        <li>Provide, maintain, and improve the Platform.</li>
        <li>Process transactions and send related information.</li>
        <li>Match freelancers with relevant job opportunities.</li>
        <li>Send notifications, updates, and marketing communications (with opt-out).</li>
        <li>Detect and prevent fraud, abuse, and security incidents.</li>
        <li>Comply with legal obligations.</li>
      </ul>

      <h2>3. Information Sharing</h2>
      <p>We do not sell your personal information. We may share information with:</p>
      <ul>
        <li><strong>Other users:</strong> Your profile information is visible to clients/freelancers as needed for platform functionality.</li>
        <li><strong>Service providers:</strong> Payment processors, cloud hosting, analytics, and communication tools.</li>
        <li><strong>Legal authorities:</strong> When required by law or to protect rights and safety.</li>
      </ul>

      <h2>4. Data Security</h2>
      <p>We implement industry-standard security measures including encryption in transit (TLS), encryption at rest, access controls, and regular security audits. However, no method of transmission is 100% secure.</p>

      <h2>5. Data Retention</h2>
      <p>We retain your information for as long as your account is active or as needed to provide services. After account deletion, we may retain certain data for up to 90 days for legal and operational purposes.</p>

      <h2>6. Your Rights</h2>
      <ul>
        <li>Access and download your personal data.</li>
        <li>Correct inaccurate information.</li>
        <li>Request deletion of your account and data.</li>
        <li>Opt out of marketing communications.</li>
        <li>Restrict processing of your data in certain circumstances.</li>
      </ul>

      <h2>7. Cookies & Tracking</h2>
      <p>We use cookies and similar technologies for authentication, preferences, analytics, and marketing. You can manage cookie preferences through your browser settings.</p>

      <h2>8. International Transfers</h2>
      <p>Your data may be processed in Ethiopia or other countries where our service providers operate. We ensure appropriate safeguards are in place for international transfers.</p>

      <h2>9. Children's Privacy</h2>
      <p>The Platform is not intended for users under 18. We do not knowingly collect data from children.</p>

      <h2>10. Changes to This Policy</h2>
      <p>We may update this policy periodically. Material changes will be communicated via email or platform notification.</p>

      <h2>11. Contact</h2>
      <p>Privacy concerns? Reach us at <strong>privacy@skillhub.et</strong> or visit our <a href="/contact">Contact page</a>.</p>
    </LegalPage>
  );
}
