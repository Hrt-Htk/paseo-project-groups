/// <reference types="node" />
import { execFile } from "node:child_process";
import { access, constants } from "node:fs/promises";
import { homedir } from "node:os";
import { delimiter, join } from "node:path";
import type { RpcInput, RpcOutput } from "@getpaseo/plugin";
import type { projectIdsRpc, removeProjectRpc } from "../shared/rpc";

const CLI_TIMEOUT_MS = 60_000;

/** The daemon's PATH may not include the user's shell PATH, so known install paths follow it. */
async function findCli(): Promise<string> {
  const fromPath = (process.env.PATH ?? "")
    .split(delimiter)
    .filter(Boolean)
    .map((directory) => join(directory, "paseo"));
  const candidates = [
    process.env.PASEO_CLI,
    ...fromPath,
    "/Applications/Paseo.app/Contents/Resources/bin/paseo",
    join(homedir(), ".local", "bin", "paseo"),
    "/opt/homebrew/bin/paseo",
    "/usr/local/bin/paseo",
  ].filter((item): item is string => !!item);
  for (const candidate of candidates) {
    try {
      await access(candidate, constants.X_OK);
      return candidate;
    } catch {
      // Try the next location.
    }
  }
  throw new Error("The paseo command was not found on the daemon host.");
}

function run(cli: string, args: string[]): Promise<string> {
  const home = process.env.PASEO_HOME ? ["--home", process.env.PASEO_HOME] : [];
  return new Promise((resolve, reject) => {
    execFile(
      cli,
      [...args, ...home],
      { timeout: CLI_TIMEOUT_MS, maxBuffer: 8 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) reject(new Error((stderr || error.message).trim()));
        else resolve(stdout);
      },
    );
  });
}

export async function projectIds(): Promise<RpcOutput<typeof projectIdsRpc>> {
  const cli = await findCli();
  const [status, listed] = await Promise.all([
    run(cli, ["daemon", "status", "--json"]).then((out) => JSON.parse(out) as { serverId?: unknown }),
    run(cli, ["project", "ls", "--json"]).then((out) => JSON.parse(out) as { projectId?: unknown }[]),
  ]);
  if (typeof status.serverId !== "string" || !Array.isArray(listed)) {
    throw new Error("Unexpected output from the paseo command.");
  }
  return {
    serverId: status.serverId,
    projectIds: listed.flatMap((project) => (typeof project.projectId === "string" ? [project.projectId] : [])),
  };
}

export async function removeProject({
  projectId,
}: RpcInput<typeof removeProjectRpc>): Promise<RpcOutput<typeof removeProjectRpc>> {
  const cli = await findCli();
  // The CLI talks to its default daemon. Confirm that daemon owns this project first, so a
  // project shown from another host is never removed here by mistake.
  const listed = JSON.parse(await run(cli, ["project", "ls", "--json"])) as { projectId?: string }[];
  if (!Array.isArray(listed) || !listed.some((project) => project.projectId === projectId)) {
    throw new Error(
      "This project is not on the daemon running the plugin. Remove it from the default sidebar view.",
    );
  }
  console.log(`[project-groups] removing project ${projectId}`);
  const result = JSON.parse(await run(cli, ["project", "delete", projectId, "--json"])) as {
    removedWorkspaceIds?: string[];
  };
  return { removedWorkspaceIds: result.removedWorkspaceIds ?? [] };
}
