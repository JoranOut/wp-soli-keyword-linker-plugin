# wp-soli-keyword-linker-plugin

Links configured keywords to pages while editing, and styles content links.

## Layout

- `wp-soli-keyword-linker-plugin.php` — header, constants, wiring, GitHub updater config.
- `inc/class-rules.php` — `Soli\KeywordLinker\Rules`. Rules live in one option, `soli_keyword_linker_rules`, as `[{id, phrases[], post_id}]`. `for_editor()` resolves URLs and drops unpublished targets.
- `inc/class-admin-page.php` — Tools → Keyword links. Save and delete go through `admin_post_*` handlers with nonces and `manage_options`.
- `inc/class-assets.php` — enqueues `build/editor.js` on `enqueue_block_editor_assets` (rules are inlined as `window.soliKeywordLinker`) and `build/links.css` on `enqueue_block_assets`, which covers the front end and the editor canvas iframe in one go.
- `src/editor.js` — subscribes to `core/block-editor`. For every paragraph, heading and list item that is **not** the selected block it applies the `core/link` format to the first whole-word, case-insensitive match of each phrase, longest phrase first. Skips text already inside a link and the post that is the link target.
- `src/links.scss` — the red underline. Scoped to `p/li/h* a` inside `.wp-block-post-content`, `.entry-content` and `.editor-styles-wrapper`, excluding buttons.

## Decisions

- Linking is done in the editor and saved into the post, not filtered at render time. What the writer sees is what is published, and links can be removed by hand.
- The selected block is never rewritten because replacing rich text under the caret moves it. Links appear when the writer leaves the block.
- No custom table. A handful of rules fits in an option.
- The link carries `class="soli-keyword-link"` and `data-type="page"`/`data-id`, matching what the core link UI writes, so the link popover recognises it as a page link.

## Testing

`npm run test:e2e`. Ports are pinned to 8912 (dev) and 8913 (tests). REST goes through `?rest_route=` because wp-env uses plain permalinks. The editor canvas is an iframe; use `page.frameLocator('iframe[name="editor-canvas"]')`.
