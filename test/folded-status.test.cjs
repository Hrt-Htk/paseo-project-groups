const assert = require("node:assert/strict");
const { readFileSync } = require("node:fs");
const path = require("node:path");
const { test } = require("node:test");
const vm = require("node:vm");
const React = require("react");
const { act, create } = require("react-test-renderer");
const ts = require("typescript");

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const theme = {
  colors: {
    surface0: "#ffffff",
    foregroundMuted: "#666666",
    accent: "#008800",
    statusWarning: "#cc8800",
    statusDanger: "#cc0000",
    statusSuccess: "#00aa00",
    border: "#cccccc",
  },
};
const noop = () => {};

function load(file, modules) {
  const source = readFileSync(path.join(__dirname, "..", "client", file), "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.ReactJSX,
    },
  });
  const exports = {};
  vm.runInNewContext(outputText, {
    exports,
    require(name) {
      assert.ok(name in modules, `Unexpected import: ${name}`);
      return modules[name];
    },
  });
  return exports;
}

const model = load("model.ts", {});

test("mostUrgent follows Paseo's order and ignores unknown values", () => {
  assert.equal(model.mostUrgent([]), "done");
  assert.equal(model.mostUrgent(["attention", "running"]), "running");
  assert.equal(model.mostUrgent(["running", "failed", "attention"]), "failed");
  assert.equal(model.mostUrgent(["done", "needs_input", "failed"]), "needs_input");
  assert.equal(model.mostUrgent(["something-new", "attention"]), "attention");
});

function groupHeader({ collapsed, showFoldedStatus, statuses }) {
  const queries = [];
  const { GroupHeader } = load("rows.tsx", {
    react: React,
    "react/jsx-runtime": require("react/jsx-runtime"),
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable", ActivityIndicator: "Spinner" },
    "@getpaseo/plugin/client": {
      useWorkspaces: (query) => {
        queries.push(query);
        return statuses.map((key) => ({ key, title: null, color: null, items: [] }));
      },
    },
    "@getpaseo/plugin/client/ui": { Icon: "Icon", TextInput: "Input" },
    "./i18n": { useT: () => (key) => key },
    "./model": model,
    "./project-icon": { ProjectIcon: "ProjectIcon" },
    "./look": { useLook: () => ({ icon: 13, showFoldedStatus, showPinned: true }) },
    "./drag": {
      useDrag: () => ({ recentlyDropped: () => false }),
      useDragSlot: () => null,
      useDragHandle: () => ({}),
    },
    "./decor": {
      DecorIcon: "DecorIcon",
      useDecorations: () => ({ get: () => ({ color: null, icon: null }) }),
    },
  });
  const props = {
    group: { id: "group", name: "Work", projects: ["p1"] },
    count: 1,
    collapsed,
    renaming: false,
    dragging: false,
    view: { theme, layout: { compact: true } },
    onToggle: noop,
    onStartRename: noop,
    onRename: noop,
    onCancelRename: noop,
    onDelete: noop,
  };
  let renderer;
  act(() => {
    renderer = create(React.createElement(GroupHeader, props));
  });
  const badges = renderer.root.findAll((node) =>
    String(node.props.accessibilityLabel ?? "").startsWith("status."),
  );
  return { badges, queries, renderer };
}

test("a folded group shows its most urgent status", () => {
  const { badges, queries, renderer } = groupHeader({
    collapsed: true,
    showFoldedStatus: true,
    statuses: ["running", "needs_input"],
  });
  assert.equal(badges.length, 1);
  assert.equal(badges[0].props.accessibilityLabel, "status.needs_input");
  const where = queries[0].where;
  const workspace = { project: { key: "p1" }, pinnedAt: null, background: false, archivingAt: null };
  assert.equal(where(workspace), true);
  assert.equal(where({ ...workspace, project: { key: "other" } }), false);
  assert.equal(where({ ...workspace, background: true }), false);
  act(() => renderer.unmount());
});

test("an open group, or the setting off, shows no badge", () => {
  for (const options of [
    { collapsed: false, showFoldedStatus: true },
    { collapsed: true, showFoldedStatus: false },
  ]) {
    const { badges, queries, renderer } = groupHeader({ ...options, statuses: [] });
    assert.equal(badges.length, 0);
    assert.equal(queries[0].where({ project: { key: "p1" } }), false);
    act(() => renderer.unmount());
  }
});

test("all done shows no badge", () => {
  const { badges, renderer } = groupHeader({ collapsed: true, showFoldedStatus: true, statuses: ["done"] });
  assert.equal(badges.length, 0);
  act(() => renderer.unmount());
});
