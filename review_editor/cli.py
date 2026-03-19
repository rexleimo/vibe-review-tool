import argparse
import json
import pathlib
from typing import Any, List, Optional


MAX_LINE_LENGTH = 120


def analyze_markdown(markdown_text: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []

    for index, line in enumerate(markdown_text.splitlines(), start=1):
        if len(line) > MAX_LINE_LENGTH:
            issues.append(
                {
                    "rule": "line-too-long",
                    "line": index,
                    "severity": "warning",
                    "message": f"Line exceeds {MAX_LINE_LENGTH} characters.",
                }
            )

    return issues


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(prog="review-editor")
    parser.add_argument("markdown_file", help="Path to input markdown file")
    return parser


def main(argv: Optional[List[str]] = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    source_path = pathlib.Path(args.markdown_file)
    text = source_path.read_text(encoding="utf-8")

    payload = {
        "file": str(source_path),
        "issues": analyze_markdown(text),
    }
    print(json.dumps(payload, ensure_ascii=False, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
