import { render, screen } from '@testing-library/svelte';
import { expect, test, beforeAll } from 'vitest';
import ExperienceTimeline from './ExperienceTimeline.svelte';

// Mock intersection observer for the 'inview' action used in the timeline
beforeAll(() => {
  window.IntersectionObserver = class IntersectionObserver {
    constructor() {}
    observe() {}
    unobserve() {}
    disconnect() {}
  } as unknown as typeof IntersectionObserver;
});

test('renders the experience timeline from config data', () => {
  // @ts-expect-error - Svelte 5 component type mismatch with testing-library
  render(ExperienceTimeline);

  // We should see titles from the personalInfo.ts injected into the component
  const traineeRole = screen.getByText('AI Trainee Developer');
  expect(traineeRole).toBeInTheDocument();

  const gdgRole = screen.getByText(/Google Developer Group on Campus/i);
  expect(gdgRole).toBeInTheDocument();
});
