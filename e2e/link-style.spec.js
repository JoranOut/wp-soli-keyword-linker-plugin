const { test, expect } = require( '@playwright/test' );
const { loginAndGetNonce, createContent, expectNoPhpDiagnostics } = require( './helpers' );

const RED = 'rgb(209, 0, 0)';

test.describe( 'Content link styling', () => {
	test( 'front-end content links get a thick red underline', async ( { page, context } ) => {
		const nonce = await loginAndGetNonce( page );
		const post = await createContent( page, nonce, {
			type: 'posts',
			title: 'Styled links ' + Date.now(),
			content:
				'<!-- wp:paragraph --><p>Ga naar <a href="https://example.com/" id="soli-test-link">de pagina</a>.</p><!-- /wp:paragraph -->' +
				'<!-- wp:buttons --><div class="wp-block-buttons"><!-- wp:button --><div class="wp-block-button"><a class="wp-block-button__link wp-element-button" href="https://example.com/" id="soli-test-button">Knop</a></div><!-- /wp:button --></div><!-- /wp:buttons -->',
		} );

		await context.clearCookies();
		await page.goto( post.link );
		await expectNoPhpDiagnostics( page );

		const link = page.locator( '#soli-test-link' );
		await expect( link ).toHaveCSS( 'text-decoration-color', RED );
		await expect( link ).toHaveCSS( 'text-decoration-thickness', '3px' );
		await expect( link ).toHaveCSS( 'text-decoration-line', 'underline' );

		await expect( page.locator( '#soli-test-button' ) ).not.toHaveCSS( 'text-decoration-color', RED );
	} );

	test( 'the same stylesheet is loaded inside the editor canvas', async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		const post = await createContent( page, nonce, {
			type: 'posts',
			title: 'Editor styled links ' + Date.now(),
			content: '<!-- wp:paragraph --><p>Ga naar <a href="https://example.com/" id="soli-test-link">de pagina</a>.</p><!-- /wp:paragraph -->',
		} );

		await page.goto( `/wp-admin/post.php?post=${ post.id }&action=edit` );
		const canvas = page.frameLocator( 'iframe[name="editor-canvas"]' );
		const link = canvas.locator( 'a[href="https://example.com/"]' );
		await expect( link ).toBeVisible();
		await expect( link ).toHaveCSS( 'text-decoration-color', RED );
		await expect( link ).toHaveCSS( 'text-decoration-thickness', '3px' );
	} );
} );
