import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/.next/**",
      "**/.expo/**",
      "**/dist/**",
      "**/coverage/**",
      "backend/src/generated/**",
      "pnpm-lock.yaml",
      "next-env.d.ts",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.{js,mjs,cjs,ts,tsx}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "@typescript-eslint/consistent-type-imports": "error",
      "@typescript-eslint/no-explicit-any": "error",
      "no-console": "off",
    },
  },
  {
    files: [
      "**/*.config.{js,cjs,mjs,ts}",
      "**/metro.config.js",
      "**/babel.config.js",
      "**/tailwind.config.js",
      "**/postcss.config.mjs",
    ],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },
  prettier,
);
