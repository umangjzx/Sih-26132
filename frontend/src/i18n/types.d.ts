// DX only: makes `useTranslations` keys type-safe against en.json (the source of
// truth, D-19). tsc then flags keys used in code that are missing from en.json.
// It does NOT enforce hi/mr JSON parity — that is the job of messages/parity.test.ts.
import type en from "./messages/en.json";

declare module "next-intl" {
  interface AppConfig {
    Messages: typeof en;
  }
}
