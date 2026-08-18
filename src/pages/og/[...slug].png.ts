// Build-time OG/Twitter card generation. One PNG per static page + per
// project case study, all prerendered at astro build (no runtime cost).
import type { APIRoute, GetStaticPaths } from 'astro';
import { getCollection } from 'astro:content';
import { renderOgCard, type OgCardInput } from '../../lib/og-image';
import { personalInfo } from '../../data/personalInfo';

export const prerender = true;

export const getStaticPaths: GetStaticPaths = async () => {
  const sitePaths: { params: { slug: string }; props: OgCardInput }[] = [
    {
      params: { slug: 'home' },
      props: {
        title: `${personalInfo.name} - Portfolio`,
        summary: personalInfo.heroMeta,
        kind: 'site',
      },
    },
    {
      params: { slug: 'about' },
      props: {
        title: 'About Me',
        summary: `About ${personalInfo.name} and his technical experience.`,
        kind: 'site',
      },
    },
    {
      params: { slug: 'projects' },
      props: {
        title: 'Projects & Work',
        summary: `Case studies and featured work by ${personalInfo.name}`,
        kind: 'site',
      },
    },
  ];

  const projects = await getCollection('projects');
  const projectPaths = projects.map((project) => ({
    params: { slug: project.id },
    props: {
      title: project.data.title,
      summary: project.data.summary,
      kind: 'project' as const,
    },
  }));

  return [...sitePaths, ...projectPaths];
};

export const GET: APIRoute<OgCardInput> = async ({ props }) => {
  const png = await renderOgCard(props);
  return new Response(new Uint8Array(png), {
    headers: {
      'Content-Type': 'image/png',
      'Cache-Control': 'public, max-age=31536000, immutable',
    },
  });
};
