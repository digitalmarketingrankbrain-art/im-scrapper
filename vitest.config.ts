import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    // Modules that import the env config need a value; unit tests never open a connection with it.
    env: { MONGODB_URI: "mongodb://127.0.0.1:27017/indiamart_unit_tests" },
    exclude: ["**/node_modules/**", "**/e2e/**"],
  },
});
