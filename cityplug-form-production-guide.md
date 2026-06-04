# CityPlug Form Production Setup Guide

This guide explains how to make the CityPlug quote form ready for production when the website is hosted on GitHub and Cloudflare Pages.

The current form uses Formspree. That is acceptable for this site because the page is static and Formspree handles the form submission, spam filtering and email notification.

## What You Are Setting Up

The aim is simple:

- Website visitor fills in the quote form.
- Formspree receives the form.
- Formspree emails the enquiry to info@cityplug.co.uk.
- Formspree posts the enquiry into a dedicated Discord channel.
- Spam is blocked as much as possible.
- You send one real test enquiry from the live website before using the site properly.

## Part 1 - Log In To Formspree

1. Go to https://formspree.io.
2. Log in to the account that owns the CityPlug form.
3. Look for the form with this endpoint:

   https://formspree.io/f/xvgqrrgv

4. If you cannot find that form, the website may be using a Formspree form from a different account. Do not launch until you know who owns it.

## Part 2 - Verify The Email Destination

The website HTML cannot safely choose the destination email address. The destination must be set inside Formspree.

1. Open the CityPlug form inside Formspree.
2. Find the settings area for email notifications, recipients or routing.
3. Set the recipient email to:

   info@cityplug.co.uk

4. Save the setting.
5. If Formspree asks you to verify the email address, open the mailbox for info@cityplug.co.uk.
6. Click the verification link from Formspree.
7. Go back to Formspree and confirm the recipient is marked as verified.

Important: if info@cityplug.co.uk is not verified, enquiries may not be delivered.

## Part 3 - Enable Spam Protection

Spam protection should be enabled before the site is used by real customers.

1. In Formspree, open the CityPlug form.
2. Look for spam, bot protection, captcha or reCAPTCHA settings.
3. Enable the available spam protection option.
4. Keep Formspree's built-in spam filtering enabled.
5. Save the settings.

The website already has a hidden honeypot field. That helps catch simple bots, but it should not be the only protection.

## Part 4 - Send Enquiries To Discord

The website does not need a Discord webhook in its HTML. Keep the webhook URL inside Formspree only, because Discord webhook URLs are private credentials.

Create a dedicated channel first so quote enquiries do not get mixed into normal chat.

Recommended channel name:

   cityplug-enquiries

Discord setup:

1. In the CityPlug Discord server, create a private text channel named cityplug-enquiries.
2. Limit access to the people who should see customer names, emails, phone numbers and job details.
3. Open the channel settings.
4. Go to Integrations.
5. Select Webhooks.
6. Create a new webhook.
7. Name it CityPlug Formspree.
8. Copy the webhook URL.

Formspree setup:

1. Open the CityPlug form inside Formspree.
2. Go to Workflow or integrations.
3. Add the Discord action.
4. Paste the Discord webhook URL into the Discord channel webhook field.
5. Connect and save the workflow.

Important: do not paste the Discord webhook URL into GitHub, Cloudflare Pages, the website HTML, Discord chat, or any public file.

If the webhook URL is ever exposed, delete that webhook in Discord and create a new one.

## Part 5 - Test From The Live Website

Test the live Cloudflare Pages URL, not just the file on your computer.

1. Open the live CityPlug website in your browser.
2. Scroll to Get a quote.
3. Fill in the form using obvious test details:

   First name: Test
   Last name: Enquiry
   Email: your own email address
   Phone: your own phone number
   Service: Not sure yet
   Postcode area: TEST
   Availability: Flexible
   Job details: This is a test enquiry from the live CityPlug website.

4. Submit the form.
5. Check that the website stays on the CityPlug page, clears the form and shows the local success message.
6. Check info@cityplug.co.uk for the email.
7. Check the cityplug-enquiries Discord channel for the webhook message.
8. Check the Formspree dashboard to confirm the submission appears there.

If the email or Discord message does not arrive:

- Check the spam or junk folder for info@cityplug.co.uk.
- Confirm info@cityplug.co.uk is verified in Formspree.
- Confirm the website form endpoint is still https://formspree.io/f/xvgqrrgv.
- Confirm the form is active in Formspree.
- Confirm the Formspree Discord workflow is enabled.
- Confirm the Discord webhook still exists and points to the cityplug-enquiries channel.

## Part 6 - Photos And File Uploads

The site currently says:

Photos can be sent after the first reply.

That is the safer choice.

Do not add public file upload unless you really need it. Public upload forms create extra risk:

- Spam bots can upload junk.
- Attackers may upload unsafe files.
- Storage can fill up.
- You need rules for file size, file type and scanning.
- You need somewhere secure to store the files.

For this business, it is better to collect the enquiry first. Then reply from info@cityplug.co.uk and ask the customer to send photos if needed.

## Part 7 - Optional Privacy Line

A small privacy line near the form is a good idea because the form collects names, email addresses, phone numbers and job details.

Suggested wording:

We only use your details to respond to your enquiry and arrange your quote.

If you want this added to the site, place it below the Send enquiry button or near the form notes.

## Part 8 - Security Checklist

Before launch, confirm:

- Formspree form xvgqrrgv is owned by the correct account.
- info@cityplug.co.uk is the verified recipient.
- A private Discord channel exists for CityPlug enquiries.
- Formspree has a Discord workflow connected to that channel webhook.
- Spam protection or captcha is enabled in Formspree.
- A real test enquiry works from the live Cloudflare Pages website.
- The test email arrives at info@cityplug.co.uk.
- The test Discord webhook message arrives in the dedicated enquiries channel.
- The form does not ask users to upload files.
- The site does not expose any private API keys.
- The site does not expose the Discord webhook URL.
- Cloudflare Pages is connected to the correct GitHub repo.
- The live site updates after pushing changes to GitHub.

## Part 9 - Longer-Term Better Setup

The best long-term setup is:

- Cloudflare Turnstile for bot protection.
- Cloudflare Pages Function to receive the form.
- A proper email provider to send enquiries to info@cityplug.co.uk.

That setup gives more control and better security, but it is more technical.

For now, Formspree is acceptable if:

- the recipient email is verified,
- spam protection is enabled,
- and a real test enquiry works from the live site.

## Final Launch Rule

Do not treat the form as working until you have received a real test enquiry at info@cityplug.co.uk and in the dedicated Discord enquiries channel from the live website.
