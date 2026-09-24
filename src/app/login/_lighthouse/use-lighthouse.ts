import { useEffect, useRef, useState } from "react";

/** "dark" -> "sweeping" (rotates left-to-right from the beacon) -> "locked" (steady light). */
export type BeamState = "dark" | "sweeping" | "locked";

/**
 * The login page's intro: the beam sweeps across the night and reveals the
 * sign-in card where it lands. Any click skips straight to the card.
 */
export function useLighthouse() {
  const [beamState, setBeamState] = useState<BeamState>("dark");
  const [isCardRevealed, setIsCardRevealed] = useState(false);
  const [isDesktop, setIsDesktop] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout>[]>([]);

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

  // 0ms: darkness. 300ms: the beam turns on and sweeps left to right.
  // 1500ms: it passes over the card, which lights up in place.
  // 2300ms: the sweep ends and the light holds steady.
  function schedule() {
    clearTimers();
    timerRef.current = [
      setTimeout(() => {
        setBeamState("dark");
        setIsCardRevealed(false);
      }, 0),
      setTimeout(() => setBeamState("sweeping"), 300),
      setTimeout(() => setIsCardRevealed(true), 1500),
      setTimeout(() => setBeamState("locked"), 2300),
    ];
  }

  // Play on load, and again when the layout switches between phone and desktop.
  useEffect(() => {
    schedule();
    return () => clearTimers();
  }, [isDesktop]); // eslint-disable-line react-hooks/exhaustive-deps

  function replay() {
    setBeamState("dark");
    setIsCardRevealed(false);
    schedule();
  }

  // Quick skip if the user interacts early
  function skip() {
    if (!isCardRevealed || beamState !== "locked") {
      clearTimers();
      setIsCardRevealed(true);
      setBeamState("locked");
    }
  }

  // Starts on the left pointing out to sea, sweeps clockwise to point at the card.
  const angle = beamState === "dark" ? (isDesktop ? -115 : -85) : isDesktop ? 8 : 50;

  return { beamState, isCardRevealed, isDesktop, angle, replay, skip };
}
