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
  const navigate = useNavigate();

  // check we have required fields before submitting
  function isValid() {
    if (!email || !password) return false;
    if (isSignUp && !name) return false;
    return password.length >= 8;
  }

  // onsubmit hand it off to betterAuth
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isValid()) return;
    setError(null);
    setLoading(true);

    try {
      if (isSignUp) {
        const { error } = await signUp.email({
          email,
          password,
          name,
        });
        if (error) throw new Error(error.message);
      } else {
        const { error } = await signIn.email({
          email,
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

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          {/* display name — only for sign up */}
          {isSignUp && (
            <div className="flex flex-col gap-1.5">
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
                className="login-input"
              />
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
              className="login-input"
            />
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
              className="login-input"
            />
          </div>

          {error && (
            <p className="text-sm text-red-600 font-body bg-red-50 px-3 py-2 rounded-lg">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading || !isValid()}
            className="mt-2 px-4 py-2.5 rounded-lg font-body font-medium text-crunch-cream
              bg-crunch-walnut-600 hover:bg-crunch-walnut-700 active:bg-crunch-walnut-800
              disabled:opacity-50 transition-colors duration-200 cursor-pointer"
          >
            {loading ? "..." : isSignUp ? "Create Account" : "Sign In"}
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
          onClick={() => signIn.social({ provider: "twitter" })}
          className="mt-4 w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg
            font-body font-medium text-crunch-cream bg-neutral-900 hover:bg-neutral-800
            active:bg-black transition-colors duration-200 cursor-pointer"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4 fill-current" aria-hidden="true">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
          Continue with X
        </button>

        {/* toggle sign-in / sign-up */}
        <div className="mt-6 text-center">
          <button
            type="button"
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="font-body text-sm text-crunch-khaki-600 hover:text-crunch-walnut-600
              transition-colors duration-200 cursor-pointer"
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
