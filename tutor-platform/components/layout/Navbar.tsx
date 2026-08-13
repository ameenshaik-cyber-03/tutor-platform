"use client";

import { useState } from "react";
import Link from "next/link";
import { Search, Paperclip, Mic, ChevronDown, Settings, LogOut } from "lucide-react";
import { signOut } from "@/app/(auth)/actions";

interface NavbarProps {
  displayName: string;
}

export function Navbar({ displayName }: NavbarProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const initial = displayName.trim().charAt(0).toUpperCase() || "U";

  return (
    <header className="h-16 border-b border-primary/10 flex items-center gap-4 px-6 bg-paper relative">
      <div className="flex-1 max-w-xl relative">
        <Search
          size={16}
          className="absolute left-3 top-1/2 -translate-y-1/2 text-ink/40"
        />
        <input
          type="text"
          placeholder="Ask a topic, or attach a file to study from..."
          className="w-full pl-9 pr-16 py-2 rounded-full bg-primary/5 text-sm placeholder:text-ink/40 focus:outline-none focus:ring-2 focus:ring-secondary/40"
        />
        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
          <button aria-label="Attach a file" className="p-1.5 rounded-full hover:bg-primary/10 text-ink/50">
            <Paperclip size={15} />
          </button>
          <button aria-label="Voice input" className="p-1.5 rounded-full hover:bg-primary/10 text-ink/50">
            <Mic size={15} />
          </button>
        </div>
      </div>

      <button className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-primary/15 text-sm hover:bg-primary/5">
        <span className="w-6 h-6 rounded-full bg-secondary/20 flex items-center justify-center text-xs font-medium text-secondary">
          N
        </span>
        Nova
        <ChevronDown size={14} className="text-ink/40" />
      </button>

      <div className="relative">
        <button
          onClick={() => setMenuOpen((v) => !v)}
          className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-medium text-primary"
        >
          {initial}
        </button>

        {menuOpen && (
          <div className="absolute right-0 top-10 w-48 bg-white border border-primary/10 rounded-card shadow-lg py-1 z-10">
            <p className="px-3 py-2 text-xs text-ink/40 truncate border-b border-primary/10">
              {displayName}
            </p>
            <Link
              href="/settings"
              className="flex items-center gap-2 px-3 py-2 text-sm hover:bg-primary/5"
              onClick={() => setMenuOpen(false)}
            >
              <Settings size={14} />
              Settings
            </Link>
            <form action={signOut}>
              <button
                type="submit"
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-danger hover:bg-danger/5"
              >
                <LogOut size={14} />
                Log out
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
