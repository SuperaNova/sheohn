import { describe, expect, it } from 'vitest';
import { personalInfo } from './personalInfo';

describe('Personal Info Config', () => {
  it('should contain a valid name and title', () => {
    expect(personalInfo.name).toBeDefined();
    expect(personalInfo.name.length).toBeGreaterThan(0);
    expect(personalInfo.title).toBeDefined();
    expect(personalInfo.title.length).toBeGreaterThan(0);
  });

  it('should contain an about section with paragraphs', () => {
    expect(personalInfo.about).toBeDefined();
    expect(Array.isArray(personalInfo.about.paragraphs)).toBe(true);
    expect(personalInfo.about.paragraphs.length).toBeGreaterThan(0);
  });

  it('should contain an experience array with valid entries', () => {
    expect(Array.isArray(personalInfo.experience)).toBe(true);
    expect(personalInfo.experience.length).toBeGreaterThan(0);

    const firstJob = personalInfo.experience[0];
    expect(firstJob).toHaveProperty('id');
    expect(firstJob).toHaveProperty('role');
    expect(firstJob).toHaveProperty('organization');
  });
});
