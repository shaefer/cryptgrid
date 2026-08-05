import * as THREE from "three";
import {
  TICKS_PER_SECOND,
  canAct,
  createInitialState,
  parseLevel,
  tick,
  validateLevel,
  type Command,
  type GameState,
  type LevelJSON,
} from "@cryptgrid/sim";
import { CharacterSheet } from "./hud/characterSheet";
import { HeldItemCursor } from "./hud/heldItemCursor";
import { loadRuneGlyphs, RunePanel } from "./hud/runePanel";
import { VitalsHud } from "./hud/vitalsHud";
import { ActiveCharacterController } from "./input/activeCharacterController";
import { InteractionInput } from "./input/interactionInput";
import { KeyboardInput } from "./input/keyboard";
import { SheetController } from "./input/sheetController";
import { HoverHighlighter } from "./render/hoverHighlighter";
import { PartyView } from "./render/partyView";
import { ProjectileViews } from "./render/projectileViews";
import { buildLevel } from "./scene/buildLevel";
import { DoorViews } from "./scene/doors";
import { FeatureViews } from "./scene/features";
import { ItemSprites } from "./scene/items";
import { loadItemTextures } from "./scene/itemTextures";
import { loadDungeonTextures } from "./scene/textures";
import {
  LIGHT_BOOST_DISTANCE,
  LIGHT_BOOST_INTENSITY_MULT,
  TORCH_BASE_INTENSITY,
  TORCH_DISTANCE,
  TORCH_FLICKER,
} from "./tuning";

const FOG_COLOR = 0x0d0e12;
const TICK_MS = 1000 / TICKS_PER_SECOND;

// After a tab-away, dt can be enormous; without a ceiling the catch-up loop
// would run thousands of ticks and lock the page.
const MAX_TICKS_PER_FRAME = 5;

