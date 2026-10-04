/** Virtual-controller state written by the HUD (touch) and read by the world scene every frame. */
export interface ControlState {
  /** Joystick direction, each axis in [-1, 1]. */
  moveX: number;
  moveY: number;
  /** One-shot: the ACTION button was pressed since the last read. */
  action: boolean;
  /** The Run button is switched on. */
  run: boolean;
}

export const controls: ControlState = { moveX: 0, moveY: 0, action: false, run: false };

export function resetControls(): void {
  controls.moveX = 0;
  controls.moveY = 0;
  controls.action = false;
  controls.run = false;
}

/** Consume a one-shot button press. */
export function takeAction(): boolean {
  const v = controls.action;
  controls.action = false;
  return v;
}
