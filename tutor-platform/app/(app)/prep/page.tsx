// Career Prep hub: resume analyzer, mock interviews, mock tests entry points.
import Link from "next/link";

const SECTIONS = [
  { href: "/prep/resume", title: "Resume Analyzer", desc: "Upload your resume, get role-specific feedback." },
  { href: "/prep/interview/hr", title: "Mock HR Interview", desc: "Behavioral questions, STAR-format feedback." },
  { href: "/prep/interview/technical", title: "Mock Technical Interview", desc: "DSA + role-specific technical rounds." },
  { href: "/prep/interview/aptitude", title: "Mock Aptitude Test", desc: "Timed MCQs from your syllabus or role." },
];

export default function PrepHubPage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <h1 className="font-display font-extrabold text-3xl mb-1">Career Prep</h1>
      <p className="text-ink/50 mb-8">Practice like the real thing.</p>
      <div className="grid grid-cols-2 gap-4">
        {SECTIONS.map((s) => (
          <Link key={s.href} href={s.href} className="rounded-card border border-primary/10 p-6 hover:border-secondary/40">
            <h2 className="font-display font-extrabold text-lg mb-1">{s.title}</h2>
            <p className="text-sm text-ink/50">{s.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
