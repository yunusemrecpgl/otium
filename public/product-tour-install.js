chrome.runtime.onInstalled.addListener(({ reason }) => {
  if (reason !== 'install') return;
  // Matches ProductTour.tsx. Only a browser-confirmed install arms the tour.
  void chrome.storage.local.set({ productTourState: 'pending' })
    .catch(cause => console.warn('Product tour eligibility could not be saved.', cause));
});
