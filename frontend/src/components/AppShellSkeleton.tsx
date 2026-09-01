// Locale-neutral placeholder rendered by LocaleProvider until the stored locale
// is resolved on the client. It must not translate or contain any user-facing
// words: the server render and the first client render both produce this exact
// markup, so there is no hydration mismatch and no English flash.
export function AppShellSkeleton() {
  return (
    <div role="status" className="mx-auto w-full max-w-5xl px-4 py-6">
      <div aria-hidden="true" className="h-8 w-48 animate-pulse rounded-lg bg-stone-200" />
      <div aria-hidden="true" className="mt-6 h-40 w-full animate-pulse rounded-lg bg-stone-200" />
      <div aria-hidden="true" className="mt-4 h-40 w-full animate-pulse rounded-lg bg-stone-200" />
      <div aria-hidden="true" className="mt-4 h-24 w-full animate-pulse rounded-lg bg-stone-200" />
    </div>
  );
}
