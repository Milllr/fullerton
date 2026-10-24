import { Spring } from '../lib/dom';

/*
  The gobo wheel in the cover's fixture: four steel gobos (a window of six
  panes, a leaf breakup, venetian blinds and leaded diamond panes), twice
  round the wheel. Every so often it turns to the next in the open, the
  way a moving light does: the gobo slides out of the gate on the wheel's
  arc, a sliver of the wheel's own steel crosses, and the next slides in.
  The focus goes soft as it moves and comes back sharp just after it
  lands. The gobos themselves are drawn in the shader (src/light/field.ts).
*/

/** How long each gobo is held, in seconds of the cover being in view. */
const HOLD = 9;

export class Wheel {
  /** Where the wheel is, in slots (one per gobo); it only ever turns one way. */
  pos = 0;
  /** 0 in focus, 1 at its softest. */
  focus = 0;
  private slot = 0;
  private held = 0;
  private turn = new Spring(0, 0.55, 1);
  private soft = new Spring(0, 1.2, 1);

  constructor(private reduced: boolean) {}

  /** `seen` is whether the cover is in view; the wheel only turns while someone can see it. */
  update(dt: number, seen: boolean) {
    if (this.reduced) return;
    if (seen && (this.held += dt) > HOLD) {
      this.slot++;
      this.held = 0;
    }
    this.pos = this.turn.step(this.slot, dt);
    this.focus = this.soft.step(Math.min(1, Math.abs(this.slot - this.pos) * 5), dt);
  }
}
