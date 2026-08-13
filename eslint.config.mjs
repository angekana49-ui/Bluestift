import { dirname } from "path";
import { fileURLToPath } from "url";
import { FlatCompat } from "@eslint/eslintrc";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const compat = new FlatCompat({ baseDirectory: __dirname });

const eslintConfig = [
  {
    // Vendored, not ours: the landing-page design handoff ships a bundled
    // support.js and reference HTML that account for ~30k lint problems and
    // drown every real one. It is a reference artefact, never built or served.
    ignores: [
      "design_handoff_bluestift_landing/**",
      ".archive/**",
      ".next/**",
      "graphify-out/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    rules: {
      // The codebase already signals "deliberately unused" with a leading
      // underscore (_args, _prevProps). Teaching the rule that convention beats
      // renaming the bindings, and keeps `npm run lint` at zero noise — a lint
      // script with one permanent warning is a lint script people stop reading.
      "@typescript-eslint/no-unused-vars": [
        "warn",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
        },
      ],
    },
  },
];

export default eslintConfig;
