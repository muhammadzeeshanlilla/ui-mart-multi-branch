"""Run the current password-auth and branch browser regressions using existing test tools."""
from pathlib import Path
import shutil
import subprocess

root = Path(__file__).resolve().parents[1]
bundled = root / '.tools' / 'playwright' / 'driver' / 'node.exe'
runtime = str(bundled) if bundled.exists() else shutil.which('node')
if not runtime:
    raise SystemExit('Install the existing Playwright test tools or a Node test runtime first.')
raise SystemExit(subprocess.call([
    runtime, '--test', '--test-concurrency=1',
    'tests/auth-browser.test.cjs', 'tests/consistency.test.cjs'
], cwd=root))
