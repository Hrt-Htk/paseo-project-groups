Paseo lists every project in one long column. Once you have a dozen or so, finding one means scrolling. This plugin lets you put projects into groups like Work, Clients or Side projects, and fold the groups you aren't using right now.

## Turn it on after installing

Installing the plugin does not change the sidebar. Paseo only switches sidebar views when you pick one yourself.

1. Open **Settings → Sidebar**.
2. Set **View** to **Project groups**.

The second screenshot shows both steps. To go back, set View to Default view. Your groups stay saved.

## Making groups

Click **New group** at the top of the sidebar and type a name. Then drag projects onto it.

- Drop a project on a group header to add it to the end of that group.
- Drop it between two projects to put it where the blue line shows.
- Drag a group header to move the whole group.
- On a phone or tablet, long-press a project or group name, then drag. A quick swipe scrolls the list instead.
- Projects you haven't sorted yet sit under Ungrouped. New projects land there too.
- Deleting a group leaves its projects alone. They go back to Ungrouped.

Folding a project or group hides its workspaces but not their status. The folded row shows the most urgent one on its icon: needs input, failed, running, or ready to review. Ungrouped does the same. If the workspace you have open is inside, the folded row also gets a light fill, so you can see where it went.

The ⋯ button on a project moves it to another group, puts it under another project, starts a new workspace, copies its path or removes it. The ⋯ button on a workspace renames, pins, copies the path or branch, or archives it.

## Sub-projects

A project can sit under another project, for example a folder of plugins under the project that holds them. Open the ⋯ menu on the project and pick a parent under **Put under project**. It lists the other projects of the same group, or of Ungrouped.

- A sub-project shows under its parent, one step in, after the parent's workspaces.
- Folding the parent hides its sub-projects, and the folded icon includes their status.
- Only one level: a project that has sub-projects can't go under another one.
- To take it out, pick **Back to top level** in the same menu. It lands right after its parent. Moving it to a group, or dragging it to one, works too.
- If the parent is removed, its sub-projects take its place in its group.

## Several hosts

When the app is connected to more than one host, projects from all of them show in this view.

- Ungrouped splits into one section per host, such as "Ungrouped · Mac". A new project lands in its own host's section.
- Projects inside groups get a small host tag after their name, so two projects with the same name can be told apart. Turn the tags off with **Host name tags** in the settings.
- A group can hold projects from different hosts. A project's host never changes, so dropping it on another host's Ungrouped sends it back to its own.
- Tags use the host names from Paseo's settings. If two hosts look the same, rename one under **Settings → Host → Overview**.
- Groups are saved on the host that provides this view. While another host is offline, its projects are hidden, and they come back in the same place when it reconnects.

## Colors and icons

Projects show the image you gave them in Paseo, or a folder when they have none.

To change a look, click a project's icon or a group's palette button. Pick one of 11 colors and one of 36 icons, search all Lucide icons by name, or type a single emoji. For a workspace, use Set color in its ⋯ menu. The color goes on the name and the icon.

What you pick here only shows in this view and changes nothing in Paseo. Reset the icon to bring back the project's own image. Images can be PNG, JPEG, GIF or WebP, or an SVG that loads no outside files.

## Settings

The sliders button next to New group opens the plugin's settings. You can change:

- text size, from 11 to 15 pt
- row height
- space between groups, from none to extra large
- how far projects and workspaces are indented
- whether group names are bold
- which details show: project icons, host name tags, status dots, status on folded rows, changed-line counts, the Pinned section
- the language: same as the app, English, Korean or Simplified Chinese

Settings are saved per device, so your phone and your computer can look different.

## What it stores

Groups, their order, colors and icons are saved in the plugin's settings on the daemon. Every app connected to that daemon sees the same groups. Which groups are folded is saved per device. Project images come from the daemon running the plugin, over a local connection that uses Paseo's own installed modules. Nothing goes to an outside service. When an image can't be read, the folder icon shows instead.

Removing a project runs `paseo project delete` on the daemon's machine, because the plugin API has no call for it. Paseo archives the project's workspaces and leaves the project folder on disk. Worktrees that Paseo created for those workspaces can be deleted when they are archived. The confirm dialog tells you this before anything happens.

When a sub-project's parent disappears from the list, the plugin asks the daemon with `paseo daemon status` and `paseo project ls` whether the parent still exists. It cleans up only when the daemon says the parent is gone, so a list that is still loading never loses your nesting.

## Limits

- Don't uninstall the plugin to update it. Uninstalling deletes your groups, colors and icons. Update it from the Plugins page or with `paseo plugin update project-groups`.
- Workspaces can't be dragged, because each one belongs to its project's folder.
- The daemon and the app both need Paseo 0.16 or later. Older apps show the plugin as incompatible and keep the default sidebar.
