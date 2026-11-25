import LegalPage from '../legal/LegalPage';

export default function AccessibilityPage() {
  return (
    <LegalPage title="Accessibility" subtitle="Our commitment to making SkillHub accessible to everyone" lastUpdated="January 1, 2026">
      <h2>Our Commitment</h2>
      <p>SkillHub is committed to ensuring digital accessibility for people with disabilities. We continuously improve the user experience for everyone and apply the relevant accessibility standards.</p>

      <h2>Standards</h2>
      <p>We strive to conform to the Web Content Accessibility Guidelines (WCAG) 2.1 Level AA. These guidelines explain how to make web content more accessible for people with disabilities.</p>

      <h2>Measures Taken</h2>
      <ul>
        <li>Semantic HTML structure with proper heading hierarchy.</li>
        <li>ARIA labels and roles for interactive elements.</li>
        <li>Keyboard navigation support throughout the platform.</li>
        <li>Sufficient color contrast ratios for text readability.</li>
        <li>Alt text for images and descriptive labels for icons.</li>
        <li>Focus indicators for all interactive elements.</li>
        <li>Responsive design that works across all screen sizes.</li>
      </ul>

      <h2>Known Limitations</h2>
      <p>While we aim for full accessibility, some areas may have limitations. We are actively working to address these:</p>
      <ul>
        <li>Some third-party content may not meet our accessibility standards.</li>
        <li>Complex data visualizations may need alternative text descriptions.</li>
        <li>Video content may not always have captions (we\'re working on it).</li>
      </ul>

      <h2>Feedback</h2>
      <p>We welcome your feedback on the accessibility of SkillHub. Please let us know if you encounter accessibility barriers:</p>
      <ul>
        <li>Email: <strong>accessibility@skillhub.et</strong></li>
        <li>Contact form: <a href="/contact">Contact Us</a></li>
      </ul>
      <p>We try to respond to accessibility feedback within 5 business days.</p>

      <h2>Assessment Approach</h2>
      <p>SkillHub assesses accessibility through:</p>
      <ul>
        <li>Automated testing tools (axe, Lighthouse).</li>
        <li>Manual testing with keyboard and screen readers.</li>
        <li>User feedback and accessibility audits.</li>
      </ul>
    </LegalPage>
  );
}
