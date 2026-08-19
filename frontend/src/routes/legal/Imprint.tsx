import { LegalPage, LegalSection } from './LegalPage';

// Placeholder legal notice for a non-commercial student project (no company /
// legal form). Replace the names, address and contact below with the real,
// reachable details, and have the wording reviewed before any public launch.
export default function Imprint() {
  return (
    <LegalPage
      title="Imprint"
      lastUpdated="June 2026"
      intro={
        <p>
          Lineless is a non-commercial student project. It is not operated by a company and is not
          entered in any commercial register.
        </p>
      }
    >
      <LegalSection heading="Information pursuant to § 5 DDG">
        <p>This website is jointly operated by:</p>
        <p className="text-text">Robin Böck, Amelie Frenzel, Tim Michalow &amp; Daniel Sich</p>
        <p>
          Boltzmannstraße 15
          <br />
          85748 Garching, Germany
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Email:{' '}
          <a className="text-accent hover:underline" href="mailto:contact@lineless.shop">
            contact@lineless.shop
          </a>
        </p>
      </LegalSection>

      <LegalSection heading="Responsible for the content (§ 18 (2) MStV)">
        <p>
          Robin Böck
          <br />
          Boltzmannstraße 15, 85748 Garching, Germany
        </p>
      </LegalSection>

      <LegalSection heading="Liability for content">
        <p>
          As a service provider we are responsible for our own content on these pages in accordance
          with general law. We are not obliged to monitor transmitted or stored third-party
          information, or to investigate circumstances that indicate illegal activity. Obligations
          to remove or block the use of information under general law remain unaffected; any
          liability in this regard is only possible from the point in time at which a concrete
          infringement of the law becomes known. Upon becoming aware of such infringements, we will
          remove the content immediately.
        </p>
      </LegalSection>

      <LegalSection heading="Liability for links">
        <p>
          Our site contains links to external websites over whose content we have no control. We
          therefore cannot accept any liability for this third-party content. The respective
          provider or operator of the linked pages is always responsible for their content. We will
          remove such links immediately upon becoming aware of any legal infringement.
        </p>
      </LegalSection>

      <LegalSection heading="Online dispute resolution">
        <p>
          The European Commission provides a platform for online dispute resolution (ODR):{' '}
          <a
            className="text-accent hover:underline"
            href="https://ec.europa.eu/consumers/odr/"
            rel="noreferrer"
            target="_blank"
          >
            https://ec.europa.eu/consumers/odr/
          </a>
          . We are neither obliged nor willing to participate in dispute resolution proceedings
          before a consumer arbitration board.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
