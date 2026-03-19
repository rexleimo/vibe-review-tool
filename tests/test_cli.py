import json
import os
import subprocess
import sys
import tempfile
import unittest


class ReviewEditorCliTests(unittest.TestCase):
    def run_cli(self, markdown_text: str) -> subprocess.CompletedProcess[str]:
        with tempfile.NamedTemporaryFile("w", suffix=".md", delete=False, encoding="utf-8") as tmp:
            tmp.write(markdown_text)
            path = tmp.name

        try:
            return subprocess.run(
                [sys.executable, "-m", "review_editor.cli", path],
                capture_output=True,
                text=True,
                check=False,
            )
        finally:
            os.unlink(path)

    def test_reports_line_too_long(self) -> None:
        result = self.run_cli("# Title\n" + ("a" * 121) + "\n")

        self.assertEqual(result.returncode, 0, msg=result.stderr)
        payload = json.loads(result.stdout)

        self.assertIn("issues", payload)
        self.assertEqual(len(payload["issues"]), 1)
        self.assertEqual(payload["issues"][0]["rule"], "line-too-long")
        self.assertEqual(payload["issues"][0]["line"], 2)


if __name__ == "__main__":
    unittest.main()
