// Generates the typed receipts-api client and TanStack Query hooks from the service's OpenAPI file:
//   pnpm --filter mobile generate:api
// The output in src/api/generated is committed; edit services/receipts-api/openapi.yaml, not the output.
import { defineConfig } from "orval";

export default defineConfig({
  receipts: {
    input: { target: "../services/receipts-api/openapi.yaml" },
    output: {
      target: "./src/api/generated/receipts.ts",
      schemas: "./src/api/generated/model",
      client: "react-query",
      httpClient: "fetch",
      mode: "single",
      clean: true,
      override: {
        mutator: { path: "./src/api/fetcher.ts", name: "receiptsFetch" },
        fetch: { includeHttpResponseReturnType: false },
      },
    },
  },
});
