import { useState } from "react";

type AuthTab = "login" | "signup";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const signupPasswordPattern = /^(?=.*[A-Za-z])(?=.*\d)[A-Za-z\d]{8,}$/;

export default function OrganizerAuth() {
  const [activeTab, setActiveTab] = useState<AuthTab>("login");
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [touched, setTouched] = useState({
    email: false,
    password: false,
  });
  const [submitted, setSubmitted] = useState(false);
  const isSignup = activeTab === "signup";
  const shouldShowEmailError = touched.email || submitted;
  const shouldShowPasswordError = touched.password || submitted;
  const emailError = !email.trim()
    ? "Email is required."
    : !emailPattern.test(email)
      ? "Enter a valid email address."
      : "";
  const passwordError = !password
    ? "Password is required."
    : isSignup && !signupPasswordPattern.test(password)
      ? "Use at least 8 characters with one letter and one number."
      : "";

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitted(true);
  }

  function switchTab(tab: AuthTab) {
    setActiveTab(tab);
    setTouched({ email: false, password: false });
    setSubmitted(false);
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-background px-4 py-8 text-text sm:px-6">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <p className="text-5xl font-black text-accent sm:text-6xl">
            Lineless
          </p>
          <p className="mt-3 text-xs font-semibold uppercase text-text-muted">
            Organizer access
          </p>
        </div>

        <section className="w-full rounded-lg border border-border bg-surface p-6 shadow-[0_24px_80px_rgba(31,41,55,0.1)] sm:p-8">
          <div className="mb-6 grid grid-cols-2 rounded-lg bg-surface-muted p-1">
            <button
              type="button"
              onClick={() => switchTab("login")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeTab === "login"
                  ? "bg-surface text-accent shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Login
            </button>
            <button
              type="button"
              onClick={() => switchTab("signup")}
              className={`rounded-md px-4 py-2 text-sm font-semibold transition ${
                activeTab === "signup"
                  ? "bg-surface text-accent shadow-sm"
                  : "text-text-muted hover:text-text"
              }`}
            >
              Sign up
            </button>
          </div>

          <div className="mb-6">
            <h1 className="text-2xl font-semibold text-text">
              {isSignup ? "Create your account" : "Welcome back"}
            </h1>
            <p className="mt-2 text-sm leading-6 text-text-muted">
              {isSignup
                ? "Create an organizer account to manage events with Lineless."
                : "Login to continue to your organizer dashboard."}
            </p>
          </div>

          <form className="space-y-4" noValidate onSubmit={handleSubmit}>
            {isSignup ? (
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block">
                  <span className="text-sm font-semibold text-text">
                    First name
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    placeholder="Emely"
                  />
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-text">
                    Last name
                  </span>
                  <input
                    className="mt-2 h-11 w-full rounded-lg border border-border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:border-accent focus:ring-4 focus:ring-accent-soft"
                    placeholder="Meyer"
                  />
                </label>
              </div>
            ) : null}

            <label className="block">
              <span className="text-sm font-semibold text-text">Email</span>
              <input
                className={`mt-2 h-11 w-full rounded-lg border bg-surface px-3 text-sm text-text outline-none transition placeholder:text-text-muted focus:ring-4 ${
                  shouldShowEmailError && emailError
                    ? "border-danger focus:border-danger focus:ring-danger/10"
                    : "border-border focus:border-accent focus:ring-accent-soft"
                }`}
                value={email}
                onBlur={() =>
                  setTouched((current) => ({ ...current, email: true }))
                }
                onChange={(event) => setEmail(event.target.value)}
                placeholder="organizer@lineless.app"
                type="email"
                aria-invalid={shouldShowEmailError && Boolean(emailError)}
                aria-describedby={
                  shouldShowEmailError && emailError ? "email-error" : undefined
                }
              />
              {shouldShowEmailError && emailError ? (
                <span
                  id="email-error"
                  className="mt-2 block text-xs font-medium text-danger"
                >
                  {emailError}
                </span>
              ) : null}
            </label>

            <div className="block">
              <span className="flex items-center justify-between gap-3 text-sm font-semibold text-text">
                Password
                {!isSignup ? (
                  <button
                    type="button"
                    className="text-sm font-semibold text-accent hover:underline"
                  >
                    Forgot password?
                  </button>
                ) : null}
              </span>
              <div className="relative mt-2">
                <input
                  className={`h-11 w-full rounded-lg border bg-surface px-3 pr-11 text-sm text-text outline-none transition placeholder:text-text-muted focus:ring-4 ${
                    shouldShowPasswordError && passwordError
                      ? "border-danger focus:border-danger focus:ring-danger/10"
                      : "border-border focus:border-accent focus:ring-accent-soft"
                  }`}
                  value={password}
                  onBlur={() =>
                    setTouched((current) => ({ ...current, password: true }))
                  }
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Enter your password"
                  type={showPassword ? "text" : "password"}
                  aria-invalid={
                    shouldShowPasswordError && Boolean(passwordError)
                  }
                  aria-describedby={
                    shouldShowPasswordError && passwordError
                      ? "password-error"
                      : isSignup
                        ? "password-help"
                        : undefined
                  }
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-text-muted transition hover:text-accent"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="m3 3 18 18" />
                      <path d="M10.6 10.6a2 2 0 0 0 2.8 2.8" />
                      <path d="M9.9 4.2A10.8 10.8 0 0 1 12 4c5 0 9 4.5 10 8a11.8 11.8 0 0 1-2.1 3.6" />
                      <path d="M6.6 6.6A12 12 0 0 0 2 12c1 3.5 5 8 10 8a10.8 10.8 0 0 0 4.2-.9" />
                    </svg>
                  ) : (
                    <svg
                      aria-hidden="true"
                      className="h-5 w-5"
                      fill="none"
                      stroke="currentColor"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      viewBox="0 0 24 24"
                    >
                      <path d="M2 12s4-8 10-8 10 8 10 8-4 8-10 8S2 12 2 12Z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              {isSignup ? (
                <div
                  id="password-help"
                  className="mt-2 rounded-lg bg-accent-soft px-3 py-2 text-xs font-medium leading-5 text-accent"
                >
                  Password must include at least 8 characters, one letter and
                  one number.
                </div>
              ) : null}
              {shouldShowPasswordError && passwordError ? (
                <span
                  id="password-error"
                  className="mt-2 block text-xs font-medium text-danger"
                >
                  {passwordError}
                </span>
              ) : null}
            </div>

            <button
              type="submit"
              className="h-11 w-full rounded-lg bg-accent px-4 text-sm font-semibold text-white transition hover:opacity-95"
            >
              {isSignup ? "Create account" : "Login"}
            </button>
          </form>

          <div className="mt-6 rounded-lg border border-border bg-surface-muted p-3 text-center">
            <p className="text-sm font-medium leading-5 text-text-muted">
              {isSignup
                ? "Already managing an event?"
                : "New to Lineless organizer tools?"}
            </p>
            <button
              type="button"
              onClick={() => switchTab(isSignup ? "login" : "signup")}
              className="mt-3 h-10 w-full rounded-lg border border-border bg-surface px-4 text-sm font-semibold text-accent transition hover:border-accent hover:bg-accent-soft"
            >
              {isSignup ? "Login instead" : "Create an account"}
            </button>
          </div>
        </section>
      </div>
    </main>
  );
}
