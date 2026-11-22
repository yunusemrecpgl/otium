import { chromeStorageProvider } from './storage/provider';

export const BOOKMARK_IMPORT_ONBOARDING_KEY = 'bookmarkImportOnboardingPending';

export const bookmarkImportOnboarding = {
  async pending() {
    return (await chromeStorageProvider.read([BOOKMARK_IMPORT_ONBOARDING_KEY]))[BOOKMARK_IMPORT_ONBOARDING_KEY] === true;
  },
  complete: () => chromeStorageProvider.write({ [BOOKMARK_IMPORT_ONBOARDING_KEY]: false }),
  subscribe: (onComplete: () => void) => chromeStorageProvider.subscribe!(BOOKMARK_IMPORT_ONBOARDING_KEY, value => {
    if (value === false) onComplete();
  }),
};
