import json
import re
import unittest
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parents[1]
PUBLIC_PAGES = [
    "index.html",
    "cctv-installation-london.html",
    "wifi-installation-south-london.html",
    "business-wifi-network-cabling-london.html",
]
ALL_PUBLIC_PAGES = PUBLIC_PAGES + ["privacy.html", "404.html"]


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.tags = []
        self.text = []
        self.scripts = []
        self._script_type = None
        self._script_parts = []

    def handle_starttag(self, tag, attrs):
        attributes = dict(attrs)
        self.tags.append((tag, attributes))
        if tag == "script":
            self._script_type = attributes.get("type")
            self._script_parts = []

    def handle_endtag(self, tag):
        if tag == "script":
            if self._script_type:
                self.scripts.append((self._script_type, "".join(self._script_parts)))
            self._script_type = None
            self._script_parts = []

    def handle_data(self, data):
        if self._script_type:
            self._script_parts.append(data)
        elif data.strip():
            self.text.append(" ".join(data.split()))


def parse(name):
    document = Document()
    document.feed((ROOT / name).read_text(encoding="utf-8"))
    return document


def powershell_executable_lines(source):
    """Drop blank and comment-only lines so safety markers cannot live only in comments."""
    return "\n".join(
        line for line in source.splitlines() if line.strip() and not line.lstrip().startswith("#")
    )


