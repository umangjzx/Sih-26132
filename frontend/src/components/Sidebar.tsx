"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon } from "./ui";
import { Logo } from "./Logo";

export function Sidebar({ isOpen, onClose }: { isOpen: boolean; onClose: () => void }) {
  const pathname = usePathname();

  const links = [
    { href: "/", label: "Home", icon: "house" },
    { href: "/prices", label: "Prices", icon: "chart" },
    { href: "/advisor", label: "Advisor", icon: "spark" },
    { href: "/directory", label: "Directory", icon: "warehouse" },
    { href: "/explore", label: "Explore", icon: "globe" },
    { href: "/alerts", label: "Alerts", icon: "bell" },
  ];

  const tradeLinks = [
    { href: "/farmer", label: "Farmer", icon: "leaf" },
    { href: "/buyer", label: "Buyer", icon: "handshake" },
    { href: "/matches", label: "Matches", icon: "connection" },
    { href: "/history", label: "History", icon: "clock" },
    { href: "/deals", label: "Deals", icon: "handshake" },
  ];

  const renderLink = (link: any) => {
    const active = pathname === link.href;
    return (
      <Link
        key={link.href}
        href={link.href}
        onClick={onClose}
        className={`flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium transition-all ${
          active
            ? "bg-[var(--green-600)] text-white shadow-md shadow-black/10"
            : "text-[var(--green-50)] hover:bg-white/10 hover:text-white"
        }`}
      >
        <Icon name={link.icon} size={20} className={active ? "opacity-100" : "opacity-80"} />
        {link.label}
      </Link>
    );
  };

  const sidebarClasses = `fixed inset-y-0 left-0 z-50 flex w-72 flex-col bg-[#122c1d] text-white shadow-2xl transition-transform duration-300 lg:translate-x-0 ${
    isOpen ? "translate-x-0" : "-translate-x-full"
  }`;

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm lg:hidden" 
          onClick={onClose}
        />
      )}
      
      <aside className={sidebarClasses}>
        <div className="flex h-16 shrink-0 items-center px-6">
          <Link href="/" onClick={onClose}>
            <Logo size={40} variant="sidebar" />
          </Link>
        </div>

        <nav className="flex flex-1 flex-col gap-8 overflow-y-auto p-4 custom-scrollbar">
          <div className="flex flex-col gap-1.5">
            {links.map(renderLink)}
          </div>

          <div>
            <div className="mb-3 px-4 text-xs font-bold uppercase tracking-widest text-[var(--green-200)]/70">
              Trade & Logistics
            </div>
            <div className="flex flex-col gap-1.5">
              {tradeLinks.map(renderLink)}
            </div>
          </div>
        </nav>

        <div className="border-t border-white/10 p-4">
          <Link 
            href="/admin" 
            onClick={onClose}
            className="flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium text-[var(--green-50)] hover:bg-white/10 hover:text-white"
          >
            <Icon name="shield" size={20} className="opacity-80" />
            Administration
          </Link>
        </div>
      </aside>
    </>
  );
}
