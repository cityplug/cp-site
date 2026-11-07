"""Release-specific regressions for the isolated static planner."""
import re
import unittest
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


class PlannerReleaseTests(unittest.TestCase):
    def test_quote_and_pdf_dependencies_stay_on_owned_origin(self):
        script = (ROOT / 'wifi-planner/wifi-planner.js').read_text()
        self.assertIn('quoteUrl: "https://www.cityplug.co.uk/#contact"', script)
        self.assertNotIn('cdnjs.cloudflare.com', script)
        self.assertIn('jspdf:     ["vendor/jspdf.umd.min.js"]', script)
        self.assertIn('autotable: ["vendor/jspdf.plugin.autotable.min.js"]', script)
        self.assertIn('jsPDF - PDF Document creation from JavaScript', (ROOT/'wifi-planner/vendor/jspdf.umd.min.js').read_text())
        self.assertIn('Version 4.2.1', (ROOT/'wifi-planner/vendor/jspdf.umd.min.js').read_text())

    def test_planner_is_link_only_and_has_no_third_party_connection_permission(self):
        home = (ROOT/'index.html').read_text()
        self.assertEqual(home.count('href="/wifi-planner/"'), 1)
        self.assertNotIn('wifi-planner.js', home)
        self.assertNotIn('wifi-planner.css', home)
        self.assertRegex(home, r'(?s)<h3>Whole-home Wi-Fi</h3>.*?href="/wifi-planner/".*?</article>')
        html = (ROOT/'wifi-planner/index.html').read_text()
        self.assertIn('http-equiv="Content-Security-Policy"', html)
        self.assertIn("connect-src 'none'", html)
        self.assertIn("script-src 'self'", html)
        self.assertIn('name="referrer" content="no-referrer"', html)
        self.assertEqual((ROOT/'CNAME').read_text().strip(), 'www.cityplug.co.uk')
        files = {str(p.relative_to(ROOT/'wifi-planner')) for p in (ROOT/'wifi-planner').rglob('*') if p.is_file()}
        self.assertEqual(files, {'index.html','wifi-planner.js','wifi-planner.css','vendor/jspdf.umd.min.js','vendor/jspdf.plugin.autotable.min.js','vendor/LICENSE-jspdf.txt','vendor/LICENSE-jspdf-autotable.txt'})


if __name__ == '__main__':
    unittest.main()
