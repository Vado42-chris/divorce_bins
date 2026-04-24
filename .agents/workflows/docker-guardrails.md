---
description: Safe Docker Build Protocol (Guardrails)
---

Always follow these rules when interacting with Docker inside this workspace to prevent flooding the agent websocket and freezing the UI or locking the daemon:

1. **Progress Bar Floods**: Always run `docker build` or `docker compose build` with `--progress=plain` to prevent ANSI escape sequence storms. E.g., `docker compose build --progress=plain`.
2. **Log Tailing**: When reading container logs (`docker compose logs`), always limit the output using `--tail=100`. NEVER use `-f` (follow) inside the agent terminal.
3. **Huge Outputs**: If executing a command expected to generate enormous output, pipe it to a file (e.g., `> /tmp/docker_output.tmp`) and read the file natively instead of blowing up the terminal.
4. **Daemon Lifecycle**: Never run `pkill docker` indiscriminately. Target specific container IDs.
