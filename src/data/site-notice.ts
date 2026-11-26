export type SiteNoticeMode = 'auto' | 'on' | 'off';

export const siteNotice = {
  // auto: show once the /now date is older than staleAfterMonths. on: always. off: never.
  mode: 'auto' as SiteNoticeMode,
  staleAfterMonths: 6,
  // Optional override text for mode 'on'; empty uses the default wording.
  message: '',
};
