import js from "@eslint/js";
import ts from "typescript-eslint";
import prettier from "eslint-config-prettier";

export default ts.config(
  js.configs.recommended,
  ...ts.configs.recommended,
  prettier,
  {
    ignores: [
      "**/dist/**",
      "**/.aws-sam/**",
      "**/.next/**",
      "**/node_modules/**",
      "**/out/**",
      "**/coverage/**",
      "**/.turbo/**",
      "infrastructure/**",
      "apps/api/prisma/seed.js",
      "apps/api/prisma/seed.d.ts",
    ],
  },
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "off",
      "@typescript-eslint/no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
    },
  },
  {
    files: ["esbuild.config.js", "apps/lambdas/generate-sample-sheet.js"],
    languageOptions: {
      globals: {
        __dirname: "readonly",
        console: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
      },
    },
    rules: {
      "@typescript-eslint/no-require-imports": "off",
      "no-console": "off",
      "no-undef": "off",
    },
  },
);
