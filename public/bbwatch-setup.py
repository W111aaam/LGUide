"""Install the LGUide companion and connect it to a one-time pairing code."""

import json
from pathlib import Path
import re
import subprocess
import sys
from urllib.error import HTTPError
from urllib.request import Request, urlopen
import venv

SITE = "https://lguide-pomodoro-api.zhuan0140.workers.dev"
PACKAGE = "https://github.com/W111aaam/bbwatch/archive/d0d8bc418f88fcdf9dca418b9d71b88790d4a240.zip"


def main():
    if sys.version_info < (3, 11):
        raise RuntimeError("请先安装 Python 3.11 或更新版本。")
    if len(sys.argv) != 2 or not re.fullmatch(r"[A-Z2-9]{5}-[A-Z2-9]{5}", sys.argv[1]):
        raise RuntimeError("配对码无效，请从 Blackboard 页面重新复制安装命令。")
    runtime = Path.home() / ".lguide" / "bbwatch" / "venv"
    python = runtime / ("Scripts/python.exe" if sys.platform == "win32" else "bin/python")
    if not python.is_file():
        venv.EnvBuilder(with_pip=True).create(runtime)
    subprocess.run([str(python), "-m", "pip", "install", "--disable-pip-version-check", PACKAGE], check=True)

    # Prompt for school credentials on this device only, if bbwatch needs setup.
    subprocess.run([str(python), "-c", """
from bbwatch.cli import main
from bbwatch.errors import CredentialError
from bbwatch.secrets import load_credentials
try:
    load_credentials()
except CredentialError:
    raise SystemExit(main(["setup"]))
"""], check=True)

    req = Request(
        SITE + "/api/blackboard/pair",
        data=json.dumps({"code": sys.argv[1]}).encode(),
        headers={"Content-Type": "application/json"},
    )
    try:
        with urlopen(req, timeout=20) as response:
            token = json.load(response)["token"]
    except HTTPError as exc:
        if exc.code == 401:
            raise RuntimeError("配对码已失效，请回到网页重新复制命令。") from exc
        raise RuntimeError(f"LGUide 配对服务返回 HTTP {exc.code}。") from exc
    subprocess.run(
        [str(python), "-c", "import sys; from bbwatch.lguide import store_connection; store_connection(sys.stdin.read(), sys.argv[1])", SITE],
        input=token, text=True, check=True,
    )
    print("已连接 LGUide，开始首次 Blackboard 扫描。", flush=True)
    subprocess.run([str(python), "-m", "bbwatch.cli", "scan"], check=True)
    print("请回到 LGUide 查看同步状态。")


if __name__ == "__main__":
    try:
        main()
    except (OSError, RuntimeError, subprocess.CalledProcessError) as exc:
        sys.exit(f"连接未完成：{exc}")
