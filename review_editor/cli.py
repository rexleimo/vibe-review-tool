import argparse
import json
import pathlib
import re
from typing import Any, List, Optional


MAX_LINE_LENGTH = 120
HEADING_PATTERN = re.compile(r"^(#{1,6})\s+\S")


def analyze_markdown(markdown_text: str) -> list[dict[str, Any]]:
    issues: list[dict[str, Any]] = []
    previous_heading_level: Optional[int] = None

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

        if line.endswith(" ") or line.endswith("\t"):
            issues.append(
                {
                    "rule": "trailing-whitespace",
                    "line": index,
                    "severity": "warning",
                    "message": "Line has trailing whitespace.",
                }
            )

        heading_match = HEADING_PATTERN.match(line)
        if heading_match is None:
            continue

        heading_level = len(heading_match.group(1))
        if previous_heading_level is not None and heading_level > previous_heading_level + 1:
            issues.append(
                {
                    "rule": "heading-structure",
                    "line": index,
                    "severity": "warning",
                    "message": (
                        f"Heading level jumps from H{previous_heading_level} to H{heading_level}."
                    ),
                }
            )

        previous_heading_level = heading_level

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
