[![version](https://img.shields.io/github/package-json/v/JoranOut/wp-soli-keyword-linker-plugin?label=version&color=3858e9)](https://github.com/JoranOut/wp-soli-keyword-linker-plugin/releases)
[![nightly](https://img.shields.io/github/v/release/JoranOut/wp-soli-keyword-linker-plugin?include_prereleases&label=nightly&color=fb8817)](https://github.com/JoranOut/wp-soli-keyword-linker-plugin/releases)
[![requires](https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2FJoranOut%2Fwp-soli-keyword-linker-plugin%2Fmain%2Fpackage.json&query=%24.wordpress.requiresAtLeast&label=requires&prefix=WP%20&color=40a8af)](https://wordpress.org/download/releases/)
[![license](https://img.shields.io/github/license/JoranOut/wp-soli-keyword-linker-plugin?color=blue)](LICENSE)

# WP Soli Keyword Linker

Links keywords to pages while you write, for [soli.nl](https://www.soli.nl).

<!-- Machine-readable markers. publish.js reads the plugin name to name the zip,
     and the release workflows rewrite the version here when packaging a build.
     Kept in a comment because a single tilde renders as strikethrough on GitHub.
     Do not reformat.
~Plugin Name: wp-soli-keyword-linker-plugin~
~Current Version: 0.1.0~
-->

What it does:

- **Tools → Keyword links** holds a table of rules. Each rule is a set of keywords or phrases and the page they should link to.
- **In the block editor**, the first occurrence of each phrase in a paragraph, heading or list item becomes a standard WordPress link (the `core/link` format) as soon as you move to another block. Matching ignores case and only matches whole words. Text that is already a link is left alone, and a page never links to itself.
- **Content links** on the front end and in the editor canvas are drawn as a red guitar string: a thick red line under the text that vibrates while you hover, with two notes flying out of it. Buttons are excluded. Under "reduced motion" the string stays still. The string colour is baked into the SVG in `src/links.scss`; `--soli-keyword-link-color` colours the notes and the hovered text.

Rules are stored in a single option, `soli_keyword_linker_rules`. Uninstalling removes it.

# Development

```sh
npm install
npm run build        # compiles src/ into build/
npm run env:start    # http://localhost:8912, admin / password
npm run test:e2e     # Playwright against the tests site on :8913
```

`build/` is gitignored. The release and nightly workflows run `npm run build` before packaging.
