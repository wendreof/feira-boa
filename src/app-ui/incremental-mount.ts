import type { Offer } from "../types";
import {
  OFFER_GRID_IDLE_CHUNK,
  OFFER_GRID_INITIAL_CHUNK,
  offerGridMountPlan,
} from "../../scripts/domain/offer-grid-chunks.mjs";

export { OFFER_GRID_INITIAL_CHUNK, OFFER_GRID_IDLE_CHUNK, offerGridMountPlan };

type MountOffer = (offer: Offer) => void;

function scheduleChunk(work: () => void): void {
  if (typeof requestIdleCallback === "function") {
    requestIdleCallback(() => work(), { timeout: 120 });
    return;
  }
  requestAnimationFrame(work);
}

/**
 * Mounts offer cards in sync + idle chunks so parsing a large feed does not block the main thread.
 * Returns a promise that settles when every card is mounted, or when `generation` is superseded.
 */
export function mountOffersIncrementally(
  offers: Offer[],
  mountOffer: MountOffer,
  activeGeneration: number,
  currentGeneration: () => number,
  onFirstBatch?: () => void,
): Promise<void> {
  if (offers.length === 0) {
    onFirstBatch?.();
    return Promise.resolve();
  }

  const plan = offerGridMountPlan(offers.length);
  let index = 0;

  const mountRange = (count: number): void => {
    const end = Math.min(index + count, offers.length);
    for (; index < end; index += 1) {
      mountOffer(offers[index]);
    }
  };

  mountRange(plan[0]);
  onFirstBatch?.();

  if (index >= offers.length || plan.length === 1) {
    return Promise.resolve();
  }

  gridBusy(true);

  return new Promise((resolve) => {
    let planIndex = 1;
    const step = (): void => {
      if (currentGeneration() !== activeGeneration) {
        gridBusy(false);
        resolve();
        return;
      }
      if (planIndex >= plan.length) {
        gridBusy(false);
        resolve();
        return;
      }
      mountRange(plan[planIndex]);
      planIndex += 1;
      if (index >= offers.length) {
        gridBusy(false);
        resolve();
        return;
      }
      scheduleChunk(step);
    };
    scheduleChunk(step);
  });
}

let gridBusyTarget: HTMLElement | null = null;

export function bindIncrementalMountGrid(grid: HTMLElement): void {
  gridBusyTarget = grid;
}

function gridBusy(busy: boolean): void {
  if (!gridBusyTarget) return;
  if (busy) gridBusyTarget.setAttribute("aria-busy", "true");
  else gridBusyTarget.removeAttribute("aria-busy");
}