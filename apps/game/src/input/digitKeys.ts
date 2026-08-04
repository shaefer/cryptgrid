/** Shared by SheetController (open/close a sheet) and ActiveCharacterController (set active hands) — both key off the same physical 1-4 cluster. */
export const DIGIT_CODE_TO_SLOT_INDEX: Readonly<Record<string, number>> = {
  Digit1: 0,
  Digit2: 1,
  Digit3: 2,
  Digit4: 3,
  Numpad1: 0,
  Numpad2: 1,
  Numpad3: 2,
  Numpad4: 3,
};
