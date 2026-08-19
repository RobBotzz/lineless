import { Link } from 'react-router';
import { buttonVariants } from '../components/ui/button';
import { Wordmark } from '../components/shared';
import { paths } from '../paths';

export default function NotFound() {
  return (
    <main className="relative flex h-screen flex-col items-center justify-center overflow-hidden bg-background px-6 py-10 text-text">
      <div className="relative w-full max-w-xl text-center">
        <div aria-label="lineless">
          <Wordmark className="text-4xl sm:text-5xl" />
        </div>

        {/* Brand 404 illustration — line art in the accent colour. */}
        <img
          alt="404 — page not found"
          className="mx-auto mt-6 max-h-[40vh] w-full max-w-md object-contain mix-blend-multiply"
          src="/404.png"
        />

        <h1 className="mt-6 text-3xl font-extrabold tracking-tight text-text sm:text-4xl">
          This{' '}
          <span className="underline decoration-accent decoration-2 underline-offset-4">line</span>{' '}
          leads nowhere
        </h1>
        <p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-text-muted sm:text-base">
          The page you’re looking for doesn’t exist or may have been moved.
        </p>

        <Link
          className={`${buttonVariants({ variant: 'default', size: 'lg' })} mt-8 w-full sm:w-auto`}
          to={paths.home}
        >
          Back to home
        </Link>
      </div>
    </main>
  );
}
