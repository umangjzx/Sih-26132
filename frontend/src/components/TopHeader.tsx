"use client";

import { Icon } from "./ui";
import { LocationChip } from "./LocationChip";
import { NotificationBell } from "./NotificationBell";
import { LanguageSwitcher } from "./LanguageSwitcher";
import { useAuth } from "./AuthProvider";

export function TopHeader({ onOpenSidebar }: { onOpenSidebar: () => void }) {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { user } = useAuth();
  
  return (
    <header className="sticky top-0 z-40 flex h-16 w-full items-center justify-between border-b border-[var(--line)] bg-[var(--surface)]/90 px-4 backdrop-blur-md sm:px-6">
      <div className="flex items-center gap-4 lg:hidden">
        <button
          onClick={onOpenSidebar}
          className="rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--paper)]"
          aria-label="Open Menu"
        >
          <Icon name="menu" size={24} />
        </button>
      </div>

      {/* Spacer for desktop to keep center aligned */}
      <div className="hidden w-8 lg:block"></div>

      <div className="flex flex-1 justify-center lg:justify-start lg:pl-8">
        <LocationChip />
      </div>

      <div className="flex items-center gap-3">
        <NotificationBell />
        <LanguageSwitcher />
        <div className="flex cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-[var(--paper)] py-1 pl-1 pr-3 transition-colors hover:bg-[var(--line)]/50">
           <img 
             src="https://ui-avatars.com/api/?name=Farmer&background=1E5B3A&color=fff" 
             alt="User" 
             className="h-7 w-7 rounded-full" 
           />
           <span className="hidden text-sm font-semibold sm:block">Farmer</span>
        </div>
      </div>
    </header>
  );
}
