/**
 * Gmail -> GitHub trigger for the seating-plan sync.
 *
 * Watches the compilersociety mailbox and fires the "Sync seating plan"
 * GitHub Actions workflow ONLY when a new unread email with "seating" in the
 * subject arrives. No email => no run.
 *
 * ── SETUP (do this once, signed in as compilersociety@gmail.com) ──────────────
 * 1. Go to https://script.google.com  ->  New project.
 * 2. Delete the sample code, paste this whole file, and set GITHUB_TOKEN below.
 *    - Create the token at https://github.com/settings/tokens?type=beta
 *      (Fine-grained PAT): Repository access = only "Riftwalker23x/Compiler2.0",
 *      Permissions -> Repository -> "Contents: Read and write".
 *      (Or a classic token with the "repo" scope.)
 * 3. Save. Run `checkSeatingEmails` once and approve the Gmail/UrlFetch access
 *    prompt.
 * 4. Left sidebar -> Triggers (clock icon) -> Add Trigger:
 *      Function: checkSeatingEmails
 *      Event source: Time-driven -> Minutes timer -> Every minute
 *    (1 minute is Apps Script's fastest polling interval.)
 *
 * That's it. New seating email -> within ~1 min the workflow runs and the site
 * updates. For true real-time (seconds) you'd need Gmail push via Google Cloud
 * Pub/Sub, which is a lot more setup; polling every minute is the simple choice.
 */

const GITHUB_OWNER = 'Riftwalker23x';
const GITHUB_REPO  = 'Compiler2.0';
const GITHUB_TOKEN = 'PASTE_YOUR_GITHUB_TOKEN_HERE';

function checkSeatingEmails() {
  // Unread, subject contains "seating", from the last day. The workflow marks
  // the email read once processed, so it won't be triggered again.
  const threads = GmailApp.search('is:unread subject:seating newer_than:1d');
  if (!threads.length) {
    return; // nothing new -> do not trigger the workflow
  }

  const url = 'https://api.github.com/repos/' + GITHUB_OWNER + '/' + GITHUB_REPO + '/dispatches';
  const response = UrlFetchApp.fetch(url, {
    method: 'post',
    contentType: 'application/json',
    headers: {
      Authorization: 'Bearer ' + GITHUB_TOKEN,
      Accept: 'application/vnd.github+json',
    },
    payload: JSON.stringify({ event_type: 'new-seating-email' }),
    muteHttpExceptions: true,
  });

  const code = response.getResponseCode();
  if (code === 204) {
    Logger.log('Triggered seating-plan sync (%s unread thread(s)).', threads.length);
  } else {
    Logger.log('GitHub dispatch failed: %s %s', code, response.getContentText());
  }
}
