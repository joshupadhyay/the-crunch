// FE: signUp.email() → HTTP POST → Server: /api/auth/sign-up/email
//                                     ↓
//                               Creates user row in Postgres
//                               Creates session row
//                               Sets session cookie
//                                     ↓
// FE: useSession() ← reads cookie → { user, session }

import { useState } from "react";
import { useNavigate } from "react-router";
import { authClient } from "../lib/auth-client";
const { signIn, signUp } = authClient;

export function LoginPage() {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const navigate = useNavigate();

  const trimmedEmail = email.trim();
  const trimmedName = name.trim();
  const hasEmail = trimmedEmail.length > 0;
  const emailLooksValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail);
  const hasTypedEmail = email.length > 0;
  const hasTypedPassword = password.length > 0;
  const emailInvalid = hasTypedEmail && !emailLooksValid;
  const passwordInvalid = hasTypedPassword && password.length < 8;
  const nameInvalid = isSignUp && name.length > 0 && trimmedName.length === 0;
  const formReady =
    hasEmail &&
    emailLooksValid &&
    password.length >= 8 &&
    (!isSignUp || trimmedName.length > 0);
  const isBusy = loading || socialLoading;
  const submitLabel = loading
    ? isSignUp
      ? "Creating account..."
      : "Signing in..."
    : isSignUp
      ? "Create Account"
      : "Sign In";

  // onsubmit hand it off to betterAuth
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!formReady) return;
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp.email({
          email: trimmedEmail,
          password,
          name: trimmedName,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await signIn.email({
          email: trimmedEmail,
          password,
        });
        if (error) throw new Error(error.message);
      }
      navigate("/");
    } catch (err: any) {
      setError(err.message ?? "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleSocialSignIn() {
    setError(null);
    setSocialLoading(true);
    try {
      const { error } = await signIn.social({ provider: "twitter" });
      if (error) throw new Error(error.message);
    } catch (err: any) {
      setError(err.message ?? "Could not start X sign-in");
      setSocialLoading(false);
    }
  }

  return (
    <>
      <div className="room-ambience" />

      <div className="login-card">
        <h1 className="font-display text-4xl text-crunch-mahogany-800 text-center mb-2">
          The Crunch
        </h1>
        <p className="font-body text-crunch-khaki-600 text-sm text-center mb-8">
          {isSignUp ? "Create your account" : "Welcome back"}
        </p>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4 auth-panel">
          {/* display name — only for sign up */}
          {isSignUp && (
            <div className="flex flex-col gap-1.5 auth-field-enter">
              <label
                htmlFor="name"
                className="font-body text-sm text-crunch-mahogany-700"
              >
                Name
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                placeholder="Your name"
                aria-invalid={nameInvalid}
                aria-describedby={nameInvalid ? "name-help" : undefined}
                className="login-input"
              />
              {nameInvalid && (
                <p id="name-help" className="form-help text-red-700">
                  Enter a name with at least one visible character.
                </p>
              )}
            </div>
          )}

          {/* email */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="email"
              className="font-body text-sm text-crunch-mahogany-700"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              placeholder="you@example.com"
              aria-invalid={emailInvalid}
              aria-describedby={emailInvalid ? "email-help" : undefined}
              className="login-input"
            />
            {emailInvalid && (
              <p id="email-help" className="form-help text-red-700">
                Use a valid email address.
              </p>
            )}
          </div>

          {/* password */}
          <div className="flex flex-col gap-1.5">
            <label
              htmlFor="password"
              className="font-body text-sm text-crunch-mahogany-700"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              placeholder="Min 8 characters"
              aria-invalid={passwordInvalid}
              aria-describedby="password-help"
              className="login-input"
            />
            <p
              id="password-help"
              className={`form-help ${
                passwordInvalid ? "text-red-700" : "text-crunch-khaki-500"
              }`}
            >
              Password must be at least 8 characters.
            </p>
          </div>

          {error && (
            <p className="form-alert" role="alert">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={isBusy || !formReady}
            aria-busy={loading}
            className="mt-2 px-4 py-2.5 rounded-lg font-body font-medium text-crunch-cream
              bg-crunch-walnut-600 hover:bg-crunch-walnut-700 active:bg-crunch-walnut-800
              disabled:bg-crunch-khaki-300 disabled:text-crunch-khaki-600 disabled:cursor-not-allowed
              transition-[background-color,color,transform,box-shadow] duration-200 cursor-pointer
              enabled:hover:-translate-y-0.5 enabled:hover:shadow-md"
          >
            {submitLabel}
          </button>
        </form>

        {/* divider */}
        <div className="flex items-center gap-3 mt-6">
          <div className="flex-1 h-px bg-crunch-khaki-300" />
          <span className="font-body text-xs text-crunch-khaki-500">or</span>
          <div className="flex-1 h-px bg-crunch-khaki-300" />
        </div>

        {/* twitter / X sign-in */}
        <button
          type="button"
          onClick={handleSocialSignIn}
          disabled={isBusy}
          aria-busy={socialLoading}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            font-body font-medium text-crunch-cream bg-neutral-900 hover:bg-neutral-800
            active:bg-black disabled:bg-neutral-500 disabled:cursor-not-allowed
            transition-[background-color,transform,box-shadow] duration-200 cursor-pointer
            enabled:hover:-translate-y-0.5 enabled:hover:shadow-md"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          {socialLoading ? "Opening X sign-in..." : "Continue with X"}
        </button>

        {/* toggle sign-in / sign-up */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            disabled={isBusy}
            className="font-body text-sm text-crunch-khaki-600 hover:text-crunch-walnut-600
              transition-colors duration-200 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSignUp
              ? "Already have an account? Sign in"
              : "Need an account? Sign up"}
          </button>
        </div>
      </div>
    </>
  );
}
