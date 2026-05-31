import { expect, test, describe } from 'vitest';
import { get } from 'svelte/store';
import {
  activeFocus,
  setFocus,
  clearFocus,
  agentQuery,
  dispatchAgentQuery,
  spotlight,
  sceneCommand,
  dispatchScene,
  clearSpotlight,
  routeCommand,
  dispatchRoute,
  theme,
  setTheme,
  toggleTheme,
} from './store';

describe('Global Store Actions', () => {
  test('focus state can be set and cleared', () => {
    setFocus('test-focus');
    expect(get(activeFocus)).toBe('test-focus');
    clearFocus();
    expect(get(activeFocus)).toBe(null);
  });

  test('agent query dispatches with timestamp', () => {
    dispatchAgentQuery('hello test');
    const query = get(agentQuery);
    expect(query?.text).toBe('hello test');
    expect(query?.ts).toBeGreaterThan(0);
  });

  test('scene commands dispatch target correctly', () => {
    dispatchScene('hero');
    const sc = get(sceneCommand);
    expect(sc?.target).toBe('hero');
    expect(sc?.ts).toBeGreaterThan(0);

    spotlight.set('spotlit-section');
    clearSpotlight();
    expect(get(spotlight)).toBe(null);
  });

  test('route commands dispatch path correctly', () => {
    dispatchRoute('/projects');
    const route = get(routeCommand);
    expect(route?.path).toBe('/projects');
    expect(route?.ts).toBeGreaterThan(0);
  });

  test('theme can be toggled and set', () => {
    setTheme('light');
    expect(get(theme)).toBe('light');
    toggleTheme();
    expect(get(theme)).toBe('dark');
  });
});
