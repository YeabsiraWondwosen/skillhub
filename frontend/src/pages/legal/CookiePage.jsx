import LegalPage from '../legal/LegalPage';

export default function CookiePage() {
  return (
    <LegalPage title="Cookie Policy" subtitle="How we use cookies and similar technologies" lastUpdated="January 1, 2026">
      <h2>1. What Are Cookies</h2>
      <p>Cookies are small text files placed on your device when you visit a website. They help us recognize your browser and remember certain information.</p>

      <h2>2. How We Use Cookies</h2>
      <ul>
        <li><strong>Essential Cookies:</strong> Required for authentication, security, and core platform functionality. These cannot be disabled.</li>
        <li><strong>Preference Cookies:</strong> Remember your settings such as language, dark mode, and display preferences.</li>
        <li><strong>Analytics Cookies:</strong> Help us understand how users interact with the Platform, which pages are most popular, and where errors occur.</li>
        <li><strong>Marketing Cookies:</strong> Used to deliver relevant advertisements and track campaign performance.</li>
      </ul>

      <h2>3. Specific Cookies We Use</h2>
      <ul>
        <li><strong>session_token:</strong> Maintains your authenticated session (essential).</li>
        <li><strong>refresh_token:</strong> Enables automatic session renewal (essential).</li>
        <li><strong>dark_mode:</strong> Stores your theme preference (preference).</li>
        <li><strong>language:</strong> Stores your language preference (preference).</li>
        <li><strong>_ga, _gid:</strong> Google Analytics cookies for usage statistics (analytics).</li>
      </ul>

      <h2>4. Third-Party Cookies</h2>
      <p>Some cookies are placed by third-party services embedded in our Platform, including analytics providers and payment processors. These parties have their own privacy policies.</p>

      <h2>5. Managing Cookies</h2>
      <p>You can control cookies through your browser settings. Disabling essential cookies may prevent the Platform from functioning correctly.</p>
      <ul>
        <li><strong>Chrome:</strong> Settings &gt; Privacy and Security &gt; Cookies</li>
        <li><strong>Firefox:</strong> Settings &gt; Privacy &amp; Security &gt; Cookies</li>
        <li><strong>Safari:</strong> Preferences &gt; Privacy &gt; Cookies</li>
      </ul>

      <h2>6. Do Not Track</h2>
      <p>We honor "Do Not Track" signals where supported by your browser.</p>

      <h2>7. Changes to This Policy</h2>
      <p>We may update this Cookie Policy from time to time. Changes will be posted on this page with an updated revision date.</p>

      <h2>8. Contact</h2>
      <p>Questions about our cookie practices? Contact us at <strong>privacy@skillhub.et</strong>.</p>
    </LegalPage>
  );
}
