import type { BeamState } from "./use-lighthouse";

/**
 * The light beam from the beacon (50%, 29.6% of the lighthouse box),
 * turned to `angle` degrees (animated while sweeping), plus the glowing lens.
 */
export function Beam({ state, angle, isDesktop }: { state: BeamState; angle: number; isDesktop: boolean }) {
  return (
    <>
      <div
        className="pointer-events-none absolute left-[50%] top-[29.6%] z-10"
        style={{
          transform: `rotate(${angle}deg)`,
          transformOrigin: "0 0",
          transition:
            state === "sweeping"
              ? "transform 1800ms cubic-bezier(0.25, 0.1, 0.25, 1), opacity 400ms ease"
              : "opacity 500ms ease",
          opacity: state === "dark" ? 0 : 1,
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
    </>
  );
}
