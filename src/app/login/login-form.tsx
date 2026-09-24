"use client";

import { useState, useEffect, useRef } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff, RotateCcw } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [fullName, setFullName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  // Lighthouse animation sequence state:
  // "dark" -> "sweeping" (rotates left-to-right from beacon) -> "locked" (steady illumination)
  const [beamState, setBeamState] = useState<"dark" | "sweeping" | "locked">("dark");
  const [isCardRevealed, setIsCardRevealed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const timerRef = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    function handleResize() {
      setIsDesktop(window.innerWidth >= 768);
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  function clearTimers() {
    timerRef.current.forEach(clearTimeout);
    timerRef.current = [];
  }

  function startLighthouseSequence() {
    clearTimers();
    setBeamState("dark");
    setIsCardRevealed(false);

    // Timeline:
    // 0ms: Atmospheric darkness with lighthouse standing on the left
    // 300ms: Light beam turns on and begins sweeping from left to right
    // 1500ms: Light passes over the card location on the right; the card illuminates in-place
    // 2300ms: Light completes sweep and locks into steady illumination
    const t1 = setTimeout(() => {
      setBeamState("sweeping");
    }, 300);

    const t2 = setTimeout(() => {
      setIsCardRevealed(true);
    }, 1500);

    const t3 = setTimeout(() => {
      setBeamState("locked");
    }, 2300);

    timerRef.current = [t1, t2, t3];
  }

  useEffect(() => {
    startLighthouseSequence();
    return () => clearTimers();
  }, [isDesktop]);

  // Quick skip if user interacts early
  function skipToCard() {
    if (!isCardRevealed || beamState !== "locked") {
      clearTimers();
      setIsCardRevealed(true);
      setBeamState("locked");
    }
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    setNotice(null);

    const supabase = createClient();

    if (mode === "signup") {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      });

      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }

      // Email confirmation on: there is no session yet.
      if (!data.session) {
        setNotice("Check your email to confirm the account, then sign in.");
        setMode("signin");
        setBusy(false);
        return;
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) {
        setError(error.message);
        setBusy(false);
        return;
      }
    }

    router.replace(params.get("next") || "/dashboard");
    router.refresh();
  }

  // Beam angles:
  // Starts on the left pointing out to sea / night sky (-115deg on desktop)
  // Sweeps clockwise across the dark sky to the right (+8deg on desktop, pointing directly at the card)
  const startAngle = isDesktop ? -115 : -85;
  const targetAngle = isDesktop ? 8 : 50;
  const currentAngle = beamState === "dark" ? startAngle : targetAngle;

  return (
    <main
      onClick={skipToCard}
      className="relative min-h-screen w-full bg-[#000000] text-white flex flex-col md:flex-row items-center justify-between overflow-hidden select-none"
    >
      {/* Deep night ambient stars & ocean mist */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_top,_#080e0c_0%,_#000000_80%)]" />

      {/* Tiny shimmering stars */}
      <div className="pointer-events-none absolute inset-0 opacity-40">
        <div className="absolute top-[12%] left-[18%] h-0.5 w-0.5 rounded-full bg-amber-100 shadow-[0_0_3px_#fff]" />
        <div className="absolute top-[22%] left-[34%] h-1 w-1 rounded-full bg-white/70 shadow-[0_0_4px_#fff]" />
        <div className="absolute top-[8%] left-[62%] h-0.5 w-0.5 rounded-full bg-amber-200/80 shadow-[0_0_3px_#fff]" />
        <div className="absolute top-[15%] left-[82%] h-1 w-1 rounded-full bg-white/60 shadow-[0_0_4px_#fff]" />
        <div className="absolute top-[28%] left-[74%] h-0.5 w-0.5 rounded-full bg-amber-100/60 shadow-[0_0_2px_#fff]" />
        <div className="absolute top-[35%] left-[12%] h-0.5 w-0.5 rounded-full bg-white/50" />
      </div>

      {/* -------------------------------------------------------------
          LEFT SIDE: THE LIGHTHOUSE (LARGER & MAJESTIC)
          ------------------------------------------------------------- */}
      <div className="relative z-20 w-full md:w-[45%] lg:w-[42%] h-[420px] md:h-screen flex flex-col justify-end items-center md:items-start pl-0 md:pl-6 lg:pl-12 pb-0 pointer-events-none">
        <div className="relative w-[320px] sm:w-[400px] md:w-[480px] lg:w-[560px] xl:w-[620px] h-[460px] sm:h-[580px] md:h-[700px] lg:h-[800px] xl:h-[860px]">
          {/* Lighthouse SVG Illustration */}
          <svg
            viewBox="0 0 320 500"
            className="w-full h-full drop-shadow-[0_10px_35px_rgba(0,0,0,0.9)]"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
          >
            {/* Rocky Cliff Base */}
            <path
              d="M0 450 C40 435 90 445 140 435 C190 425 240 450 320 440 L320 500 L0 500 Z"
              fill="#0d110f"
            />
            <path
              d="M10 465 C60 450 110 460 160 455 C210 450 260 470 310 460 L320 500 L0 500 Z"
              fill="#141916"
            />
            <path
              d="M30 480 Q100 470 170 482 T310 480 L320 500 L0 500 Z"
              fill="#19201c"
            />

            {/* Ocean Water Reflections at Base */}
            <ellipse
              cx="160"
              cy="492"
              rx="110"
              ry="4"
              fill="rgba(245, 215, 130, 0.08)"
            />
            <ellipse
              cx="140"
              cy="496"
              rx="70"
              ry="2.5"
              fill="rgba(245, 215, 130, 0.05)"
            />

            {/* Lighthouse Foundation / Stone Plinth */}
            <polygon
              points="110,435 210,435 218,455 102,455"
              fill="#1c221e"
              stroke="#262f2a"
              strokeWidth="1.5"
            />

            {/* Arched Entrance Doorway */}
            <path
              d="M148 435 L148 410 Q160 398 172 410 L172 435 Z"
              fill="#0a0d0b"
              stroke="#2b352f"
              strokeWidth="1.5"
            />
            <circle cx="168" cy="420" r="1.5" fill="#c4aa63" />

            {/* Tower Body - Tapered Masonry */}
            {/* Tower Section 1 (Bottom Charcoal Granite) */}
            <polygon
              points="116,435 204,435 198,360 122,360"
              fill="#181e1b"
              stroke="#242c27"
              strokeWidth="1"
            />

            {/* Tower Section 2 (Cream Stone Band - Lattice Lane heritage) */}
            <polygon
              points="122,360 198,360 193,290 127,290"
              fill="#c8c2b1"
              stroke="#ded8c8"
              strokeWidth="1"
            />
            {/* Lower Window */}
            <path
              d="M154 335 L154 318 Q160 312 166 318 L166 335 Z"
              fill="#241d0c"
            />
            <path
              d="M155 334 L155 319 Q160 314 165 319 L165 334 Z"
              fill="#fbbf24"
              opacity="0.85"
            />

            {/* Tower Section 3 (Sage Green Band - Brand Color) */}
            <polygon
              points="127,290 193,290 188,220 132,220"
              fill="#54655b"
              stroke="#43524a"
              strokeWidth="1"
            />
            {/* Upper Window */}
            <path
              d="M155 260 L155 245 Q160 240 165 245 L165 260 Z"
              fill="#241d0c"
            />
            <path
              d="M156 259 L156 246 Q160 242 164 246 L164 259 Z"
              fill="#fef08a"
              opacity="0.9"
            />

            {/* Tower Section 4 (Upper Stone Collar) */}
            <polygon
              points="132,220 188,220 185,185 135,185"
              fill="#dcd6c5"
              stroke="#ede7d7"
              strokeWidth="1"
            />

            {/* Observation Gallery / Balcony Platform */}
            {/* Decorative stone corbels */}
            <path
              d="M130 185 L125 178 L195 178 L190 185 Z"
              fill="#242c27"
              stroke="#343f38"
            />
            {/* Balcony deck */}
            <rect
              x="122"
              y="174"
              width="76"
              height="4"
              rx="1.5"
              fill="#181e1b"
              stroke="#3a473f"
            />
            {/* Metal Railing */}
            <line
              x1="124"
              y1="165"
              x2="196"
              y2="165"
              stroke="#8a968e"
              strokeWidth="1.5"
            />
            <line
              x1="128"
              y1="165"
              x2="128"
              y2="174"
              stroke="#8a968e"
              strokeWidth="1"
            />
            <line
              x1="140"
              y1="165"
              x2="140"
              y2="174"
              stroke="#8a968e"
              strokeWidth="1"
            />
            <line
              x1="160"
              y1="165"
              x2="160"
              y2="174"
              stroke="#8a968e"
              strokeWidth="1"
            />
            <line
              x1="180"
              y1="165"
              x2="180"
              y2="174"
              stroke="#8a968e"
              strokeWidth="1"
            />
            <line
              x1="192"
              y1="165"
              x2="192"
              y2="174"
              stroke="#8a968e"
              strokeWidth="1"
            />

            {/* Lantern Glass Room */}
            <rect
              x="136"
              y="125"
              width="48"
              height="49"
              fill="rgba(254, 240, 138, 0.18)"
              stroke="#242c27"
              strokeWidth="2"
            />
            {/* Glass Mullions / Diagonal Grid */}
            <line
              x1="136"
              y1="125"
              x2="184"
              y2="174"
              stroke="#242c27"
              strokeWidth="1.2"
            />
            <line
              x1="184"
              y1="125"
              x2="136"
              y2="174"
              stroke="#242c27"
              strokeWidth="1.2"
            />
            <line
              x1="160"
              y1="125"
              x2="160"
              y2="174"
              stroke="#242c27"
              strokeWidth="1.5"
            />

            {/* The Fresnel Beacon Lens (Center at X: 160, Y: 148) */}
            <circle
              cx="160"
              cy="148"
              r="14"
              fill="url(#beacon-glow)"
              className="animate-pulse"
            />
            <circle cx="160" cy="148" r="8" fill="#fffdfa" />
            <circle cx="160" cy="148" r="4" fill="#ffffff" />

            {/* Domed Roof / Cupola */}
            <path
              d="M132 125 C132 100 188 100 188 125 Z"
              fill="#2c3631"
              stroke="#1b221f"
              strokeWidth="1.5"
            />
            {/* Pinnacle & Spire */}
            <rect x="158" y="90" width="4" height="12" fill="#d5cfc0" />
            <circle cx="160" cy="88" r="3.5" fill="#fef08a" />
            <line
              x1="160"
              y1="85"
              x2="160"
              y2="72"
              stroke="#c8c2b1"
              strokeWidth="1.5"
            />

            {/* Definitions for gradients */}
            <defs>
              <radialGradient id="beacon-glow" cx="50%" cy="50%" r="50%">
                <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
                <stop offset="35%" stopColor="#fef08a" stopOpacity="0.9" />
                <stop offset="70%" stopColor="#f59e0b" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#d97706" stopOpacity="0" />
              </radialGradient>
            </defs>
          </svg>

          {/* -------------------------------------------------------------
              LIGHT BEAM: ORIGINATES PRECISELY AT THE TOP BEACON (50%, 29.6%)
              Sweeps smoothly from left to right across the dark night
              ------------------------------------------------------------- */}
          <div
            className="pointer-events-none absolute left-[50%] top-[29.6%] z-10"
            style={{
              transform: `rotate(${currentAngle}deg)`,
              transformOrigin: "0 0",
              transition:
                beamState === "sweeping"
                  ? "transform 1800ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 400ms ease"
                  : "opacity 500ms ease",
              opacity: beamState === "dark" ? 0 : 1,
            }}
          >
            <div
              className="relative"
              style={{
                transform: "translateY(-50%)",
                width: "min(160vw, 2400px)",
                height: isDesktop ? "460px" : "360px",
              }}
            >
              {/* Outer soft volumetric beam */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath: "polygon(0% 49%, 100% 0%, 100% 100%, 0% 51%)",
                  background:
                    "linear-gradient(to right, rgba(255,255,255,0.95) 0%, rgba(254,240,138,0.38) 22%, rgba(245,215,130,0.12) 58%, rgba(217,180,74,0.03) 85%, transparent 100%)",
                }}
              />
              {/* Inner core brilliant ray */}
              <div
                className="absolute inset-0"
                style={{
                  clipPath: "polygon(0% 49.6%, 100% 18%, 100% 82%, 0% 50.4%)",
                  background:
                    "linear-gradient(to right, rgba(255,255,255,1) 0%, rgba(254,243,199,0.65) 12%, rgba(251,191,36,0.18) 50%, transparent 100%)",
                }}
              />
            </div>
          </div>

          {/* Glowing Beacon Core Halo & Flare at the Lantern Room */}
          <div className="pointer-events-none absolute left-[50%] top-[29.6%] -translate-x-1/2 -translate-y-1/2 h-20 w-20 rounded-full bg-amber-200/40 blur-xl animate-pulse z-20" />
          <div className="pointer-events-none absolute left-[50%] top-[29.6%] -translate-x-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-white shadow-[0_0_35px_#fde68a] z-20" />
        </div>
      </div>

      {/* -------------------------------------------------------------
          RIGHT SIDE: THE CIRCULAR SPOTLIGHT & THE LOGIN BOX
          The box was already sitting there; the light makes it appear
          ------------------------------------------------------------- */}
      <div className="relative z-30 w-full md:w-[55%] lg:w-[58%] h-full flex items-center justify-center p-4 sm:p-6 md:p-8">
        {/* The Circle of Light */}
        <div
          className={`relative flex items-center justify-center rounded-full transition-all duration-1000 ease-out ${
            isCardRevealed
              ? "opacity-100 scale-100"
              : "opacity-0 scale-100 pointer-events-none"
          }`}
          style={{
            width: "min(90vw, 520px)",
            height: "min(90vw, 520px)",
            background:
              "radial-gradient(circle at center, rgba(255, 252, 240, 0.22) 0%, rgba(254, 243, 199, 0.12) 45%, rgba(217, 180, 74, 0.04) 70%, transparent 100%)",
            boxShadow:
              "0 0 130px rgba(251, 191, 36, 0.25), inset 0 0 90px rgba(254, 240, 138, 0.18)",
            border: "1.5px solid rgba(253, 230, 138, 0.45)",
          }}
        >
          {/* Subtle rotating ray ring on the circular beam edge */}
          <div className="pointer-events-none absolute inset-0 rounded-full border border-amber-200/20 animate-pulse" />

          {/* The Login Card inside the Circle of Light: Revealed in place by the passing light */}
          <div
            onClick={(e) => e.stopPropagation()}
            className={`w-full max-w-[340px] sm:max-w-[370px] p-6 sm:p-7 rounded-2xl bg-[#080b0a]/90 backdrop-blur-2xl border border-amber-200/40 shadow-[0_20px_50px_rgba(0,0,0,0.85)] text-white transition-all duration-1000 ease-out ${
              isCardRevealed
                ? "opacity-100 brightness-100"
                : "opacity-0 brightness-50 pointer-events-none"
            }`}
          >
            {/* Header Brand Lockup */}
            <div className="flex flex-col items-center text-center">
              <Image
                src="/lattice-lane-lockup.png"
                alt="Lattice Lane — House of Gifting"
                width={1600}
                height={976}
                priority
                className="h-16 sm:h-20 w-auto object-contain drop-shadow-[0_2px_12px_rgba(251,191,36,0.3)] mb-1"
              />
              <div className="h-0.5 w-12 bg-gradient-to-r from-transparent via-amber-300 to-transparent my-1.5" />
              <h1 className="font-display text-xl font-bold tracking-tight text-amber-50">
                {mode === "signin" ? "Sign in" : "Create account"}
              </h1>
              <p className="mt-0.5 text-xs text-amber-200/70 font-medium">
                Hamper costing and client quotations
              </p>
            </div>

            {/* Form */}
            <form onSubmit={submit} className="mt-5 space-y-3">
              {mode === "signup" && (
                <div>
                  <label
                    className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1"
                    htmlFor="fullName"
                  >
                    Full name
                  </label>
                  <input
                    id="fullName"
                    className="w-full rounded-lg bg-black/60 border border-white/20 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 transition-colors"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required
                    autoComplete="name"
                    placeholder="E.g. Smriti Sharma"
                  />
                </div>
              )}

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1"
                  htmlFor="email"
                >
                  Email address
                </label>
                <input
                  id="email"
                  type="email"
                  className="w-full rounded-lg bg-black/60 border border-white/20 px-3 py-2 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 transition-colors"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  placeholder="you@latticelane.com"
                />
              </div>

              <div>
                <label
                  className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80 mb-1"
                  htmlFor="password"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="w-full rounded-lg bg-black/60 border border-white/20 px-3 py-2 pr-10 text-sm text-white placeholder-neutral-500 focus:outline-none focus:border-amber-300 focus:ring-1 focus:ring-amber-300/40 transition-colors"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={8}
                    autoComplete={
                      mode === "signup" ? "new-password" : "current-password"
                    }
                    placeholder="••••••••"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-amber-200/60 hover:text-amber-100 transition-colors focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    tabIndex={-1}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && (
                <div
                  role="alert"
                  className="rounded-lg bg-red-950/80 border border-red-500/50 p-2.5 text-xs text-red-200"
                >
                  {error}
                </div>
              )}
              {notice && (
                <div className="rounded-lg bg-emerald-950/80 border border-emerald-500/50 p-2.5 text-xs text-emerald-200">
                  {notice}
                </div>
              )}

              <button
                type="submit"
                className="w-full rounded-lg bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-black font-semibold py-2.5 px-4 text-sm shadow-lg shadow-amber-500/25 transition-all duration-200 disabled:opacity-50 mt-2"
                disabled={busy}
              >
                {busy
                  ? "Verifying…"
                  : mode === "signin"
                    ? "Sign in to workspace"
                    : "Create enterprise account"}
              </button>
            </form>

            <div className="mt-4 pt-3 border-t border-white/10 text-center space-y-2">
              <button
                type="button"
                className="text-xs text-amber-300 hover:text-amber-200 hover:underline transition-colors"
                onClick={() => {
                  setMode(mode === "signin" ? "signup" : "signin");
                  setError(null);
                }}
              >
                {mode === "signin"
                  ? "First time here? Create an account"
                  : "Already have an account? Sign in"}
              </button>

              <p className="text-[10px] text-neutral-400">
                The first account created owns the workspace.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Replay Beam Sweep Control in bottom corner */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          startLighthouseSequence();
        }}
        title="Replay Lighthouse Beam"
        className="absolute bottom-4 right-4 z-40 flex items-center gap-1.5 rounded-full bg-black/60 hover:bg-neutral-900 border border-amber-300/30 px-3 py-1.5 text-[11px] text-amber-200/80 hover:text-amber-100 transition-all backdrop-blur-md shadow-md"
      >
        <RotateCcw className="h-3 w-3" />
        <span>Sweep Light</span>
      </button>
    </main>
  );
}
