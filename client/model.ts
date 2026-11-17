import type { WorkspaceIndicator } from "@getpaseo/plugin";
import type { ProjectGroup } from "../shared/settings";

/** Paseo's order for a folded project's status: the first one present wins. */
const URGENCY: readonly WorkspaceIndicator[] = ["needs_input", "failed", "running", "attention", "done"];

/** The most urgent of the given workspace statuses. Unknown values are ignored. */
export function mostUrgent(statuses: Iterable<string>): WorkspaceIndicator {
  let best = URGENCY.length - 1;
  for (const status of statuses) {
    const rank = URGENCY.indexOf(status as WorkspaceIndicator);
    if (rank !== -1 && rank < best) best = rank;
  }
  return URGENCY[best];
}

/** What the user is dragging. */
export type DragSubject =
  { kind: "project"; key: string; label: string } | { kind: "group"; id: string; label: string };

/** Where a drop lands. Project targets and group targets never mix. */
export type DropTarget =
  | { kind: "project-before"; groupId: string; projectKey: string }
  | { kind: "project-after"; groupId: string; projectKey: string }
  | { kind: "into-group"; groupId: string }
  | { kind: "ungroup" }
  | { kind: "group-at"; index: number };

export function groupOfProject(groups: readonly ProjectGroup[], key: string): string | null {
  for (const group of groups) if (group.projects.includes(key)) return group.id;
  return null;
}

function sameGroups(a: readonly ProjectGroup[], b: readonly ProjectGroup[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((group, index) => {
    const other = b[index];
    return (
      other !== undefined &&
      group.id === other.id &&
      group.name === other.name &&
      group.projects.length === other.projects.length &&
      group.projects.every((key, position) => other.projects[position] === key)
    );
  });
}

/** Returns the new group list, or null when the drop changes nothing. */
export function moveProject(
  groups: readonly ProjectGroup[],
  key: string,
  target: DropTarget,
): ProjectGroup[] | null {
  if (target.kind === "group-at") return null;
  const without = groups.map((group) =>
    group.projects.includes(key)
      ? { ...group, projects: group.projects.filter((item) => item !== key) }
      : group,
  );
  let next: ProjectGroup[];
  if (target.kind === "ungroup") {
    next = without;
  } else {
    const destination = without.find((group) => group.id === target.groupId);
    if (!destination) return null;
    const projects = [...destination.projects];
    if (target.kind === "into-group") {
      projects.push(key);
    } else {
      if (target.projectKey === key) return null;
      const anchor = projects.indexOf(target.projectKey);
      const index = anchor < 0 ? projects.length : target.kind === "project-before" ? anchor : anchor + 1;
      projects.splice(index, 0, key);
    }
    next = without.map((group) => (group.id === destination.id ? { ...group, projects } : group));
  }
  return sameGroups(groups, next) ? null : next;
}

/** Moves a group so it sits before `index` in the current order. Null when nothing moves. */
export function moveGroup(groups: readonly ProjectGroup[], id: string, index: number): ProjectGroup[] | null {
  const from = groups.findIndex((group) => group.id === id);
  if (from < 0 || index === from || index === from + 1) return null;
  const next = [...groups];
  const [moved] = next.splice(from, 1);
  if (!moved) return null;
  next.splice(index > from ? index - 1 : index, 0, moved);
  return next;
}

export function addGroup(
  groups: readonly ProjectGroup[],
  name: string,
): {
  groups: ProjectGroup[];
  id: string;
} {
  const id = `g${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
  // New groups go first, next to the New group button at the top of the sidebar.
  return { groups: [{ id, name, projects: [] }, ...groups], id };
}

export function renameGroup(
  groups: readonly ProjectGroup[],
  id: string,
  name: string,
): ProjectGroup[] | null {
  const trimmed = name.trim();
  const current = groups.find((group) => group.id === id);
  if (!current || !trimmed || current.name === trimmed) return null;
  return groups.map((group) => (group.id === id ? { ...group, name: trimmed } : group));
}

/** Deleting a group keeps its projects; they fall back to the ungrouped section. */
export function removeGroup(groups: readonly ProjectGroup[], id: string): ProjectGroup[] {
  return groups.filter((group) => group.id !== id);
}

/** First unused default name, such as "Group 3". `format` supplies the localized pattern. */
export function nextGroupName(groups: readonly ProjectGroup[], format: (number: number) => string): string {
  const names = new Set(groups.map((group) => group.name));
  for (let number = groups.length + 1; ; number += 1) {
    const name = format(number);
    if (!names.has(name)) return name;
  }
}
