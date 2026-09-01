import { render } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import type { ReactElement } from "react";

import en from "@/i18n/messages/en.json";

export { screen } from "@testing-library/react";

/**
 * Render a component wrapped in NextIntlClientProvider with the English catalog,
 * so `useTranslations` works in component tests without the full LocaleProvider.
 */
export function renderWithIntl(ui: ReactElement) {
  return render(
    <NextIntlClientProvider locale="en" messages={en} timeZone="Asia/Kolkata">
      {ui}
    </NextIntlClientProvider>,
  );
}
