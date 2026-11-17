"""Regression tests for scripts/check-release-content.py (stdlib only, no network)."""
import hashlib
import json
import shutil
import subprocess
import sys
import tempfile
import unittest
from pathlib import Path

SCRIPT = Path(__file__).resolve().with_name("check-release-content.py")


class ReleaseContentCheckTests(unittest.TestCase):
    def setUp(self):
        self.root = Path(tempfile.mkdtemp())
        self.addCleanup(shutil.rmtree, self.root)
        (self.root / "scripts").mkdir()
        shutil.copy(SCRIPT, self.root / "scripts")
        (self.root / "licensing").mkdir()
        glyph = self.root / "static" / "glyphs" / "a.svg"
        glyph.parent.mkdir(parents=True)
        glyph.write_text("<svg/>")
        (self.root / "static" / "symbols").mkdir()
        (self.root / "static" / "symbols" / "ok.json").write_text("[]")
        self.inventory = {"entries": [{"glob": "static/symbols/bad*.json", "status": "unresolved", "item": "Bad"}]}
        self.register = {"asset_directories": ["static/glyphs"], "assets": [
            {"path": "static/glyphs/a.svg", "sha256": hashlib.sha256(b"<svg/>").hexdigest(), "approval": "approved"}]}
        self.write()

    def write(self):
        (self.root / "licensing" / "resource-inventory.json").write_text(json.dumps(self.inventory))
        (self.root / "licensing" / "approved-assets.json").write_text(json.dumps(self.register))

    def run_check(self, *args):
        return subprocess.run([sys.executable, str(self.root / "scripts" / "check-release-content.py"),
                               *args, str(self.root / "static")], capture_output=True, text=True)

    def test_clean_tree_passes(self):
        self.assertEqual(self.run_check().returncode, 0)

    def test_unapproved_new_export_blocks(self):
        (self.root / "static" / "glyphs" / "new.svg").write_text("<svg id='new'/>")
        result = self.run_check()
        self.assertEqual(result.returncode, 1)
        self.assertIn("not-approved", result.stdout)

    def test_modified_export_blocks(self):
        (self.root / "static" / "glyphs" / "a.svg").write_text("<svg changed/>")
        self.assertIn("changed", self.run_check().stdout)

    def test_unresolved_resource_blocks_but_audit_mode_does_not(self):
        (self.root / "static" / "symbols" / "bad.json").write_text("[]")
        self.assertEqual(self.run_check().returncode, 1)
        report = self.root / "report.json"
        audit = self.run_check("--audit", "--report", str(report))
        self.assertEqual(audit.returncode, 0)
        record = json.loads(report.read_text())
        self.assertTrue(record["blocking"])
        self.assertEqual(record["mode"], "audit")
        self.assertEqual(record["findings"][0]["status"], "unresolved")


if __name__ == "__main__":
    unittest.main()
