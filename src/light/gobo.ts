import { Spring } from '../lib/dom';

/*
  The gobo wheel in the cover's fixture: four steel gobos (a window of six
  panes, a leaf breakup, venetian blinds and leaded diamond panes), twice
  round the wheel. It turns to the next in the open, the way a moving
  light does: the gobo slides out of the gate on the wheel's arc, a sliver
  of the wheel's own steel crosses, and the next slides in. The focus goes
  soft as it moves and comes back sharp just after it lands. The first
  turn comes straight after the page opens, so the wheel shows what it
  does before anyone has looked away. The gobos themselves are drawn in
  the shader (src/light/field.ts).
*/

/** How long the first gobo is held, then each after it, in seconds of the cover being in view. */
const FIRST = 1;
const HOLD = 6.75;

export class Wheel {
  /** Where the wheel is, in slots (one per gobo); it only ever turns one way. */
  pos = 0;
  /** 0 in focus, 1 at its softest. */
  focus = 0;
  private slot = 0;
  private held = 0;
  private last = performance.now();
  private turn = new Spring(0, 0.55, 1);
  private soft = new Spring(0, 1.2, 1);

  constructor(private reduced: boolean) {}

  /** `seen` is whether the cover is in view; the wheel only turns while someone can see it. */
  update(dt: number, seen: boolean) {
    if (this.reduced) return;
    // The hold is kept in real time, so the slow frames while the page starts up don't put off the first turn.
    const now = performance.now();
    const real = Math.min(0.5, (now - this.last) / 1000);
    this.last = now;
    if (seen && (this.held += real) > (this.slot ? HOLD : FIRST)) {
      this.slot++;
      this.held = 0;
    }
    this.pos = this.turn.step(this.slot, dt);
    this.focus = this.soft.step(Math.min(1, Math.abs(this.slot - this.pos) * 5), dt);
  }
}
