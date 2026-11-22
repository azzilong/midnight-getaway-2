// Midnight Getaway — keyboard input. Tracks held keys and one-frame
// "just pressed" edges, so a tap of Q or F fires exactly once.

export class Keyboard {
  constructor() {
    this.held = new Set();
    this.pressed = new Set();
    this.onFirstGesture = null;
    window.addEventListener('keydown', (event) => {
      if (event.repeat) return;
      this.held.add(event.code);
      this.pressed.add(event.code);
      if (this.onFirstGesture) this.onFirstGesture();
      if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Space'].includes(event.code)) {
        event.preventDefault();
      }
    });
    window.addEventListener('keyup', (event) => {
      this.held.delete(event.code);
    });
    window.addEventListener('blur', () => {
      this.held.clear();
    });
  }

  down(code) { return this.held.has(code); }

  wasPressed(code) { return this.pressed.has(code); }

  // Call once per frame, after the game has read the edges.
  endFrame() { this.pressed.clear(); }

  moveVector() {
    let x = 0;
    let y = 0;
    if (this.down('KeyA') || this.down('ArrowLeft')) x -= 1;
    if (this.down('KeyD') || this.down('ArrowRight')) x += 1;
    if (this.down('KeyW') || this.down('ArrowUp')) y -= 1;
    if (this.down('KeyS') || this.down('ArrowDown')) y += 1;
    if (x !== 0 && y !== 0) {
      const len = Math.hypot(x, y);
      x /= len;
      y /= len;
    }
    return { x, y };
  }
}
