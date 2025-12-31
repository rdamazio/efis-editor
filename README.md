[![Angular CI](https://github.com/rdamazio/efis-editor/actions/workflows/angular-ci.yml/badge.svg)](https://github.com/rdamazio/efis-editor/actions/workflows/angular-ci.yml)

# EFIS file format editor

This is a web-based editor for file formats used by modern EFIS avionics systems on aircraft.

## Using

> [!IMPORTANT]
> First, read the disclaimer below carefully. Then:

:point_right: Head over to https://rdamazio.github.io/efis-editor/. :point_left:

## Editor features

- Checklists
  - Import/export from the formats below.
  - Multiple checklist files
  - Checklist item editing, reordering, moving within a file
  - Checklist renaming, reordering
  - Checklist group renaming, reordering
  - Checklist metadata editing, including Garmin's default group/checklist
  - Renders (fake) live data in place of GRT tokens like %1% (see GRT user manual for all tokens)
- Keyboard shortcuts for navigation and editing
- Works offline
- (optional) Google Drive™ synchronization

## Preview

You can try it out directly in the link above, but here's what it currently looks like:

![Screenshot of the checklist editor with a sample checklist displayed](docs/screenshot.png)

## Supported file types:

- Checklists:
  - Advanced Flight Systems (AFS)
  - Dynon SkyView
  - Jeppesen ForeFlight (.fmd file format)<sup>†</sup>
  - Garmin Pilot (.gplt file format) <sup>ᶢ†</sup>
  - Garmin G3X / G3X Touch / GTN (.ace file format)
  - Grand Rapids (GRT)
  - Printable (PDF) - export only, selectable page size
  - Raw (JSON) - the editor's internal format (for lossless backup purposes)

<sup>†</sup> Thanks to [Yury V. Zaytsev](https://github.com/zyv)!

Different checklist file formats support different subsets of all the features in the editor:

| **Feature**                | AFS/Dynon          | ForeFlight         | Garmin (G3X/GTN)   | Garmin Pilot       | GRT                | PDF                |
| -------------------------- | ------------------ | ------------------ | ------------------ | ------------------ | ------------------ | ------------------ |
| Checklist groups           | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Checklist group categories | :x:                | :white_check_mark: | :x:                | :white_check_mark: | :x:                | :white_check_mark: |
| Item types                 | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: | :white_check_mark: |
| Indentation                | :white_check_mark: | :x:                | :white_check_mark: | :x:                | :white_check_mark: | :white_check_mark: |
| Centering                  | :white_check_mark: | :x:                | :white_check_mark: | :x:                | :white_check_mark: | :white_check_mark: |
| Default checklist/group    | :x:                | :x:                | :white_check_mark: | :x:                | :x:                | :x:                |
| Checklist metadata         | :white_check_mark: | :white_check_mark: | :white_check_mark: | :x:                | :white_check_mark: | :white_check_mark: |
| Live data                  | :x:                | :x:                | :x:                | :white_check_mark: | :white_check_mark: | :x:                |
| Completion actions         | :x:                | :x:                | :x:                | :white_check_mark: | :x:                | :x:                |

> [!NOTE]
> See sections below on format-specific details to understand how data from the editor gets translated to those formats.

Internally, files are stored in our own format, so it is possible to import a
file in one format and then export it in another.

## File storage

Unless cloud synchronization (described below) is enabled, this is a standalone web app that doesn't talk to any servers.
To accomplish this, files and preferences are stored on your browser's local storage. This does mean that if you lose your
device or clear your browser's data, they will be lost - so download your files and keep a copy safe.

## Cloud synchronization

Optionally, you may connect the web app to Google Drive to both safekeep your files
automatically, and to be able to use this app across multiple devices (if you connect
the app to Drive on each of them). This works by synchronizing the file storage described
above to Google Drive.

To enable synchronization, click on the Cloud icon at the top-right of the app's page and
follow instructions to authorize the connection.

Files synchronized this way are stored separately from your main Google Drive files,
as [_application-specific data_](https://developers.google.com/drive/api/guides/appdata).
This means that the app never sees or has access to any other files on your Google Drive.
Files or their metadata are also never sent to any other servers - communication happens
directly between your browser and Google Drive servers.

You can see the connection between the app and Google Drive, as well as delete contents
synchronized to it, by going to [Drive settings](https://drive.google.com/drive/u/0/settings)
and selecting "Manage apps". Disconnecting from Google Drive, either within this app, or
through that settings interface, does not automatically delete synchronized data.
Google Drive does not support directly viewing or manipulating files stored in it this way.

The synchronization is _simple_ and based purely on when a file was last modified. If the same
file is modified on multiple instances of the app at the same time, changes are NOT merged,
and instead the version that was saved most recently wins.

This works through the [Google Drive API](https://developers.google.com/drive/api/),
and use of this feature is subject to the
[Google Drive API Terms of Service](https://developers.google.com/drive/api/terms).

## Offline use

The editor is a PWA (Progressive Web App) and should load and work normally even if you have no
Internet connection (except for Cloud synchronization, obviously). Entering/selecting the app's
web address on your browser will simply work even without a connection.

You can also install it as a browser/OS application so you can get a dedicated icon to launch it.
How to install it is browser-specific - on Chrome, you can
[click Install on the address bar](https://support.google.com/chrome/answer/9658361), while
Safari lets you add a Home Screen icon
([macOS instructions](https://support.apple.com/en-mide/104996) /
[iOS instructions](https://support.apple.com/en-mide/guide/iphone/iph42ab2f3a7/ios) /
[iPadOS instructions](https://support.apple.com/en-mide/guide/ipad/ipadc602b75b/ipados)).

## Format-specific information

### AFS/Dynon

AFS and Dynon use a simple text format for checklists, so different item types, identation,
centering, etc. are represented with plain text formatting (e.g. titles show up as
`** YOUR TITLE **`) or prefixes (e.g. a warning will read `WARNING: Your warning text`). As much as
possible, the editor supports parsing this formatting back when importing, but if you add your own
formatting to an item's text, it may get it wrong.

This format supports multiple checklists, but not checklist groups - instead, groups after the first
one have the group names prepended to the checklist name (e.g. an "Engine-out landing" checklist
under the "Emergency" group will show up as a checklist named "Emergency - Engine-out landing").

Because the UI on these EFISs can take different layouts, and the EFIS does not support wrapping of
lines that exceed the UI's width, you must export the checklist with the right width. The export
process will then wrap lines longer than that length.

This format also does not support checklist metadata, so an additional checklist with all your
metadata is added to the end of the file.

### GRT

GRT uses a text format for checklists, very similar to AFS/Dynon (see above).

It also supports dynamic data, where certain EFIS parameters are baked into the text by entering
tokens like `%24%` (oil temperature) anywhere in the text of any item type. Supported tokens are
listed in the GRT manual (there's 130 of them).

### ForeFlight

ForeFlight only supports two item types native - "Detail" and "Check" items. Challenge and
challenge/response items are exported as "Check" items, while all other types are exported
as "Detail" items, with appropriate prefixes.

ForeFlight also supports notes with multiple lines, while EFIS Editor does not - when
exporting and importing, plaintext/note/caution/warning items will be combined or split
as appropriate.

ForeFlight has partial support for checklist metadata - of the information you enter on EFIS
Editor, only file name, aircraft information and make/model will be included, but not
manufacturer or copyright info.

### Garmin ACE

Garmin G3X does not support empty groups or checklists, so they are skipped when exporting.

### Garmin Pilot

At Garmin's request, the EFIS editor supports the `.gplt` file format (unencrypted), but not
`.gplts` (encrypted). `.gplt` files can be imported into Garmin Pilot just the same, and can be
imported back into the EFIS editor, but the editor will not import existing .gplts files, and
Garmin Pilot unfortunately gives no way to export checklists as `.gplt`. If you'd like to see
full `.gplts` support, let Garmin know!

Garmin Pilot does not support arbitrary checklist groups - you may still use them in the editor,
but when exporting, all checklists will be grouped by category (normal/abnormal/emergency) and
subcategory (preflight/takeoff/cruise/landing/other), and the group titles are discarded.

Garmin Pilot subcategories exist only for the `Normal` category, and are derived from the group
title - for the mapping to occur, the group title must be named exactly `Preflight`,
`Takeoff/Cruise` or `Landing` - checklists under any other group names will show up
as `Other`.

Garmin Pilot also supports dynamic data and actions in the checklists. To insert one of these,
add a challenge/response item, and on the response (right) side, enter only the token for the
data or action you'd like. Tokens cannot be mixed with other text on the response side, though
you can still enter any text you'd like on the challenge (left) side.

Supported tokens are `%LOCAL_ALTIMETER%`, `%OPEN_NEAREST%`, `%OPEN_ATIS_SCRATCHPAD%`,
`%OPEN_CRAFT_SCRATCHPAD%`, `%WEATHER_FREQUENCY%`, `%CLEARANCE_FREQUENCY%`,
`%GROUND_CTAF_FREQUENCY%`, `%TOWER_CTAF_FREQUENCY%`, `%APPROACH_FREQUENCY%`, and
`%CENTER_FREQUENCY%`.

### PDF (printing)

PDF format exports are meant for printing, so you can have a hard copy backup of your checklists.
There's no support for importing PDF files back into the editor, so be sure to keep a copy of your
data in other formats (we recommend JSON for backup purposes).

The "Offset group title by top margin" option lets you offset the group title to allow room for
spiral binding. If not selected, the group title will be centered on the top part of the page.
Alternatively, you can select "Output group cover pages" and the start of each group will have a
full page with the group title.

Printing settings are preserved on your browser's storage (but not synchronized even if you have
Cloud synchronization enabled).

### JSON

The JSON format exported by this editor reflects the raw storage format the app uses internally,
and will reflect the `ChecklistFile` proto message defined
[here](https://github.com/rdamazio/efis-editor/blob/main/src/model/proto/checklist.proto).

## Disclaimer

> [!IMPORTANT]
> This is not your usual disclaimer - read it carefully.

> [!CAUTION]
> :skull_and_crossbones: Failure to follow proper procedures can result in serious
> injury or death. :skull_and_crossbones:

Use of files generated by this application on your avionics is at your own risk,
and we make no guarantee that the output will be correct or safe to use. Approach
using these files with the same care that you would any flight testing activity -
we recommend thoroughly testing them before use during actual operations (including
checking them with the manufacturer's recommended apps where available, thoroughly
testing on the ground before flight, having paper copies of your checklists, and any
other precautions you would take when using an avionics configuration that's **_not
supported_** or documented by your avionics manufacturer). We take no responsibility if
it makes your EFIS crash, melt and/or you crash and die while attempting to use
these files. We obviously also take no responsibility for the actual contents of your
checklists, or even guarantee that the contents you enter in this app will
be accurately reflected in your EFIS. Likewise, we make no guarantee that generated
printable files will be correct, complete or safe to use as paper backups.

Experimental aircraft use only - use for certificated aircraft is not authorized.

The authors of this app have no association or relationship with the manufacturers
of the avionics with which these files may be used, and its use is not supported by
or endorsed by any of those companies.

This project is not an official Google project. It is not supported by
Google and Google specifically disclaims all warranties as to its quality,
merchantability, or fitness for a particular purpose.

## License

This project is available as Open Source Software, under the Apache 2.0 license.
See [LICENSE](./LICENSE) for details about copyright and redistribution.

Google Drive is a trademark of Google Inc. Use of this trademark is subject to Google Permissions.

## Contributing

We welcome outside contributions, and there's plenty of things to do, so
don't be shy. Please ask if you want a pointer on something you can help with,
and hopefully we can all figure something out.

We do have [a few policies and
suggestions](https://github.com/rdamazio/efis-editor/blob/main/docs/contributing.md)
for contributors. The broad TL;DR:

- Bug reports and feature requests are very welcome!
- Every commit that lands in the `main` branch is code reviewed.
- We try to keep reasonably high [unit](https://github.com/search?q=repo%3Ardamazio%2Fefis-editor%20path%3A*.spec.ts&type=code)
  and [e2e](https://github.com/rdamazio/efis-editor/blob/main/src/app/checklists/checklists.component.spec.ts) test coverage so
  we can catch regressions easily
- Please behave yourself, and obey the Community Guidelines.
- There **is** a mandatory CLA you must agree to. Importantly, it **does not**
  transfer copyright ownership to Google or anyone else; it simply gives us the
  right to safely redistribute and use your changes.

### Contributions wanted

This is a short list of known areas where contributions would be helpful:

- **UI refinement**: As a backend developer (heck, nowadays I'm not even that, just a manager),
  my CSS-foo is quite limited. If you see something that looks odd, please send a PR!
- **Format testing**: I have not tested these files on anything but Garmin avionics and
  ForeFlight. Please test and send improvements.
- **Configuration files**: I'd like to support more than just checklists.
- Your favorite missing feature goes here.

## Development setup

The following steps can be followed to set up a development environment:

- If you haven't already, [install Node](https://nodejs.org/en/learn/getting-started/how-to-install-nodejs)
- Clone this project (we recommend using [jj](http://github.com/martinvonz/jj) for that!)
- `npm install` (will install all dependencies into `node_modules/`)
- `npm run genproto` (will generate protocol buffer files into `gen/ts/`)
- `npm run genkeys` (will populate a dummy dev-only client ID into `src/environments/dev-keys.ts`)
- If you plan to use/change the Google Drive synchronization feature while running locally,
  edit `src/environments/dev-keys.ts` to set your own OAuth client ID that allows localhost
  connections. See the [Drive API documentation](https://developers.google.com/drive/api/) for how
  to do obtain a client ID.

You can then develop as you normally would any Angular app (e.g. `ng serve`).

To test your changes, you can use `npm run prepush` (all checks) or just `npm run test:headless`
(only unit tests).

If you make changes to `.proto` files, you'll need to run the genproto step again
(or you can use an IDE extension such as [vscode-proto3](https://github.com/zxh0/vscode-proto3) to
do that automatically when the file is saved).
