/**
 * Shared helpers for the Soli Keyword Linker e2e tests.
 *
 * The wp-env test environment uses plain permalinks, so REST requests are made
 * through the `?rest_route=` fallback instead of `/wp-json/`.
 */

const { expect } = require( '@playwright/test' );

const ADMIN_USER = 'admin';
const ADMIN_PASSWORD = 'password';

/** Fragments of paths that identify this plugin's own PHP files. */
const PLUGIN_PHP_FILES = 'wp-soli-keyword-linker-plugin\\.php|inc/class-[a-z-]+\\.php';

/** Diagnostics that are never acceptable, wherever they come from. */
const FATAL_ERROR_PATTERN = /Fatal error|Parse error/i;

/** Softer diagnostics, but only when they point at this plugin's files. */
const PLUGIN_DIAGNOSTIC_PATTERN = new RegExp(
	'(Warning|Notice|Deprecated):[^\\n]*(' + PLUGIN_PHP_FILES + ')',
	'i'
);

/**
 * Reads body text twice: with scripts (for fatals, which may land inside an
 * inline script) and without (for the path-scoped pattern, which must not see
 * wp-admin's JSON blobs). Uses textContent, not innerText, so hidden
 * containers are not skipped. See wp-soli-featured-image-plugin for the full
 * rationale.
 */
function readBodyText( page ) {
	return page.evaluate( () => {
		const clone = document.body.cloneNode( true );
		clone
			.querySelectorAll( 'script, style, template, noscript' )
			.forEach( ( node ) => node.remove() );
		return {
			full: document.body.textContent || '',
			markup: clone.textContent || '',
		};
	} );
}

async function expectNoPhpDiagnostics( page ) {
	const url = page.url();
	const { full, markup } = await readBodyText( page );
	expect( full, `PHP fatal/parse error rendered by ${ url }` ).not.toMatch(
		FATAL_ERROR_PATTERN
	);
	expect(
		markup,
		`PHP warning/notice/deprecation from this plugin rendered by ${ url }`
	).not.toMatch( PLUGIN_DIAGNOSTIC_PATTERN );
}

function restUrl( route ) {
	return '/?rest_route=' + encodeURIComponent( route );
}

async function loginAsAdmin( page ) {
	await page.goto( '/wp-login.php' );
	await page.fill( '#user_login', ADMIN_USER );
	await page.fill( '#user_pass', ADMIN_PASSWORD );
	await page.click( '#wp-submit' );
	await page.waitForURL( /wp-admin/ );
}

async function loginAndGetNonce( page ) {
	await loginAsAdmin( page );
	await page.goto( '/wp-admin/post-new.php?post_type=page' );
	await page.waitForFunction(
		() => !! ( window.wpApiSettings && window.wpApiSettings.nonce )
	);
	return page.evaluate( () => window.wpApiSettings.nonce );
}

async function authenticatedRest( page, nonce, { route, method = 'GET', body } ) {
	return page.evaluate(
		async ( { url, method: httpMethod, nonce: restNonce, body: payload } ) => {
			const response = await fetch( url, {
				method: httpMethod,
				headers: {
					'Content-Type': 'application/json',
					'X-WP-Nonce': restNonce,
				},
				credentials: 'same-origin',
				body: payload === undefined ? undefined : JSON.stringify( payload ),
			} );
			let parsed = null;
			try {
				parsed = await response.json();
			} catch {
				parsed = null;
			}
			return { status: response.status, body: parsed };
		},
		{ url: restUrl( route ), method, nonce, body }
	);
}

/**
 * Creates a published post or page and returns `{ id, link, title }`.
 */
async function createContent( page, nonce, { type = 'pages', title, content = '' } ) {
	const { status, body } = await authenticatedRest( page, nonce, {
		route: `/wp/v2/${ type }`,
		method: 'POST',
		body: { title, content, status: 'publish' },
	} );
	if ( status !== 201 ) {
		throw new Error(
			`Could not create ${ type } "${ title }": ${ status } ${ JSON.stringify( body ) }`
		);
	}
	return { id: body.id, link: body.link, title: body.title.rendered };
}

/**
 * Adds a rule through the Tools page, exactly as an administrator would.
 */
async function addRule( page, { phrases, pageId } ) {
	await page.goto( '/wp-admin/tools.php?page=soli-keyword-linker' );
	await page.fill( '#soli-keyword-phrases', phrases.join( '\n' ) );
	await page.selectOption( '#soli-keyword-post-id', String( pageId ) );
	await page.click( '#submit' );
	await page.waitForURL( /notice=saved/ );
}

/**
 * Deletes every rule so tests start clean. Runs as many delete requests as
 * there are rows.
 */
async function deleteAllRules( page ) {
	await page.goto( '/wp-admin/tools.php?page=soli-keyword-linker' );
	// eslint-disable-next-line no-constant-condition
	while ( true ) {
		const link = page.locator( '#soli-keyword-linker-rules a.submitdelete' ).first();
		if ( ( await link.count() ) === 0 ) {
			break;
		}
		await link.click();
		await page.waitForURL( /notice=deleted/ );
	}
}

/**
 * Opens the block editor for a new post with the welcome guide dismissed and
 * waits until the editor store is ready.
 */
async function openNewPost( page, postType = 'post' ) {
	await page.goto( `/wp-admin/post-new.php?post_type=${ postType }` );
	await page.waitForFunction( () => !! ( window.wp && window.wp.data ) );
	await page.evaluate( () => {
		const prefs = window.wp.data.dispatch( 'core/preferences' );
		prefs.set( 'core/edit-post', 'welcomeGuide', false );
		prefs.set( 'core', 'welcomeGuide', false );
	} );
	const dialog = page.getByRole( 'dialog', { name: /welcome/i } );
	if ( await dialog.isVisible().catch( () => false ) ) {
		await dialog.getByRole( 'button', { name: /close/i } ).click();
	}
	await page.frameLocator( 'iframe[name="editor-canvas"]' ).locator( 'body' ).waitFor();
}

module.exports = {
	ADMIN_USER,
	ADMIN_PASSWORD,
	restUrl,
	loginAsAdmin,
	loginAndGetNonce,
	authenticatedRest,
	createContent,
	addRule,
	deleteAllRules,
	openNewPost,
	expectNoPhpDiagnostics,
};