class SiteTests(unittest.TestCase):
    def test_every_logo_returns_to_the_homepage(self):
        for name in ALL_PUBLIC_PAGES:
            anchors = [attrs for tag, attrs in parse(name).tags if tag == "a"]
            for logo_class in ("brand", "footer-brand"):
                logos = [
                    attrs
                    for attrs in anchors
                    if logo_class in attrs.get("class", "").split()
                ]
                self.assertEqual(len(logos), 1, f"{name}: expected one {logo_class} link")
                self.assertEqual(logos[0].get("href"), "/", f"{name}: {logo_class} must link home")
                self.assertEqual(logos[0].get("aria-label"), "CityPlug home", f"{name}: inaccessible {logo_class}")

    def test_every_public_page_links_to_a_real_privacy_notice(self):
        self.assertTrue((ROOT / "privacy.html").is_file(), "privacy.html is missing")
        privacy = (ROOT / "privacy.html").read_text(encoding="utf-8")
        privacy_lower = privacy.lower()
        self.assertIn("formspree", privacy_lower)
        self.assertIn("private cityplug discord channel", privacy_lower)
        self.assertIn('href="https://discord.com/privacy"', privacy_lower)
        self.assertIn("info@cityplug.co.uk", privacy_lower)
        self.assertIn("privacy and your personal information", privacy_lower)
        self.assertIn("delivers the enquiry to cityplug", privacy_lower)
        self.assertIn("six months after the last contact", privacy_lower)
        self.assertIn("advertising or tracking cookies", privacy_lower)
        self.assertIn("unless you ask cityplug to do so", privacy_lower)
        for disclosed_form_field in (
            "name",
            "email address",
            "optional phone number",
            "service you need",
            "postcode area",
            "preferred availability",
            "details about the property or work required",
        ):
            self.assertIn(disclosed_form_field, privacy_lower)
        for editorial_marker in (
            "confirm before publication",
            "must confirm whether",
            "optional private discord",
            "private business inbox",
            "authorised members",
            "access to that inbox",
            "access limited",
        ):
            self.assertNotIn(editorial_marker, privacy_lower)
        self.assertIn("privacy", privacy_lower)
        for name in PUBLIC_PAGES:
            links = [attrs.get("href") for tag, attrs in parse(name).tags if tag == "a"]
            self.assertIn("/privacy", links, name)
    def test_every_public_page_has_complete_share_metadata(self):
        expected_image = "https://www.cityplug.co.uk/assets/city_hero-social-v2.jpg"
        expected_alt = "CityPlug logo over a blurred London cityscape"
        for name in PUBLIC_PAGES:
            document = parse(name)
            meta = {
                attrs.get("property") or attrs.get("name"): attrs.get("content", "")
                for tag, attrs in document.tags
                if tag == "meta" and (attrs.get("property") or attrs.get("name"))
            }
            self.assertLessEqual(len(meta.get("description", "")), 160, name)
            for key in ("og:title", "og:description", "og:url", "og:image", "twitter:card"):
                self.assertTrue(meta.get(key), f"{name}: missing {key}")
            self.assertEqual(meta.get("og:image"), expected_image, name)
            self.assertEqual(meta.get("twitter:image"), expected_image, name)
            self.assertEqual(meta.get("og:image:width"), "1200", name)
            self.assertEqual(meta.get("og:image:height"), "630", name)
            self.assertEqual(meta.get("og:image:type"), "image/jpeg", name)
            self.assertEqual(meta.get("og:image:alt"), expected_alt, name)
            self.assertEqual(meta.get("twitter:image:alt"), expected_alt, name)
        self.assertTrue((ROOT / "assets" / "city_hero-social-v2.jpg").is_file())

    def test_service_pages_publish_valid_service_schema(self):
        for name in PUBLIC_PAGES[1:]:
            scripts = [body for script_type, body in parse(name).scripts if script_type == "application/ld+json"]
            self.assertTrue(scripts, f"{name}: missing JSON-LD")
            schemas = [json.loads(body) for body in scripts]
            self.assertTrue(any(schema.get("@type") == "Service" for schema in schemas), name)
    def test_pages_expose_keyboard_and_assistive_navigation(self):
        for name in PUBLIC_PAGES:
            document = parse(name)
            links = [attrs for tag, attrs in document.tags if tag == "a"]
            self.assertTrue(any(attrs.get("class") == "skip-link" and attrs.get("href") == "#main-content" for attrs in links), name)
            mains = [attrs for tag, attrs in document.tags if tag == "main"]
            self.assertEqual(mains[0].get("id"), "main-content", name)
            toggles = [attrs for tag, attrs in document.tags if tag == "button" and "nav-toggle" in attrs.get("class", "")]
            self.assertEqual(toggles[0].get("aria-controls"), "site-navigation", name)
            navs = [attrs for tag, attrs in document.tags if tag == "nav" and "site-nav" in attrs.get("class", "")]
            self.assertEqual(navs[0].get("id"), "site-navigation", name)

    def test_quote_form_helpers_are_accessible(self):
        document = parse("index.html")
        tags = document.tags
        hero_proof = [attrs for tag, attrs in tags if tag == "div" and "hero-proof" in attrs.get("class", "")][0]
        self.assertEqual(hero_proof.get("role"), "group")
        honeypot = [attrs for tag, attrs in tags if tag == "input" and attrs.get("name") == "_gotcha"][0]
        self.assertEqual(honeypot.get("aria-hidden"), "true")
        textarea = [attrs for tag, attrs in tags if tag == "textarea" and attrs.get("id") == "message"][0]
        self.assertEqual(textarea.get("aria-describedby"), "message-help")
        self.assertTrue(any(attrs.get("id") == "message-help" for _, attrs in tags))

    def test_mobile_navigation_script_handles_name_and_escape(self):
        script = (ROOT / "scripts.js").read_text(encoding="utf-8")
        self.assertIn('setAttribute("aria-label"', script)
        self.assertIn('event.key === "Escape"', script)
    def test_copy_avoids_template_and_keyword_stuffing_language(self):
        banned = (
            "CCTV installation London,",
            "Hikvision-style",
            "overcomplicated enterprise nonsense",
            "without dragging it out",
            "without a messy setup",
        )
        for name in PUBLIC_PAGES:
            visible = " ".join(parse(name).text)
            for phrase in banned:
                self.assertNotIn(phrase, visible, f"{name}: {phrase}")

    def test_business_copy_does_not_impose_an_unnecessary_size_ceiling(self):
        limiting_phrases = (
            "small business",
            "small-business",
            "small commercial site",
            "small site",
            "small office",
            "small hospitality",
            "small warehouse",
        )
        for name in (
            "index.html",
            "cctv-installation-london.html",
            "business-wifi-network-cabling-london.html",
            "scripts.js",
        ):
            source = (ROOT / name).read_text(encoding="utf-8").lower()
            for phrase in limiting_phrases:
                self.assertNotIn(phrase, source, f"{name}: {phrase}")

    def test_homepage_supporting_copy_is_not_repeated(self):
        visible = " ".join(parse("index.html").text).lower()
        source = (ROOT / "index.html").read_text(encoding="utf-8").lower()
        self.assertLessEqual(source.count("2017"), 1)
        maximum_counts = {
            "since 2017": 1,
            "south london": 3,
            "after the first reply": 1,
            "cable routes": 2,
            "planned around": 1,
            "start with the problem": 1,
            "wired cctv, whole-home wi-fi and network cabling for homes and businesses": 1,
            "the first part of the postcode": 1,
            "wired backhaul": 1,
            "guest wi-fi": 1,
            "office device cabling": 1,
        }
        for phrase, maximum in maximum_counts.items():
            self.assertLessEqual(
                visible.count(phrase),
                maximum,
                f"Homepage repeats {phrase!r} more than {maximum} time(s)",
            )
        homepage = " ".join(parse("index.html").text).lower()
        self.assertLessEqual(homepage.count("london, kent and the m25 area"), 1)
        self.assertLessEqual(homepage.count("free quote"), 5)

    def test_service_pages_do_not_repeat_location_summaries(self):
        for name in PUBLIC_PAGES[1:]:
            document = parse(name)
            visible = " ".join(document.text).lower()
            self.assertLessEqual(
                visible.count("london, kent"),
                1,
                f"{name}: repeats the same service-area claim",
            )
            self.assertFalse(
                any("service-areas" in attrs.get("class", "") for _, attrs in document.tags),
                f"{name}: repeats service areas as decorative chips",
            )

        business = " ".join(parse("business-wifi-network-cabling-london.html").text).lower()
        self.assertLessEqual(business.count("planned around"), 1)
        self.assertNotIn("weekend or quieter-hour slots may be available", business)

        cctv = " ".join(parse("cctv-installation-london.html").text).lower()
        self.assertLessEqual(cctv.count("cable routes"), 2)

    def test_service_pages_answer_service_specific_decisions(self):
        expected = {
            "cctv-installation-london.html": ("recording retention", "night-time", "handover"),
            "wifi-installation-south-london.html": ("wired backhaul", "mesh", "speed"),
            "business-wifi-network-cabling-london.html": ("cable labelling", "guest", "trading hours"),
        }
        for name, phrases in expected.items():
            visible = " ".join(parse(name).text).lower()
            self.assertGreaterEqual(len(re.findall(r"\b[\w’-]+\b", visible)), 400, name)
            for phrase in phrases:
                self.assertIn(phrase, visible, f"{name}: missing {phrase}")
    def test_windows_support_bootstrapper_is_published_at_extensionless_route(self):
        bootstrapper = ROOT / "win"
        self.assertTrue(bootstrapper.is_file(), "The /win PowerShell bootstrapper is missing")
        source = bootstrapper.read_text(encoding="utf-8")
        self.assertTrue(source.startswith("# CityPlug attended-support bootstrapper"))

    def test_windows_support_bootstrapper_is_pinned_and_attended_only(self):
        source = (ROOT / "win").read_text(encoding="utf-8")
        executable = powershell_executable_lines(source)
        required = (
            "tailscale-setup-1.102.3-amd64.msi",
            "03ac8183c6e3ce276e9b44281ebe7e4c02aef28a971034ca170c4b665df42dce",
            "rustdesk-1.4.9-x86_64.msi",
            "c87d2f4cef2a5acd6003b6507dcfbf5d5168a256db082cd90b54d35193224aaa",
            "apollo-rustdesk.tail792bf.ts.net",
            "oL3LxCZ6WvfwZt8Lajbp9bVS90zZn7rGNRyZBwQhqys=",
            '"approve-mode" "click"',
            '"allow-only-conn-window-open" "Y"',
            '"allow-remote-config-modification" "N"',
            '"enable-lan-discovery" "N"',
            '"enable-terminal" "N"',
            '"enable-tunnel" "N"',
            '"enable-remote-restart" "N"',
            '"allow-auto-update" "N"',
            "--shields-up=true",
            "--auto-update=false",
            "Get-AuthenticodeSignature",
            "Get-FileHash",
            "Test-NetConnection",
            "CN=PURSLANE(?:,|$)",
            "CN=Tailscale Inc\\.(?:,|$)",
            '"4230334F8A7DD84E50D0273EF379E8B4A82F5DA5"',
            '"108F172FDE945B21A5C0696731D6220D67D1C39E"',
            '"1.4.9+67"',
            '"1.102.3-t9329c3677-ga522f65e9"',
        )
        for marker in required:
            self.assertIn(marker, executable, f"Missing executable installer safety marker: {marker}")
        self.assertNotRegex(executable, r"(?i)\b(tskey-auth|authkey|--auth-key)\b")
        self.assertNotIn("releases/latest", executable)
        self.assertNotIn("setup-latest", executable)
        self.assertNotIn("Invoke-Expression", executable)

    def test_windows_support_bootstrapper_verifies_and_fails_closed(self):
        source = powershell_executable_lines((ROOT / "win").read_text(encoding="utf-8"))
        required = (
            "function Clear-RustDeskPermanentPassword",
            'Arguments = \'--password ""\'',
            'output.Trim() -cne "Done!"',
            'Assert-RustDeskOption "custom-rendezvous-server" $RustDeskServer',
            'Assert-RustDeskOption "key" $RustDeskKey',
            'Assert-RustDeskOption "relay-server" $RustDeskServer',
            "function Invoke-RustDeskFailClosed",
            'Set-Service -Name "RustDesk" -StartupType Disabled',
            'Stop-Service -Name "RustDesk" -Force',
            "function Invoke-TailscaleFailClosed",
            '& $TailscaleExe down',
            'if (-not $prefs.ShieldsUp -or $prefs.AutoUpdate.Apply)',
            "function Initialize-SecureWorkDirectory",
            "FileAttributes]::ReparsePoint",
            'SetSecurityDescriptorSddlForm("O:BAG:BAD:PAI',
            "function Enable-RustDeskQuarantine",
            "function Assert-RustDeskQuarantineEffective",
            "function Disable-RustDeskQuarantine",
            'New-NetFirewallRule',
            'Get-Service -Name "MpsSvc"',
            'Get-NetFirewallProfile -PolicyStore ActiveStore',
            'AllowLocalFirewallRules',
            'Get-NetFirewallRule -PolicyStore ActiveStore',
            'Set-Service -Name "RustDesk" -StartupType Disabled',
            'Assert-InstalledVersion -Path $TailscaleExe -ExpectedProductVersion $TailscaleProductVersion',
            'Assert-InstalledVersion -Path $script:RustDeskExe -ExpectedProductVersion $RustDeskProductVersion',
            'Get-ItemProperty -LiteralPath "HKLM:\\SOFTWARE\\Microsoft\\Windows NT\\CurrentVersion"',
            '$os.InstallationType -ne "Client"',
        )
        for marker in required:
            self.assertIn(marker, source, f"Missing fail-closed implementation marker: {marker}")

        self.assertRegex(source, r"catch\s*\{[\s\S]*Invoke-RustDeskFailClosed[\s\S]*throw[\s\S]*\}\s*finally\s*\{")
        quarantine = source.index("\n    Enable-RustDeskQuarantine\n", source.index("$RustDeskMsi ="))
        rustdesk_install = source.index('Install-Msi -MsiPath $RustDeskMsi -Name "RustDesk"')
        effective_quarantine = source.index("\n    Assert-RustDeskQuarantineEffective\n", quarantine)
        disable_service = source.index('Set-Service -Name "RustDesk" -StartupType Disabled', rustdesk_install)
        start_service = source.index('Start-Service -Name "RustDesk"', disable_service)
        release_quarantine = source.index("Disable-RustDeskQuarantine", start_service)
        self.assertLess(quarantine, rustdesk_install)
        self.assertLess(effective_quarantine, rustdesk_install)
        self.assertLess(rustdesk_install, disable_service)
        self.assertLess(disable_service, start_service)
        self.assertLess(start_service, release_quarantine)

    def test_windows_support_bootstrapper_remains_compatible_with_windows_powershell(self):
        source = powershell_executable_lines((ROOT / "win").read_text(encoding="utf-8"))
        self.assertIn('$env:OS -ne "Windows_NT"', source)
        self.assertNotIn("$IsWindows", source)
        self.assertIn('Read-Host "Type INSTALL to continue"', source)
        self.assertIn('throw "Open Windows PowerShell as Administrator, then rerun the command."', source)
        self.assertNotIn('Start-Process -FilePath "powershell.exe" -Verb RunAs', source)

    def test_custom_404_and_sitemap_cover_public_routes(self):
        error_page = ROOT / "404.html"
        self.assertTrue(error_page.is_file(), "404.html is missing")
        error_text = error_page.read_text(encoding="utf-8").lower()
        self.assertIn("page not found", error_text)
        self.assertIn('name="robots" content="noindex', error_text)
        sitemap = (ROOT / "sitemap.xml").read_text(encoding="utf-8")
        self.assertIn("https://www.cityplug.co.uk/privacy", sitemap)
        self.assertIn("<lastmod>2026-08-27</lastmod>", sitemap)

        document = parse("404.html")
        local_assets = []
        for tag, attrs in document.tags:
            value = (
                attrs.get("href")
                if tag == "link"
                else attrs.get("src") if tag in ("img", "script") else None
            )
            if value and not value.startswith(("http://", "https://")):
                local_assets.append(value)
        self.assertTrue(local_assets)
        self.assertTrue(all(value.startswith("/") for value in local_assets), local_assets)

    def test_internal_page_links_resolve_in_the_repository(self):
        for name in PUBLIC_PAGES + ["privacy.html", "404.html"]:
            for tag, attrs in parse(name).tags:
                href = attrs.get("href") if tag == "a" else None
                if not href or href.startswith(("#", "mailto:", "http://", "https://")):
                    continue
                path = urlparse(href).path
                candidate = ROOT / ("index.html" if path == "/" else path.lstrip("/") + ".html")
                self.assertTrue(candidate.is_file(), f"{name}: broken internal link {href}")
    def test_quote_form_is_low_friction_and_service_links_preselect_it(self):
        homepage = parse("index.html")
        phone = [attrs for tag, attrs in homepage.tags if tag == "input" and attrs.get("id") == "phone"][0]
        self.assertNotIn("required", phone)
        form_links = [attrs.get("href") for tag, attrs in homepage.tags if tag == "a"]
        self.assertIn("/privacy", form_links)
        expected = {
            "cctv-installation-london.html": "/?service=cctv#contact",
            "wifi-installation-south-london.html": "/?service=wifi#contact",
            "business-wifi-network-cabling-london.html": "/?service=business#contact",
        }
        for name, target in expected.items():
            links = [attrs.get("href") for tag, attrs in parse(name).tags if tag == "a"]
            self.assertIn(target, links, name)
        script = (ROOT / "scripts.js").read_text(encoding="utf-8")
        self.assertIn("URLSearchParams", script)
        self.assertIn('searchParams.get("service")', script)
    def test_html_does_not_contain_tool_line_number_prefixes(self):
        for name in PUBLIC_PAGES + ["privacy.html", "404.html"]:
            source = (ROOT / name).read_text(encoding="utf-8")
            self.assertIsNone(
                re.search(r"(?m)^\s*\d+\|", source),
                f"{name}: generated line-number prefix leaked into HTML",
            )

    def test_homepage_visual_polish_is_scoped_and_high_contrast(self):
        home_body = next(attrs for tag, attrs in parse("index.html").tags if tag == "body")
        self.assertIn("home-page", home_body.get("class", "").split())

        for name in PUBLIC_PAGES[1:] + ["privacy.html", "404.html"]:
            body = next(attrs for tag, attrs in parse(name).tags if tag == "body")
            self.assertNotIn("home-page", body.get("class", "").split(), name)

        css = (ROOT / "index.css").read_text(encoding="utf-8")
        match = re.search(
            r"\.home-page\s+\.eyebrow\.dark\s*\{[^}]*color:\s*(#[0-9a-fA-F]{6})",
            css,
            re.DOTALL,
        )
        if match is None:
            self.fail("Homepage dark eyebrow needs an explicit colour")

        def luminance(hex_colour):
            channels = [int(hex_colour[index:index + 2], 16) / 255 for index in (1, 3, 5)]
            linear = [
                value / 12.92 if value <= 0.04045 else ((value + 0.055) / 1.055) ** 2.4
                for value in channels
            ]
            return 0.2126 * linear[0] + 0.7152 * linear[1] + 0.0722 * linear[2]

        foreground = luminance(match.group(1))
        background = luminance("#f4f7fa")
        contrast = (max(foreground, background) + 0.05) / (min(foreground, background) + 0.05)
        self.assertGreaterEqual(contrast, 4.5)

    def test_service_pages_share_the_approved_system_and_remain_distinct(self):
        variants = {
            "cctv-installation-london.html": "service-cctv",
            "wifi-installation-south-london.html": "service-wifi",
            "business-wifi-network-cabling-london.html": "service-business",
        }
        required_routes = {
            "/cctv-installation-london",
            "/wifi-installation-south-london",
            "/business-wifi-network-cabling-london",
        }

        for name, variant in variants.items():
            document = parse(name)
            body = next(attrs for tag, attrs in document.tags if tag == "body")
            classes = body.get("class", "").split()
            self.assertIn("service-page", classes, name)
            self.assertIn(variant, classes, name)

            source = (ROOT / name).read_text(encoding="utf-8")
            self.assertIn('data-service-visual', source, f"{name}: missing service-specific visual")
            self.assertIn('class="footer-main"', source, f"{name}: compact footer remains")
            self.assertEqual(source.count('href="/privacy"'), 1, f"{name}: duplicate privacy footer link")

            footer_navs = [
                attrs for tag, attrs in document.tags
                if tag == "nav" and attrs.get("aria-label") == "Footer services"
            ]
            self.assertEqual(len(footer_navs), 1, f"{name}: missing full service footer navigation")
            footer_links = {
                attrs.get("href") for tag, attrs in document.tags
                if tag == "a" and attrs.get("href") in required_routes
            }
            self.assertEqual(footer_links, required_routes, f"{name}: incomplete service footer links")

        for name in ["privacy.html", "404.html"]:
            body = next(attrs for tag, attrs in parse(name).tags if tag == "body")
            self.assertNotIn("service-page", body.get("class", "").split(), name)

        css = (ROOT / "index.css").read_text(encoding="utf-8")
        for selector in (
            ".service-page .service-hero",
            ".service-page .service-panel",
            ".service-page .cta-strip",
            ".service-page .footer-main",
            ".service-cctv .service-visual",
            ".service-wifi .service-visual",
            ".service-business .service-visual",
        ):
            self.assertIn(selector, css, f"missing shared or differentiated style: {selector}")

        helper_variants = {
            "cctv-view-grid": "service-cctv",
            "visual-flow": "service-cctv",
            "wifi-plan": "service-wifi",
            "wifi-node": "service-wifi",
            "node-router": "service-wifi",
            "node-upstairs": "service-wifi",
            "node-garden": "service-wifi",
            "wifi-link": "service-wifi",
            "link-one": "service-wifi",
            "link-two": "service-wifi",
            "network-groups": "service-business",
            "device-row": "service-business",
            "port-bank": "service-business",
        }

        def assert_helpers_are_variant_scoped(css_text):
            individual_selectors = [
                selector.strip()
                for block in re.findall(r"([^{}]+)\{", css_text)
                for selector in block.split(",")
            ]
            for helper, variant in helper_variants.items():
                helper_pattern = re.compile(rf"\.{re.escape(helper)}(?![\w-])")
                matching = [selector for selector in individual_selectors if helper_pattern.search(selector)]
                self.assertTrue(matching, f"missing illustration helper: {helper}")
                for selector in matching:
                    self.assertIn(f".{variant}", selector, f"unscoped {helper} selector: {selector}")

        assert_helpers_are_variant_scoped(css)
        with self.assertRaises(AssertionError):
            assert_helpers_are_variant_scoped(css + "\n.service-wifi .wifi-node, .wifi-node { color: red; }")

    def test_delivery_assets_are_optimized_and_prioritized(self):
        optimized_images = [
            "assets/city_hero-768.avif",
            "assets/city_hero-1536.avif",
            "assets/city_hero-768.webp",
            "assets/city_hero-1536.webp",
            "assets/satalite_rooftop-768.avif",
            "assets/satalite_rooftop-768.webp",
            "assets/city_hero-social-v2.jpg",
        ]
        for asset in optimized_images:
            path = ROOT / asset
            self.assertTrue(path.is_file(), f"missing optimized image: {asset}")
            self.assertLess(path.stat().st_size, 500_000, f"oversized optimized image: {asset}")

        css = (ROOT / "index.css").read_text(encoding="utf-8")
        self.assertIn("image-set(", css)
        self.assertIn("city_hero-1536.avif", css)
        self.assertIn("satalite_rooftop-768.avif", css)
        self.assertIn('format("woff2")', css)
        self.assertIn("font-display: swap", css)
        self.assertNotIn('format("truetype")', css)

        for name in PUBLIC_PAGES + ["privacy.html", "404.html"]:
            source = (ROOT / name).read_text(encoding="utf-8")
            if name in PUBLIC_PAGES:
                self.assertIn("assets/city_hero-social-v2.jpg", source, f"{name}: optimized social image missing")
            links = [attrs for tag, attrs in parse(name).tags if tag == "link"]
            hero_preloads = [
                attrs for attrs in links
                if "preload" in attrs.get("rel", "").split()
                and attrs.get("as") == "image"
                and attrs.get("fetchpriority") == "high"
                and "city_hero" in attrs.get("href", "")
            ]
            self.assertTrue(hero_preloads, f"{name}: optimized hero is not prioritized")

    def test_hd_assets_and_density_aware_delivery_are_present(self):
        hd_assets = (
            "assets/city_hero-3840.avif",
            "assets/city_hero-3840.webp",
            "assets/satalite_rooftop-1536.avif",
            "assets/satalite_rooftop-1536.webp",
            "assets/satalite_rooftop-3072.avif",
            "assets/satalite_rooftop-3072.webp",
            "assets/fav-white-300.png",
            "assets/ap-icon-288.png",
            "assets/cabling-icon-288.png",
            "assets/camera-icon-288.png",
        )
        for asset in hd_assets:
            path = ROOT / asset
            self.assertTrue(path.is_file(), f"missing HD asset: {asset}")
            self.assertLess(path.stat().st_size, 2_000_000, f"oversized HD asset: {asset}")

        css = (ROOT / "index.css").read_text(encoding="utf-8")
        self.assertIn("city_hero-3840.avif", css)
        self.assertIn("satalite_rooftop-3072.avif", css)
        self.assertIn("min-width: 1800px", css)
        self.assertIn("min-resolution: 2.5dppx", css)
        self.assertIn("2x", css)

        expected_preloads = {
            ("/assets/city_hero-768.avif", "(max-width: 620px) and (resolution < 2.5dppx)"),
            ("/assets/city_hero-1536.avif", "(max-width: 620px) and (min-resolution: 2.5dppx)"),
            ("/assets/city_hero-1536.avif", "(620px < width < 1800px) and (max-resolution: 1dppx)"),
            ("/assets/city_hero-3840.avif", "(620px < width < 1800px) and (resolution > 1dppx)"),
            ("/assets/city_hero-3840.avif", "(min-width: 1800px)"),
        }
        for name in PUBLIC_PAGES + ["privacy.html", "404.html"]:
            source = (ROOT / name).read_text(encoding="utf-8")
            self.assertNotIn("imagesrcset", source, name)
            links = [attrs for tag, attrs in parse(name).tags if tag == "link"]
            actual_preloads = {
                (attrs.get("href"), attrs.get("media"))
                for attrs in links
                if "preload" in attrs.get("rel", "").split()
                and attrs.get("as") == "image"
                and "city_hero" in attrs.get("href", "")
            }
            self.assertEqual(actual_preloads, expected_preloads, name)
            self.assertIn("fav-white-300.png 300w", source, name)

        homepage = (ROOT / "index.html").read_text(encoding="utf-8")
        for asset in ("ap-icon-288.png", "cabling-icon-288.png", "camera-icon-288.png"):
            self.assertIn(f"{asset} 288w", homepage)

    def test_below_fold_decorative_backgrounds_are_lazy_loaded(self):
        homepage = (ROOT / "index.html").read_text(encoding="utf-8")
        script = (ROOT / "scripts.js").read_text(encoding="utf-8")
        self.assertGreaterEqual(homepage.count("data-lazy-background"), 2)
        self.assertIn("IntersectionObserver", script)
        self.assertIn("background-ready", script)

    def test_landmarks_have_unique_accessible_names(self):
        for name in PUBLIC_PAGES:
            document = parse(name)
            navs = [attrs for tag, attrs in document.tags if tag == "nav"]
            primary = [attrs for attrs in navs if "site-nav" in attrs.get("class", "")][0]
            self.assertEqual(primary.get("aria-label"), "Primary navigation", name)
            asides = [attrs for tag, attrs in document.tags if tag == "aside"]
            labels = [attrs.get("aria-label") for attrs in asides]
            self.assertTrue(all(labels), f"{name}: unnamed aside landmark")
            self.assertEqual(len(labels), len(set(labels)), f"{name}: duplicate aside landmark label")


if __name__ == "__main__":
    unittest.main()
