# Cityplug Static Site

Static mirror of https://www.cityplug.co.uk prepared for GitHub and Cloudflare Pages.

## Local Preview

Run from this folder:

    npm run serve

Then open:

    http://localhost:8788

No build step is required.

## Cloudflare Pages

Use these settings when connecting the GitHub repository to Cloudflare Pages:

- Framework preset: None
- Build command: leave blank
- Build output directory: /
- Root directory: repository root, if this folder is the repository root

If this folder is copied into a larger repository, set the Cloudflare Pages root directory to the folder containing this README.

## Current External Services

- Contact form posts to Formspree: https://formspree.io/f/xvgqrrgv
- Instagram link points to: https://instagram.com/cp_installers

## Windows attended-support installer

The extensionless `/win` route is a PowerShell bootstrapper intended to be launched from an elevated Windows PowerShell session:

    irm https://cityplug.co.uk/win | iex

It installs pinned official Tailscale and RustDesk MSI packages only after SHA-256, Authenticode subject, signer-certificate thumbprint, and exact packaged-build verification. Before the RustDesk MSI can run, the bootstrapper requires Windows Defender Firewall to be running with every effective profile enabled, local rules permitted, and verified inbound/outbound RustDesk block rules present in `ActiveStore`. Tailscale enrolment uses a one-off, non-pre-approved auth key entered securely at runtime; never add an auth key, reusable enrolment token, RustDesk permanent access secret, or other credential to this public repository. Run the command from an already elevated 64-bit Windows 10/11 PowerShell session.

The client is configured for attended support only:

- any existing permanent RustDesk access secret is removed and the daemon must acknowledge the change;
- the customer must open and keep the RustDesk window open;
- every connection requires the customer to click **Accept**;
- private signal server, relay server, public key, and every safety option are read back before success is reported;
- remote configuration changes, LAN discovery, terminal, tunnelling, remote restart, and automatic updates are disabled;
- Tailscale shields-up blocks incoming connections to the customer's computer;
- RustDesk remains under verified bidirectional firewall quarantine until every attended-only setting and service state passes readback;
- any incomplete or unverifiable RustDesk configuration leaves its process and service stopped and disabled;
- the script records operational messages under `%ProgramData%\CityPlug\SupportBootstrap`, accepts the auth key through a masked prompt, passes only a protected temporary key file to Tailscale, and removes that file immediately after enrolment;
- after registration, the script waits up to 15 minutes for console approval and verified connectivity to the private RustDesk server.

Before onboarding a customer:

1. Enable **Device approval** for the CityPlug tailnet.
2. In **Settings → Keys**, generate a short-expiry, **one-off** key with **Pre-approved disabled** and no reusable capability.
3. Deliver that key to the operator through an approved private channel; never place it in the public `/win` script, URL, ticket, or log.
4. When the script reports that the device is registered, approve the pending machine in **Machines**. The script resumes automatically after connectivity is available.

The enrolled client joins only the CityPlug tailnet permissions granted by its user/tag and remains shielded from inbound tailnet connections. Keep ACL/grant policy limited to the private `apollo-rustdesk` signal/relay service and required ports; do not grant general subnet access.

When updating either dependency:

1. Select an explicit stable version from the publisher's official release channel.
2. Download the exact MSI and independently record its SHA-256.
3. Verify its Authenticode chain and expected publisher.
4. Update the pinned URL, filename, version, hash, and tests together.
5. Parse the script with PowerShell, run the full site suite, and perform a clean Windows installation plus rerun test.
6. Verify `/win` live byte-for-byte after publishing. Roll back the release commit if any check fails.

## Mirrored Files

- index.html
- index.css
- scripts.js
- assets/
- robots.txt
