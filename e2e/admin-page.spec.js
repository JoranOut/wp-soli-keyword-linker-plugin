const { test, expect } = require( '@playwright/test' );
const {
	loginAndGetNonce,
	createContent,
	addRule,
	deleteAllRules,
	expectNoPhpDiagnostics,
} = require( './helpers' );

test.describe( 'Tools → Keyword links', () => {
	let target;

	test.beforeEach( async ( { page } ) => {
		const nonce = await loginAndGetNonce( page );
		target = await createContent( page, nonce, { title: 'Target ' + Date.now() } );
		await deleteAllRules( page );
	} );

	test( 'renders under Tools without PHP diagnostics', async ( { page } ) => {
		await page.goto( '/wp-admin/tools.php?page=soli-keyword-linker' );
		await expect( page.getByRole( 'heading', { name: 'Keyword links', level: 1 } ) ).toBeVisible();
		await expect( page.locator( '#soli-keyword-linker-rules' ) ).toContainText( 'No rules yet.' );
		await expectNoPhpDiagnostics( page );
	} );

	test( 'adds, edits and deletes a rule', async ( { page } ) => {
		await addRule( page, { phrases: [ 'harmonie', 'klein orkest' ], pageId: target.id } );

		const row = page.locator( '#soli-keyword-linker-rules tbody tr' );
		await expect( row ).toHaveCount( 1 );
		await expect( row ).toContainText( 'harmonie, klein orkest' );
		await expect( row.locator( 'a' ).first() ).toHaveText( target.title );
		await expectNoPhpDiagnostics( page );

		await row.getByRole( 'link', { name: 'Edit' } ).click();
		await expect( page.locator( '#soli-keyword-phrases' ) ).toHaveValue( 'harmonie\nklein orkest' );
		await page.fill( '#soli-keyword-phrases', 'bigband' );
		await page.click( '#submit' );
		await page.waitForURL( /notice=saved/ );
		await expect( row ).toHaveCount( 1 );
		await expect( row ).toContainText( 'bigband' );

		await row.getByRole( 'link', { name: 'Delete' } ).click();
		await page.waitForURL( /notice=deleted/ );
		await expect( page.locator( '#soli-keyword-linker-rules' ) ).toContainText( 'No rules yet.' );
	} );

	test( 'rejects a rule without phrases or page', async ( { page } ) => {
		await page.goto( '/wp-admin/tools.php?page=soli-keyword-linker' );
		await page.evaluate( () => document.getElementById( 'soli-keyword-phrases' ).removeAttribute( 'required' ) );
		await page.click( '#submit' );
		await page.waitForURL( /notice=invalid/ );
		await expect( page.locator( '.notice-error' ) ).toContainText( 'Enter at least one phrase' );
	} );

	test( 'delete without a nonce is refused', async ( { page } ) => {
		await addRule( page, { phrases: [ 'harmonie' ], pageId: target.id } );
		const id = await page.locator( '#soli-keyword-linker-rules tbody tr' ).getAttribute( 'data-rule-id' );
		const response = await page.goto( `/wp-admin/admin-post.php?action=soli_keyword_linker_delete&rule_id=${ id }` );
		expect( response.status() ).toBe( 403 );
		await page.goto( '/wp-admin/tools.php?page=soli-keyword-linker' );
		await expect( page.locator( '#soli-keyword-linker-rules tbody tr' ) ).toHaveCount( 1 );
	} );
} );
