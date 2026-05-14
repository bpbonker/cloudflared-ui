#!/usr/bin/env python3
"""SSH+SFTP helper.

Usage:
    python remote.py run   "<shell command>"
    python remote.py sudo  "<shell command>"   # runs via sudo -S, password piped in
    python remote.py put   <local>  <remote>
    python remote.py get   <remote> <local>
"""
import sys
import io
from pathlib import Path

# journalctl/systemctl emit unicode bullet characters and the like; force
# stdout to UTF-8 so we don't crash on Windows cp1252.
if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    sys.stderr.reconfigure(encoding="utf-8", errors="replace")
else:
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding="utf-8", errors="replace")

import paramiko
from paramiko import SSHClient, AutoAddPolicy

HOST = "10.89.173.101"
USER = "brenden"
PASS = "Qazwsx123!@"


def connect() -> SSHClient:
    c = SSHClient()
    c.set_missing_host_key_policy(AutoAddPolicy())
    c.connect(HOST, username=USER, password=PASS, look_for_keys=False, allow_agent=False, timeout=20, banner_timeout=20)
    return c


def quote(s: str) -> str:
    return "'" + s.replace("'", "'\\''") + "'"


def run(cmd: str, sudo: bool = False) -> int:
    with connect() as c:
        if sudo:
            wrapped = f"sudo -S -p '' bash -lc {quote(cmd)}"
            stdin, stdout, stderr = c.exec_command(wrapped, get_pty=True, timeout=1200)
            stdin.write(PASS + "\n")
            stdin.flush()
        else:
            wrapped = f"bash -lc {quote(cmd)}"
            stdin, stdout, stderr = c.exec_command(wrapped, timeout=1200)
        for line in iter(stdout.readline, ""):
            sys.stdout.write(line)
        err = stderr.read().decode(errors="replace")
        if err:
            sys.stderr.write(err)
        return stdout.channel.recv_exit_status()


def _put_dir(sftp, local: Path, remote: str):
    try:
        sftp.mkdir(remote)
    except IOError:
        pass
    for entry in local.iterdir():
        rp = remote.rstrip("/") + "/" + entry.name
        if entry.is_dir():
            _put_dir(sftp, entry, rp)
        else:
            sftp.put(str(entry), rp)


def put(local: str, remote: str):
    with connect() as c:
        sftp = c.open_sftp()
        p = Path(local)
        if p.is_dir():
            _put_dir(sftp, p, remote)
        else:
            sftp.put(local, remote)
        sftp.close()


def get(remote: str, local: str):
    with connect() as c:
        sftp = c.open_sftp()
        sftp.get(remote, local)
        sftp.close()


def main():
    if len(sys.argv) < 2:
        print(__doc__); sys.exit(2)
    op = sys.argv[1]
    if op in ("run", "sudo"):
        rc = run(" ".join(sys.argv[2:]), sudo=(op == "sudo"))
        sys.exit(rc)
    elif op == "put":
        put(sys.argv[2], sys.argv[3])
    elif op == "get":
        get(sys.argv[2], sys.argv[3])
    else:
        print(__doc__); sys.exit(2)


if __name__ == "__main__":
    main()
