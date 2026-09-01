import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, expect, it } from "vitest";

import { LocaleProvider } from "@/i18n/LocaleProvider";

import { LanguageSwitcher } from "./LanguageSwitcher";

afterEach(() => {
  localStorage.clear();
  document.documentElement.lang = "";
});

it("changes locale, persists it, and updates <html lang>", async () => {
  render(
    <LocaleProvider>
      <LanguageSwitcher />
    </LocaleProvider>,
  );

  const select = await screen.findByLabelText(/language/i);
  await userEvent.selectOptions(select, "hi");

  expect(localStorage.getItem("agrilink.locale")).toBe("hi");
  expect(document.documentElement.lang).toBe("hi");
});

it("restores the persisted locale on a fresh mount", async () => {
  const first = render(
    <LocaleProvider>
      <LanguageSwitcher />
    </LocaleProvider>,
  );

  await userEvent.selectOptions(await screen.findByLabelText(/language/i), "mr");
  expect(localStorage.getItem("agrilink.locale")).toBe("mr");

  first.unmount();

  render(
    <LocaleProvider>
      <LanguageSwitcher />
    </LocaleProvider>,
  );

  // After the switch the accessible label is localized ("भाषा"), so query by role.
  const select = (await screen.findByRole("combobox")) as HTMLSelectElement;
  expect(select.value).toBe("mr");
  expect(document.documentElement.lang).toBe("mr");
});
