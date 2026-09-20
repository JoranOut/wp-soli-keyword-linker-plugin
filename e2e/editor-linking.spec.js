const { test, expect } = require( '@playwright/test' );
const {
	loginAndGetNonce,
	createContent,
	addRule,
	deleteAllRules,
	openNewPost,
	expectNoPhpDiagnostics,
} = require( './helpers' );

/** Inserts a paragraph via the store and returns its client id. Selects it. */
async function insertParagraph( page, content ) {
	return page.evaluate( ( text ) => {
		const block = window.wp.blocks.createBlock( 'core/paragraph', { content: text } );
		window.wp.data.dispatch( 'core/block-editor' ).insertBlocks( block );
		return block.clientId;
	}, content );
}

async function blockHtml( page, clientId ) {
	return page.evaluate( ( id ) => {
		const content = window.wp.data.select( 'core/block-editor' ).getBlock( id ).attributes.content;
		return typeof content === 'string' ? content : content.toHTMLString();
	}, clientId );
}

test.describe( 'Editor keyword linking', () => {
	let target;

	test.beforeEach( async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		target = await createContent( page, nonce, { title: 'Klein Orkest ' + Date.now() } );
		await deleteAllRules( page );
		await addRule( page, { phrases: [ 'klein orkest', 'Harmonie' ], pageId: target.id } );
	} );

	test( 'links a phrase once the writer leaves the block', async ( { page } ) => {
		await openNewPost( page );
		await expectNoPhpDiagnostics( page );

		const first = await insertParagraph( page, 'Het Klein Orkest speelt vanavond, net als het klein orkest van vorig jaar.' );
		// Still selected: nothing may be rewritten under the caret.
		expect( await blockHtml( page, first ) ).not.toContain( '<a ' );

		const second = await insertParagraph( page, 'De harmonie speelt ook.' );
		await expect.poll( () => blockHtml( page, first ) ).toContain( `href="${ target.link }"` );

		const html = await blockHtml( page, first );
		expect( html ).toContain( 'class="soli-keyword-link"' );
		expect( html ).toContain( 'data-type="page"' );
		expect( html ).toContain( `data-id="${ target.id }"` );
		// Only the first occurrence is linked, and its casing is kept.
		expect( html.match( /<a /g ) ).toHaveLength( 1 );
		expect( html ).toMatch( /<a [^>]*>Klein Orkest<\/a>/ );

		// Case-insensitive match on the second rule, in the block we leave next.
		await page.evaluate( () => window.wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
		await expect.poll( () => blockHtml( page, second ) ).toMatch( /<a [^>]*>harmonie<\/a>/ );

		// The rendered canvas shows the link too.
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		await expect( canvas.locator( 'a.soli-keyword-link' ) ).toHaveCount( 2 );
	} );

	test( 'does not match inside other words or already linked text', async ( { page } ) => {
		await openNewPost( page );
		const first = await insertParagraph(
			page,
			'Harmonieorkest is één woord. <a href="https://example.com/">Klein Orkest</a> is al gelinkt.'
		);
		await insertParagraph( page, 'Ander blok.' );
		await page.evaluate( () => window.wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );

		// Give the linker a moment, then assert nothing changed.
		await page.waitForTimeout( 500 );
		const html = await blockHtml( page, first );
		expect( html ).not.toContain( target.link );
		expect( html.match( /<a /g ) ).toHaveLength( 1 );
	} );

	test( 'never links a page to itself', async ( { page } ) => {
		await page.goto( `/wp-admin/post.php?post=${ target.id }&action=edit` );
		await page.waitForFunction( () => !! ( window.wp && window.wp.data ) );
		await page.frameLocator( 'iframe[name="editor-canvas"]' ).locator( 'body' ).waitFor();

		const first = await insertParagraph( page, 'Welkom bij het klein orkest.' );
		await insertParagraph( page, 'Ander blok.' );
		await page.evaluate( () => window.wp.data.dispatch( 'core/block-editor' ).clearSelectedBlock() );
		await page.waitForTimeout( 500 );
		expect( await blockHtml( page, first ) ).not.toContain( '<a ' );
	} );
} );
