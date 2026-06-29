import { LegalPage, LegalSection } from './LegalPage';

// Placeholder GDPR privacy policy for a non-commercial student project. The
// controller details, processors and retention periods below must be reviewed
// and completed (e.g. confirm your hosting provider and Stripe entity) before
// any public launch.
export default function PrivacyPolicy() {
  return (
    <LegalPage
      title="Privacy Policy"
      lastUpdated="June 2026"
      intro={
        <p>
          This policy explains how Lineless processes personal data when you use the platform. We
          process data only as needed to run the service and in line with the EU General Data
          Protection Regulation (GDPR).
        </p>
      }
    >
      <LegalSection heading="Controller">
        <p>The controller responsible for data processing on this website is:</p>
        <p className="text-text">Robin Böck, Amelie Frenzel, Tim Michalow &amp; Daniel Sich</p>
        <p>
          Boltzmannstraße 15, 85748 Garching, Germany
          <br />
          Email:{' '}
          <a className="text-accent hover:underline" href="mailto:contact@lineless.shop">
            contact@lineless.shop
          </a>
        </p>
      </LegalSection>

      <LegalSection heading="What data we process">
        <p>Depending on how you use the platform, we process:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>
            <span className="text-text">Organizer accounts:</span> name, email address and a hashed
            password.
          </li>
          <li>
            <span className="text-text">Attendees:</span> a per-event session identifier stored on
            your device, your cart and order details.
          </li>
          <li>
            <span className="text-text">Orders &amp; payments:</span> ordered items, amounts and
            payment status. Card payments are handled by our payment provider (see below) — we do
            not store full card details.
          </li>
          <li>
            <span className="text-text">Technical data:</span> data your browser transmits
            automatically (e.g. IP address, timestamp) in server logs.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Purposes and legal bases">
        <ul className="list-disc space-y-1 pl-5">
          <li>
            Providing the service, accounts, ordering and payment — Art. 6 (1)(b) GDPR (performance
            of a contract).
          </li>
          <li>
            Security, abuse prevention and stable operation — Art. 6 (1)(f) GDPR (legitimate
            interests).
          </li>
          <li>
            Any optional features that require it — Art. 6 (1)(a) GDPR (consent), which you can
            withdraw at any time.
          </li>
        </ul>
      </LegalSection>

      <LegalSection heading="Cookies and local storage">
        <p>
          We use only strictly necessary storage — for example a session identifier and login
          credentials kept in your browser — to make the platform work. These are required for the
          service you requested (§ 25 (2) TDDDG) and are not used for tracking or advertising. We do
          not use analytics or marketing cookies.
        </p>
      </LegalSection>

      <LegalSection heading="Payment processing">
        <p>
          Card payments are processed by Stripe. When you pay, the data needed for the transaction
          is transmitted to and processed by Stripe as an independent controller / processor. Please
          refer to Stripe&apos;s privacy policy at{' '}
          <a
            className="text-accent hover:underline"
            href="https://stripe.com/privacy"
            rel="noreferrer"
            target="_blank"
          >
            stripe.com/privacy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Recipients and processors">
        <p>
          We share data only where necessary to operate the service — in particular with our hosting
          provider and our payment provider (Stripe) — and only under appropriate data-processing
          agreements. We do not sell personal data.
        </p>
      </LegalSection>

      <LegalSection heading="Retention">
        <p>
          We keep personal data only as long as necessary for the purposes above or as required by
          law, and delete or anonymize it afterwards. Order and payment records may be retained to
          meet legal obligations.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>Under the GDPR you have the right to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>access your personal data (Art. 15);</li>
          <li>rectification (Art. 16) and erasure (Art. 17);</li>
          <li>restriction of processing (Art. 18);</li>
          <li>data portability (Art. 20);</li>
          <li>object to processing based on legitimate interests (Art. 21);</li>
          <li>withdraw consent at any time, with effect for the future.</li>
        </ul>
        <p>
          To exercise any of these rights, contact us at{' '}
          <a className="text-accent hover:underline" href="mailto:contact@lineless.shop">
            contact@lineless.shop
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection heading="Right to lodge a complaint">
        <p>
          You have the right to lodge a complaint with a data protection supervisory authority. For
          this project, the competent authority is the Bavarian State Office for Data Protection
          Supervision (BayLDA).
        </p>
      </LegalSection>
    </LegalPage>
  );
}
