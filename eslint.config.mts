import eslint from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintPluginPrettier from "eslint-plugin-prettier/recommended";

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.recommended,
  eslintPluginPrettier,
  {
    rules: {
      // Vos règles personnalisées
      eqeqeq: ["error", "always"],
      "prefer-const": ["error", { destructuring: "all" }],
      "no-useless-rename": "error",
      "no-useless-constructor": "error",
      "no-console": "error",
      "no-debugger": "error",
      "no-throw-literal": "error",
      "no-unused-expressions": "error",
      "no-var": "error",
      "no-redeclare": "error",
      "no-const-assign": "error",
      "@typescript-eslint/no-unused-vars": "error",
      "@typescript-eslint/no-explicit-any": "warn",
      "prettier/prettier": "error",
    },
  },
);
