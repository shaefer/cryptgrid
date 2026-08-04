import { SIM_VERSION } from "@cryptgrid/sim";

export function App() {
  return (
    <main style={{ padding: "3rem", maxWidth: 640, margin: "0 auto" }}>
      <h1>Cryptgrid Level Editor</h1>
      <p>
        Scaffold stub (sim v{SIM_VERSION}). The grid painter arrives in M0.10 — see{" "}
        <code>docs/LEVELS.md</code> for the editor spec and level JSON contract.
      </p>
    </main>
  );
}
