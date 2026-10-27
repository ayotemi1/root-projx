/** Reserve the tab during the click, before awaiting the authenticated request. */
export async function openStripeOnboardingTab(
  requestLink: () => Promise<{ url: string }>,
  browser: Pick<Window, "open"> = window,
): Promise<void> {
  const tab = browser.open("about:blank", "_blank");
  if (!tab) {
    throw new Error("Please allow pop-ups for this website, then try connecting Stripe again.");
  }
  try {
    tab.opener = null;
    const { url } = await requestLink();
    if (tab.closed) throw new Error("The Stripe setup tab was closed. Please try again.");
    tab.location.replace(url);
  } catch (error) {
    tab.close();
    throw error;
  }
}
