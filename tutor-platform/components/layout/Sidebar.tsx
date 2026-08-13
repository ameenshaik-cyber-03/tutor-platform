"use client";

import Link from "next/link";
import { Plus, BookOpen, Briefcase, Clock, Settings } from "lucide-react";

interface SidebarProps {
  historyGroups?: { label: string; sessions: { id: string; title: string }[] }[];
}

export function Sidebar({ historyGroups = [] }: SidebarProps) {
  return (
    <aside className="w-64 shrink-0 h-screen border-r border-primary/10 bg-paper flex flex-col">
      <div className="p-4">
        <Link
          href="/learn"
          className="w-full flex items-center justify-center gap-2 btn-3d text-sm py-2.5"
        >
          <Plus size={16} />
          New session
        </Link>
      </div>

      <nav className="px-4 flex flex-col gap-1 text-sm">
        <SidebarLink href="/learn" icon={<BookOpen size={16} />} label="Learn" />
        <SidebarLink href="/prep" icon={<Briefcase size={16} />} label="Career Prep" />
      </nav>

      <div className="flex-1 overflow-y-auto px-4 mt-6">
        <div className="flex items-center gap-1.5 text-xs uppercase tracking-wide text-ink/40 mb-2">
          <Clock size={12} />
          History
        </div>
        {historyGroups.length === 0 && (
          <p className="text-xs text-ink/40 italic px-1">
            Your sessions will show up here once you start one.
          </p>
        )}
        {historyGroups.map((group) => (
          <div key={group.label} className="mb-4">
            <p className="text-xs text-ink/40 mb-1 px-1">{group.label}</p>
            {group.sessions.map((s) => (
              <Link
                key={s.id}
                href={`/learn/${s.id}`}
                className="block w-full text-left px-2 py-1.5 rounded-md text-sm text-ink/80 hover:bg-primary/5 truncate"
              >
                {s.title}
              </Link>
            ))}
          </div>
        ))}
      </div>

      <div className="p-4 border-t border-primary/10">
        <SidebarLink href="/settings" icon={<Settings size={16} />} label="Settings" />
      </div>
    </aside>
  );
}

function SidebarLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 px-2 py-2 rounded-md text-ink/80 hover:bg-primary/5 transition-colors text-left">
      {icon}
      {label}
    </Link>
  );
}