async function main(): Promise<void> {
  const app = document.getElementById("app");
  const hud = document.getElementById("hud");
  const vitals = document.getElementById("vitals");
  const characterSheetEl = document.getElementById("character-sheet");
  if (!app || !hud || !vitals || !characterSheetEl) {
    throw new Error("expected #app, #hud, #vitals, and #character-sheet in index.html");
  }

  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  app.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG_COLOR);
  scene.fog = new THREE.Fog(FOG_COLOR, 4, 18);

  const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 100);
  scene.add(camera); // the torch is a child of the camera, so it must be in the graph

  scene.add(new THREE.AmbientLight(0x404050, 0.6));
  const torch = new THREE.PointLight(0xffb46b, TORCH_BASE_INTENSITY, TORCH_DISTANCE, 1.8);
  camera.add(torch);

  // BASE_URL keeps these working both at "/" in dev and "/cryptgrid/" on Pages.
  const [levelJson, textures, itemTextures, runeGlyphs] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}levels/vault01.json`).then(
      (res) => res.json() as Promise<LevelJSON>,
    ),
    loadDungeonTextures(),
    loadItemTextures(),
    loadRuneGlyphs(),
  ]);

  const errors = validateLevel(levelJson);
  if (errors.length > 0) {
    console.error("vault01.json failed validation:", errors);
  }

  // ?devDecay=50 speeds up Hunger/Thirst decay so it's visibly testable
  // without waiting ~20 real minutes (ROADMAP.md M0.6 AC).
  const devDecayParam = Number(new URLSearchParams(window.location.search).get("devDecay"));
  const devDecayMultiplier = devDecayParam > 0 ? devDecayParam : 1;

  const level = parseLevel(levelJson);
  let state: GameState = createInitialState(level, 1, { devDecayMultiplier });
  const built = buildLevel(scene, level, textures);
  const doorViews = new DoorViews(scene, level, textures, built.doorFaces);
  const featureViews = new FeatureViews(scene, level, textures, itemTextures, built.featureFaces);
  featureViews.update(state.level);

  const itemSprites = new ItemSprites(scene, itemTextures);
  itemSprites.update(state.level.items);

  const partyView = new PartyView(camera, state.party);
  const projectileViews = new ProjectileViews(scene);
  const input = new KeyboardInput();
  input.attach(window);
  const vitalsHud = new VitalsHud(vitals);

  // Rune commands are ungated (no cooldown) — queued here, drained every tick.
  const runeCommands: Command[] = [];
  const runePanelEl = document.createElement("div");
  document.body.appendChild(runePanelEl);
  const runePanel = new RunePanel(runePanelEl, runeGlyphs, (command) => {
    runeCommands.push(command);
  });
  // Attached BEFORE the digit-key controllers: while casting is open, the
  // panel swallows 1-6/Esc via stopImmediatePropagation so sheet/character
  // selection doesn't fire mid-composition.
  runePanel.attach(window);

  const activeCharacter = new ActiveCharacterController();
  activeCharacter.attach(window);
  const heldItemCursor = new HeldItemCursor();

  let consumeCommand: Command | null = null;
  const characterSheet = new CharacterSheet(characterSheetEl, (characterId, itemId) => {
    consumeCommand = { type: "CONSUME", characterId, itemId };
  });
  const sheetController = new SheetController();
  sheetController.onChange((slotIndex) => {
    if (slotIndex === null) {
      characterSheet.hide();
    } else {
      characterSheet.render(slotIndex, state.party);
    }
  });
  sheetController.attach(window);

  // Inscription text is client-side flavor — a transient toast, no sim round-trip.
  const toast = document.createElement("div");
  toast.id = "toast";
  toast.hidden = true;
  document.body.appendChild(toast);
  let toastTimer: ReturnType<typeof setTimeout> | undefined;
  const showToast = (text: string): void => {
    toast.textContent = text;
    toast.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      toast.hidden = true;
    }, 4000);
  };

  const interactionInput = new InteractionInput({
    camera,
    canvas: renderer.domElement,
    raycastRoots: [itemSprites.group, featureViews.interactiveGroup],
    getState: () => state,
    getActiveCharacterId: () => state.party.members[activeCharacter.active]?.id ?? null,
    onInscription: (featureId) => {
      const feature = state.level.wallFeatures.find((f) => f.id === featureId);
      if (feature?.type === "inscription") showToast(`“${feature.text}”`);
    },
  });
  interactionInput.attach(window);

  const hoverHighlighter = new HoverHighlighter({
    camera,
    canvas: renderer.domElement,
    itemSprites,
    featureViews,
    getState: () => state,
  });
  hoverHighlighter.attach(window);

  const updateHud = (): void => {
    hud.textContent = `${level.name} — (${state.party.x},${state.party.z}) facing ${state.party.facing}   ·   WASD move · QE turn · click/F touch · right-click stow · C cast`;
    vitalsHud.update(state.party.members, activeCharacter.active);
    runePanel.update(state, state.party.members[activeCharacter.active]?.id ?? null);
    heldItemCursor.update(state.party.members[activeCharacter.active] ?? null);
    const openIndex = sheetController.openIndex;
    if (openIndex !== null) characterSheet.render(openIndex, state.party);
  };
  updateHud();
  activeCharacter.onChange(updateHud);

  window.addEventListener("resize", () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  let lastMs = performance.now();
  let accumulator = 0;
  const commands: Command[] = [];

  renderer.setAnimationLoop(() => {
    const nowMs = performance.now();
    accumulator += nowMs - lastMs;
    lastMs = nowMs;

    let ticksThisFrame = 0;
    while (accumulator >= TICK_MS && ticksThisFrame < MAX_TICKS_PER_FRAME) {
      accumulator -= TICK_MS;
      ticksThisFrame++;

      // Only pull input when the sim will actually accept it, otherwise the
      // buffered keypress is consumed by a tick that rejects it and the player
      // sees a dropped step. Movement is also suppressed while a character
      // sheet is open — menus don't pause a real-time dungeon, but they do
      // stop you from wandering into a wall while you're not looking.
      // PICKUP shares that same move-cooldown gate; STOW and CONSUME don't,
      // since neither is a physical action in the dungeon, just bookkeeping.
      commands.length = 0;
      if (canAct(state) && !sheetController.isOpen) {
        const command = input.takeCommand();
        if (command) commands.push(command);
        const pickup = interactionInput.takeGatedCommand();
        if (pickup) commands.push(pickup);
      }
      const stow = interactionInput.takeUngatedCommand();
      if (stow) commands.push(stow);
      if (consumeCommand) {
        commands.push(consumeCommand);
        consumeCommand = null;
      }
      commands.push(...runeCommands.splice(0)); // casting is also ungated

      const result = tick(state, commands);
      state = result.state;
      for (const event of result.events) {
        partyView.handleEvent(event, nowMs);
        doorViews.handleEvent(event, nowMs);
        featureViews.handleEvent(event);
        projectileViews.handleEvent(event, nowMs);
      }
    }
    if (ticksThisFrame > 0) {
      itemSprites.update(state.level.items);
      featureViews.update(state.level);
    }
    if (ticksThisFrame === MAX_TICKS_PER_FRAME) accumulator = 0; // drop the backlog
    // Vitals decay every tick regardless of events, so the HUD refreshes
    // whenever the sim actually advanced, not just on movement.
    if (ticksThisFrame > 0) updateHud();

    partyView.update(nowMs);
    doorViews.update(nowMs);
    projectileViews.update(nowMs);
    hoverHighlighter.update();

    // Light spell: brighter, farther torch while the boost holds (M0.9).
    const lightBoosted = state.party.lightBoostUntil > state.tick;
    const seconds = nowMs / 1000;
    let intensity = TORCH_BASE_INTENSITY * (lightBoosted ? LIGHT_BOOST_INTENSITY_MULT : 1);
    for (const { amplitude, rate } of TORCH_FLICKER) {
      intensity += Math.sin(seconds * rate) * amplitude;
    }
    torch.intensity = intensity;
    torch.distance = lightBoosted ? LIGHT_BOOST_DISTANCE : TORCH_DISTANCE;

    renderer.render(scene, camera);
    document.body.dataset.ready = "true";
    document.body.dataset.settled = partyView.isIdle() ? "true" : "false";
  });
}

main().catch((err: unknown) => {
  console.error(err);
});
