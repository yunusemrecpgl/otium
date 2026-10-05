import { chromeStorageProvider } from './storage/provider';

// Local onboarding preference, independent of workspace/export schemas.
const KEY = 'websiteIconsOnboardingSeen';
export const websiteIconsOnboarding = {
  async completed(): Promise<boolean> {
    return (await chromeStorageProvider.read([KEY]))[KEY] === true;
  },
  complete: () => chromeStorageProvider.write({ [KEY]: true }),
  subscribe: (onComplete: () => void) => chromeStorageProvider.subscribe!(KEY, value => { if (value === true) onComplete(); }),
};
