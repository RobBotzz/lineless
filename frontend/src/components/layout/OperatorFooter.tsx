import logoPlaceholder from '../../assets/LLlogo.png';

export default function OperatorFooter() {
  return (
    <footer className="border-t border-[var(--color-border)] pt-10">
      <div className="grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col items-start gap-2">
          <img
            src={logoPlaceholder}
            alt="lineless logo"
            className="h-12 w-12 sm:h-14 sm:w-14 object-contain"
          />
          <p className="mt-0 text-sm text-[var(--color-text-muted)]">
            Smarter guest flow for better event experiences.
          </p>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
            Sitemap
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <a className="hover:underline" href="#home">
              Home
            </a>
            <a className="hover:underline" href="#impact">
              Impact
            </a>
            <a className="hover:underline" href="#pricing">
              Pricing
            </a>
          </div>
        </div>

        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-[var(--color-text)]">
            Legal
          </p>
          <div className="mt-3 flex flex-col gap-2 text-sm">
            <a className="hover:underline" href="#">
              Impressum
            </a>
            <a className="hover:underline" href="#">
              Privacy Policy
            </a>
            <a className="hover:underline" href="#">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
