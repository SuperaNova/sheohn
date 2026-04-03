import { motion } from "framer-motion";

const timelineData = [
  {
    id: "exp-1",
    date: "Mar 2025 – Dec 2025",
    role: "AI Trainee Developer",
    organization: "Ace-1 IT Solutions",
    description: "Developed backend systems and AI-driven workflows using n8n and LangChain. Configured on-prem Docker servers, databases, and deployed cloud-based workflows for clients.",
    category: "Experience",
  },
  {
    id: "lead-1",
    date: "2025 – Present",
    role: "President & Campus Organizer",
    organization: "Google Developer Group on Campus CIT-U",
    description: "Leads chapter operations, mentors team members, and expands campus engagement. Previously served as Public Relations Officer (2024-2025).",
    category: "Leadership",
  },
  {
    id: "lead-2",
    date: "2025 – Present",
    role: "Network & Linkages Director",
    organization: "AWS Cloud Clubs - WildQuacc",
    description: "Forges strategic partnerships with campus organizations and the local tech community through targeted outreach, networking, and resource-sharing.",
    category: "Leadership",
  },
  {
    id: "lead-3",
    date: "2025",
    role: "Management Information Team (MIT) Lead",
    organization: "Angat Bayanihan Volunteer Network",
    description: "Developed an information system for public data analysis and coordinated relief deployment to 30,000 families across 44 barangays during the 2025 Bogo earthquake.",
    category: "Leadership",
  },
  {
    id: "edu-1",
    date: "Expected 2027",
    role: "Bachelor of Science in Computer Science",
    organization: "Cebu Institute of Technology - University",
    description: "Certifications: CodeChum C Certificate, CodeChum Java Certificate.",
    category: "Education",
  }
];

export default function ExperienceTimeline() {
  return (
    <div className="mt-20 border-l border-white/10 pl-6 md:pl-10 ml-2 md:ml-4">
      {timelineData.map((item, index) => (
        <motion.div
          key={item.id}
          initial={{ opacity: 0, x: -20 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ duration: 0.5, delay: index * 0.1 }}
          className="relative mb-12 last:mb-0"
        >
          {/* Timeline Dot */}
          <div className="absolute -left-[31px] md:-left-[47px] top-1.5 h-3 w-3 rounded-full bg-[var(--color-primary-container)] ring-4 ring-[var(--color-surface-container-low)]" />
          
          <div className="flex flex-col sm:flex-row sm:items-baseline sm:justify-between gap-2 mb-2">
            <h3 className="text-xl font-semibold text-[var(--color-on-surface)]">{item.role}</h3>
            <span className="shrink-0 text-sm font-medium uppercase tracking-widest text-[var(--color-tertiary)] sm:text-right">
              {item.date}
            </span>
          </div>
          
          <h4 className="text-base text-[var(--color-primary-container)] mb-4">{item.organization}</h4>
          
          <p className="text-sm leading-relaxed text-[var(--color-on-surface-muted)] max-w-3xl">
            {item.description}
          </p>
        </motion.div>
      ))}
    </div>
  );
}