const { test, expect } = require( '@playwright/test' );
const { loginAndGetNonce, createContent, expectNoPhpDiagnostics } = require( './helpers' );

const PARAGRAPH =
	'<!-- wp:paragraph --><p>Ga naar <a href="https://example.com/" id="soli-test-link">de pagina</a>.</p><!-- /wp:paragraph -->';
const BUTTON =
	'<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://example.com/" id="soli-test-button">Knop</a></div><!-- /wp:button --></div><!-- /wp:buttons -->';

/** Reads the styles the guitar-string effect is made of. */
function readStringStyles( locator ) {
	return locator.evaluate( ( el ) => {
		const own = getComputedStyle( el );
		const before = getComputedStyle( el, '::before' );
		return {
			decoration: own.textDecorationLine,
			weight: own.fontWeight,
			cursor: own.cursor,
			isSvgString: own.backgroundImage.startsWith( 'url("data:image/svg+xml' ),
			vibrating: own.backgroundImage.includes( 'animate' ),
			noteAnimation: before.animationName,
			noteGlyph: before.content,
		};
	} );
}

test.describe( 'Content link styling: guitar string', () => {
	test( 'front-end links get the string, and vibrate with flying notes on hover', async ( { page, context } ) => {
		const nonce = await loginAndGetNonce( page );
		const post = await createContent( page, nonce, {
			type: 'posts',
			title: 'Styled links ' + Date.now(),
			content: PARAGRAPH + BUTTON,
		} );

		await context.clearCookies();
		await page.goto( post.link );
		await expectNoPhpDiagnostics( page );

		const link = page.locator( '#soli-test-link' );
		const rest = await readStringStyles( link );
		expect( rest.decoration ).toBe( 'none' );
		expect( rest.weight ).toBe( '500' );
		expect( rest.cursor ).toBe( 'pointer' );
		expect( rest.isSvgString ).toBe( true );
		expect( rest.vibrating ).toBe( false );
		expect( rest.noteAnimation ).toBe( 'none' );
		expect( rest.noteGlyph ).toBe( '"♪"' );

		await link.hover();
		await expect.poll( () => readStringStyles( link ) ).toMatchObject( {
			vibrating: true,
			noteAnimation: 'soli-keyword-note-left',
		} );

		// Buttons are links too, but keep their own styling.
		const button = await readStringStyles( page.locator( '#soli-test-button' ) );
		expect( button.isSvgString ).toBe( false );
		expect( button.noteGlyph ).not.toBe( '"♪"' );
	} );

	test( 'reduced motion keeps the string still on hover', async ( { page, context } ) => {
		const nonce = await loginAndGetNonce( page );
		const post = await createContent( page, nonce, {
			type: 'posts',
			title: 'Reduced motion ' + Date.now(),
			content: PARAGRAPH,
		} );

		await context.clearCookies();
		await page.emulateMedia( { reducedMotion: 'reduce' } );
		await page.goto( post.link );

		const link = page.locator( '#soli-test-link' );
		await link.hover();
		await page.waitForTimeout( 200 );
		const hovered = await readStringStyles( link );
		expect( hovered.isSvgString ).toBe( true );
		expect( hovered.vibrating ).toBe( false );
		expect( hovered.noteAnimation ).toBe( 'none' );
	} );

	test( 'the same stylesheet is loaded inside the editor canvas', async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		const post = await createContent( page, nonce, {
			type: 'posts',
			title: 'Editor styled links ' + Date.now(),
			content: PARAGRAPH,
		} );

		await page.goto( `/wp-admin/post.php?post=${ post.id }&action=edit` );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		const link = canvas.locator( 'a[href="https://example.com/"]' );
		await expect( link ).toBeVisible();
		const styles = await readStringStyles( link );
		expect( styles.decoration ).toBe( 'none' );
		expect( styles.weight ).toBe( '500' );
		expect( styles.isSvgString ).toBe( true );
	} );
} );
