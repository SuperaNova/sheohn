# Adding a New Case Study

I'm using **Astro Content Collections** to manage my case studies.

## Step-by-Step

1. Go to the `src/content/projects/` directory.
2. Create a new `.mdx` file. The filename becomes the URL slug (so `proj.mdx` becomes `/projects/proj`).
3. Put the required frontmatter at the top of the file. This tells the system how to build my project card and metadata grid.

### Frontmatter Template

```markdown
---
title: 'Project Title'
summary: 'A quick 1-2 sentence summary of what this project is and what it does.'
category: 'Web App / Systems / Infra'
stack: ['Next.js', 'TypeScript', 'Tailwind']
status: 'Completed' # Or "In Progress"
image: '/path-to-image-in-public-folder.png' # Optional header image
featured: false # Set to true if I want this on the Home page
order: 10 # Lower numbers mean it shows up higher in the list
role: 'Lead Engineer' # Optional
timeline: 'Jan 2026 - Mar 2026' # Optional
team: 'Jared' # Optional
---

## Overview

Write the case study content here using standard Markdown (or MDX components)...
```

4. **Write the content:** Below the `---` line, just write it in mdx stuff
5. **Add an image:** If I linked an `image` in the frontmatter, I need to make sure the actual image file is dropped in the `public/` folder.
6. **Preview:** Run `npm run dev` and check `/projects` to make sure it looks clean.

## Making a Project "Featured"

The home page (`index.astro`) is set up to pull my top featured projects.
To get a project on the home page:

1. Change `featured: true` in its frontmatter.
2. Make sure its `order` number is lower than the others so it takes priority (e.g., `order: 1`).
