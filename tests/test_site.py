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


class SiteTests(unittest.TestCase):
    def test_every_public_page_links_to_a_real_privacy_notice(self):
        self.assertTrue((ROOT / "privacy.html").is_file(), "privacy.html is missing")
        privacy = (ROOT / "privacy.html").read_text(encoding="utf-8").lower()
        self.assertIn("formspree", privacy)
        self.assertIn("discord", privacy)
        self.assertIn("confirm before publication", privacy)
        self.assertIn("privacy", privacy)
        for name in PUBLIC_PAGES:
            links = [attrs.get("href") for tag, attrs in parse(name).tags if tag == "a"]
            self.assertIn("/privacy", links, name)
    def test_every_public_page_has_complete_share_metadata(self):
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
        homepage = " ".join(parse("index.html").text).lower()
        self.assertLessEqual(homepage.count("london, kent and the m25 area"), 1)
        self.assertLessEqual(homepage.count("free quote"), 5)

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
