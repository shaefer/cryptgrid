import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/node_modules/**", "**/*.config.*"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    // Sim purity (docs/ARCHITECTURE.md "Sim rules"): no rendering/DOM deps, no wall-clock, no unseeded RNG.
    files: ["packages/sim/**/*.ts"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["three", "three/*"], message: "packages/sim must not depend on three." },
            { group: ["react", "react-*"], message: "packages/sim must not depend on react." },
          ],
        },
      ],
      "no-restricted-globals": [
        "error",
        { name: "window", message: "Sim is DOM-free." },
        { name: "document", message: "Sim is DOM-free." },
        { name: "fetch", message: "Sim does no I/O; clients load data and pass it in." },
        { name: "localStorage", message: "Sim is DOM-free." },
        { name: "performance", message: "Time in the sim is an integer tick counter." },
        { name: "requestAnimationFrame", message: "Sim is render-free." },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Date", property: "now", message: "Time in the sim is an integer tick counter." },
        { object: "Math", property: "random", message: "All randomness via the injected seeded RNG (rng.ts)." },
      ],
    },
  },
);
