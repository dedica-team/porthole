#!/usr/bin/env python3
"""Generate GraalVM reflection metadata for Porthole's Jackson-serialized classes.

Porthole deliberately uses Jackson via reflection (jackson-module-kotlin) instead of
Micronaut Serialization, so every application class that crosses a JSON boundary must be
registered for reflection before native-image can see its properties. Native Image prunes
unregistered classes, which silently produced empty JSON objects.

Run this after adding/renaming DTO/domain/persistence classes:

    make native-metadata

It scans server/target/classes and rewrites
server/src/main/resources/META-INF/native-image/team.dedica/porthole/reflect-config.json.
The file is committed so a native build does not depend on this script.
"""

import json
import os
import re
from glob import glob

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
CLASSES = os.path.join(ROOT, "server", "target", "classes")
OUTPUT = os.path.join(
    ROOT,
    "server",
    "src",
    "main",
    "resources",
    "META-INF",
    "native-image",
    "team.dedica",
    "porthole",
    "reflect-config.json",
)

GENERATED_MARKERS = (
    "$Definition",
    "$Introspection",
    "$Exec",
    "$Intercepted",
    "$DefaultImpls",
    "$Companion",
    "$WhenMappings",
    "$lambda",
    "$inlined",
)


def is_application_class(path):
    simple_name = os.path.basename(path)[:-len(".class")]
    if simple_name.startswith("$"):
        return False
    if any(marker in simple_name for marker in GENERATED_MARKERS):
        return False
    if re.search(r"\$\d+$", simple_name):
        return False
    return True


def main():
    class_files = glob(os.path.join(CLASSES, "team", "dedica", "porthole", "**", "*.class"), recursive=True)
    names = []
    for path in class_files:
        if not is_application_class(path):
            continue
        relative = os.path.relpath(path, CLASSES)[:-len(".class")]
        names.append(relative.replace(os.sep, "."))

    config = [
        {
            "name": name,
            "allDeclaredConstructors": True,
            "allDeclaredMethods": True,
            "allDeclaredFields": True,
        }
        for name in sorted(names)
    ]

    os.makedirs(os.path.dirname(OUTPUT), exist_ok=True)
    with open(OUTPUT, "w") as handle:
        json.dump(config, handle, indent=2)
        handle.write("\n")

    print(f"Wrote {len(config)} class entries to {os.path.relpath(OUTPUT, ROOT)}")


if __name__ == "__main__":
    main()
