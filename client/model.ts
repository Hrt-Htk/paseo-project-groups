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

/** Sub-project ref key -> parent project ref key, as stored in the groups document. */
export type Parents = Readonly<Record<string, string>>;

export interface Placement {
  groups: ProjectGroup[];
  parents: Record<string, string>;
}

/**
 * Parent key -> its sub-project keys, in `order`. Only one level counts: a link whose parent is
 * gone, or is itself a sub-project, is ignored and that project shows at the top level again.
 */
export function subProjects(order: readonly string[], parents: Parents): Map<string, string[]> {
  const present = new Set(order);
  const nestedLink = (key: string) => {
    const parent = parents[key];
    return parent !== undefined && parent !== key && present.has(parent);
  };
  const tree = new Map<string, string[]>();
  for (const key of order) {
    const parent = parents[key];
    if (!nestedLink(key) || nestedLink(parent!)) continue;
    const children = tree.get(parent!);
    if (children) children.push(key);
    else tree.set(parent!, [key]);
  }
  return tree;
}

/** Can `key` go under `parent`? Keeps nesting one level deep. */
export function canNest(parents: Parents, key: string, parent: string): boolean {
  if (key === parent || parent in parents) return false;
  return !Object.values(parents).includes(key);
}

/** Puts `key` under `parent` and out of its group. Null when it is already there or not allowed. */
export function nestProject(
  groups: readonly ProjectGroup[],
  parents: Parents,
  key: string,
  parent: string,
): Placement | null {
  if (parents[key] === parent || !canNest(parents, key, parent)) return null;
  return {
    groups: groups.map((group) =>
      group.projects.includes(key) ? { ...group, projects: group.projects.filter((item) => item !== key) } : group,
    ),
    parents: { ...parents, [key]: parent },
  };
}

/** Moves a project to a group or Ungrouped, taking it out from under its parent. Null when nothing changes. */
export function placeProject(
  groups: readonly ProjectGroup[],
  parents: Parents,
  key: string,
  target: DropTarget,
): Placement | null {
  const nextGroups = moveProject(groups, key, target);
  const nested = key in parents;
  if (!nextGroups && !nested) return null;
  const nextParents = { ...parents };
  delete nextParents[key];
  return { groups: nextGroups ?? [...groups], parents: nextParents };
}

/** Drops every link to or from a removed project. Its sub-projects fall back to Ungrouped. */
export function forgetProject(parents: Parents, key: string): Record<string, string> | null {
  const entries = Object.entries(parents).filter(([child, parent]) => child !== key && parent !== key);
  return entries.length === Object.keys(parents).length ? null : Object.fromEntries(entries);
}

