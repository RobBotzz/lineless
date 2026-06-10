import { Wordmark } from '../shared';

export default function OrganizerFooter() {
  return (
    <footer className="border-t border-border pt-10">
      <div className="grid grid-cols-1 gap-8 pb-8 sm:grid-cols-2 md:grid-cols-3">
        <div className="flex flex-col items-start gap-2">
          <Wordmark underline={false} />
          <p className="mt-1 text-sm leading-relaxed text-text-muted">
            Smarter guest flow for better event experiences.
          </p>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text">Sitemap</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-text-muted">
            <a className="hover:text-text hover:underline transition-colors" href="#home">
              Home
            </a>
            <a className="hover:text-text hover:underline transition-colors" href="#impact">
              Impact
            </a>
            <a className="hover:text-text hover:underline transition-colors" href="#pricing">
              Pricing
            </a>
          </div>
        </div>

        <div>
          <p className="text-xs font-semibold uppercase tracking-widest text-text">Legal</p>
          <div className="mt-3 flex flex-col gap-2 text-sm text-text-muted">
            <a className="hover:text-text hover:underline transition-colors" href="#">
              Impressum
            </a>
            <a className="hover:text-text hover:underline transition-colors" href="#">
              Privacy Policy
            </a>
            <a className="hover:text-text hover:underline transition-colors" href="#">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
