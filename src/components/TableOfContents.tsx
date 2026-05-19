import { useEffect, useState } from 'react';

type Heading = {
  depth: number;
  slug: string;
  text: string;
};

interface TableOfContentsProps {
  headings: Heading[];
}

export default function TableOfContents({ headings }: TableOfContentsProps) {
  const [activeId, setActiveId] = useState<string>('');

  useEffect(() => {
    // Collect all heading elements
    const elements = headings.map((heading) => 
      document.getElementById(heading.slug)
    ).filter(Boolean) as HTMLElement[];

    if (elements.length === 0) return;

    // Use IntersectionObserver to determine the active heading
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            setActiveId(entry.target.id);
          }
        });
      },
      {
        rootMargin: '-10% 0px -80% 0px', // Trigger when heading is near the top
        threshold: 1.0,
      }
    );

    elements.forEach((el) => observer.observe(el));

    return () => observer.disconnect();
  }, [headings]);

  if (headings.length === 0) return null;

  // Filter out h1s, generally we only want h2s and h3s in the TOC
  const tocHeadings = headings.filter((h) => h.depth > 1 && h.depth <= 3);

  return (
    <nav className="pr-8 pb-12">
      <a 
        href="/projects" 
        className="group inline-flex items-center gap-2 text-[10px] font-bold tracking-[0.15em] text-[var(--color-on-surface-muted)] uppercase mb-12 hover:text-[var(--color-on-surface)] transition-colors"
      >
        <span className="transition-transform group-hover:-translate-x-1">←</span>
        Back
      </a>
      
      <ul className="flex flex-col gap-4 border-l border-[var(--color-outline-variant)]">
        {tocHeadings.map((heading) => {
          const isActive = activeId === heading.slug;
          
          return (
            <li 
              key={heading.slug} 
              className={`relative ${heading.depth === 3 ? 'ml-4' : ''}`}
            >
              {/* Active Indicator Dot */}
              {isActive && (
                <div className="absolute -left-[5px] top-1/2 -translate-y-1/2 w-2 h-2 rounded-full bg-[#f26522] z-10" />
              )}
              
              <a
                href={`#${heading.slug}`}
                className={`block pl-4 text-xs font-medium transition-colors ${
                  isActive 
                    ? 'text-[var(--color-on-surface)]' 
                    : 'text-[var(--color-on-surface-muted)] hover:text-[var(--color-on-surface)]'
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
