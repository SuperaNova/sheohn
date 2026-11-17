export const personalInfo = {
  name: 'Jared Sheohn L. Acebes',
  title: 'Computer Science Student',
  location: 'Cebu, PH',
  timezone: 'Asia/Manila',
  education: 'Bachelor of Science in Computer Science @ CIT-U',
  // Condensed line for the hero's dark-poster typography (both themes).
  heroMeta:
    'BSCS @ CIT-U · President, GDG on Campus · systems, backend, AI workflows',
  // Single toggle for every "available for opportunities" surface.
  availableForOpportunities: true,
  bio: 'I build backend systems, AI pipelines and the occasional interpreter, and I run GDG on Campus at CIT-U. Most of what I make goes a bit deeper than it strictly needs to.',
  strategicNote:
    'I care about software that keeps working when the network, the GPU or the budget is smaller than you hoped.',
  socials: {
    github: 'https://github.com/SuperaNova',
    linkedin: 'https://www.linkedin.com/in/jared-sheohn-acebes-316aab297',
  },
  resumeUrl:
    'https://aleda1faaxt35aum.public.blob.vercel-storage.com/Acebes_Jared_Resume.pdf',
  about: {
    paragraphs: [
      "I'm a CS student at CIT-U in Cebu. I like the parts of software most people skip: the backend that has to stay up, the pipeline that glues models together, the interpreter nobody asked for. I've deployed to the cloud and to on-prem Docker boxes, and I've written a language from scratch, so I'm comfortable at both ends.",
      "Outside class I run GDG on Campus CIT-U, which mostly means organizing workshops and getting people to ship something. When I'm not doing either, I'm usually trying to fit a model into 6 GB of VRAM or automating something that did not need automating.",
    ],
    currentFocusTitle: 'Right now',
    currentFocusDescription:
      "Multi-agent pipelines, and how far local models go when VRAM is the limit. Keeping this site's chat agent honest with rate limits, evals and red-team runs. Finishing my degree in 2027.",
  },
  techStack: [
    {
      category: 'Languages',
      items: [
        'C++',
        'Java',
        'Python',
        'Rust',
        'TypeScript',
        'JavaScript',
        'Dart',
        'SQL',
        'NoSQL',
      ],
    },
    {
      category: 'Cloud & AI',
      items: [
        'GCP',
        'Vertex AI',
        'Gemini',
        'Firebase',
        'LangChain',
        'n8n',
        'Make',
        'Docker',
        'Git',
        'GitHub',
      ],
    },
    {
      category: 'Data & Analysis',
      items: ['Pandas', 'NumPy', 'Matplotlib', 'Jupyter', 'JSON/CSV'],
    },
  ],
  experience: [
    {
      id: 'exp-1',
      date: 'Mar 2025 – Dec 2025',
      role: 'AI Trainee Developer',
      organization: 'Ace-1 IT Solutions',
      description:
        'Built backend services and AI workflows for clients with n8n and LangChain. Set up and looked after on-prem Docker servers and databases, and deployed the cloud-side workflows.',
      category: 'Experience',
    },
    {
      id: 'lead-1',
      date: '2025 – Present',
      role: 'President & Campus Organizer',
      organization: 'Google Developer Group on Campus CIT-U',
      description:
        'Run the chapter: events, workshops and the core team, four workshops and events so far. Was Public Relations Officer the year before (2024-2025).',
      category: 'Leadership',
    },
    {
      id: 'lead-2',
      date: '2025 – Present',
      role: 'Network & Linkages Director',
      organization: 'AWS Cloud Clubs - WildQuacc',
      description:
        'Handle partnerships with other campus orgs and the local tech community. Helped put on two tech events.',
      category: 'Leadership',
    },
    {
      id: 'lead-3',
      date: 'Oct 2025',
      role: 'Management Information Team (MIT) Lead',
      organization: 'Angat Bayanihan Volunteer Network',
      description:
        'Built the information system the network used to track public data and route relief after the 2025 Bogo earthquake: 30,000 families across 44 barangays.',
      category: 'Leadership',
    },
    {
      id: 'edu-1',
      date: 'Expected 2027',
      role: 'Bachelor of Science in Computer Science',
      organization: 'Cebu Institute of Technology - University',
      description:
        'DOST-SEI Junior Level Science Scholarship, Batch 2025. Also on the CIT-U College Dance Troupe scholarship.',
      category: 'Education',
    },
  ],
};

export const firstName = personalInfo.name.split(' ')[0] ?? personalInfo.name;
