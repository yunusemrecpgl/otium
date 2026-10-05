// Catalog-only instructions: no widget renderers, config or media dependencies.
// The detail metadata can be extended with optional tutorial media later.
export interface WidgetUsage {
  usageSteps: readonly string[];
  tip?: string;
  modes?: readonly { name: string; description: string }[];
}

export const widgetUsage: Readonly<Record<string, WidgetUsage>> = {
  note: { usageSteps: [
    'Add Note from the Project + menu.',
    'Click the title or content to edit directly.',
    'Select the widget and use the floating formatting bar to change its appearance.',
  ] },
  todo: { usageSteps: [
    'Add Todo from the Project + menu.',
    'Use + Add task inside the widget to create tasks.',
    'Check tasks when complete; edit or remove them as needed.',
  ] },
  text: { usageSteps: [
    'Add Text / Label from the Project + menu.',
    'Click its text directly on the canvas to edit it.',
    'Use the floating formatting bar for typography, color and alignment.',
  ] },
  clip: { usageSteps: [
    'Grant page access if requested.',
    'Select text on a webpage.',
    'Open the Otium extension popup.',
    'Choose Add Selection to Project, then select a Project.',
    'Use Open Source later to return to the captured source.',
  ] },
  compare: { usageSteps: [
    'Add Compare from the Project + menu.',
    'Create or edit columns and rows directly in the widget.',
    'Enter values into the cells.',
    'Use the floating formatting bar for display options.',
  ] },
  resource: { usageSteps: [
    'Add Resource from the Project + menu.',
    'Select it and enter the source URL in the floating inspector.',
    'Optionally set a date and time.',
    'Edit its label on the canvas and use Open to visit the source. A date shows a countdown.',
  ] },
  'web-data': { usageSteps: [
    'Add Web Data from the Project + menu.',
    'Enter a public JSON endpoint in the floating inspector and choose Connect. Grant source access if requested.',
    'In Response Explorer, check the fields you want to display.',
    'Rename field labels directly on the canvas if needed.',
    'Set a refresh interval in the floating inspector.',
  ] },
  'page-watch': { usageSteps: [
    'Add Page Watch from the Project + menu.',
    'Enter the webpage URL and open Configure source. Use Static mode for text in the page’s returned HTML.',
    'Open that webpage in your browser.',
    'Right-click the value you want to monitor and choose Inspect.',
    'In DevTools, right-click the matching HTML element.',
    'Choose Copy → Copy selector.',
    'Paste the selector into a watched field in Otium. Grant source access if requested.',
    'Refresh once to create the initial baseline.',
    'Otium compares later successful checks against that value while the widget is open.',
  ], tip: 'Website-generated selectors can change. Prefer a stable id or class selector when available.', modes: [
    { name: 'Direct', description: 'Use Discover source and JSON paths when a page exposes structured data.' },
    { name: 'Rendered', description: 'Use this for values rendered by the page’s JavaScript. Grant page access if requested and keep the matching page open in a browser tab.' },
  ] },
  formula: { usageSteps: [
    'Add Formula from the Project + menu.',
    'Create variables and assign values.',
    'Write an expression using those variable names.',
    'Use sqrt(), pow(), log() or mod() when needed.',
    'The result updates from the current values.',
  ] },
  rss: { usageSteps: [
    'Add RSS Feed from the Project + menu.',
    'Paste a public RSS or Atom feed URL in the floating inspector. Grant source access if requested.',
    'Choose the item count and refresh interval.',
    'Otium displays the latest feed entries; click an article to open it.',
  ] },
  'website-icons': { usageSteps: [
    'Grant website-icon access here or during the first-run step.',
    'Otium automatically uses browser-saved favicons for links when available.',
    'No additional setup is required. Website Icons is a capability, not a Project widget.',
  ] },
};
