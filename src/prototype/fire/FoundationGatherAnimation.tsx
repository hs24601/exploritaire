import { motion } from 'framer-motion';
import type { Region } from './rules';

export interface FoundationGatherFlight {
  region: Region;
  from: { x: number; y: number };
  to: { x: number; y: number };
}

/** Reusable completion animation for collapsing a completed foundation into its goal card. */
export function FoundationGatherAnimation({ flight }: { flight: FoundationGatherFlight }) {
  return <motion.div className={`foundation-gather-flight ${flight.region}`} style={{ left: flight.from.x - 35, top: flight.from.y - 51 }} initial={{ x: 0, y: 0, rotate: 0, scale: 1, opacity: 1 }} animate={{ x: flight.to.x - flight.from.x, y: flight.to.y - flight.from.y, rotate: flight.region === 'east' || flight.region === 'west' ? 8 : -8, scale: .38, opacity: .2 }} transition={{ duration: .5, ease: [0.22, 0.68, 0.2, 1] }} aria-hidden="true">
    <div className="gather-stack-card back-a" /><div className="gather-stack-card back-b" /><div className="gather-stack-card front"><b>4</b></div>
  </motion.div>;
}
