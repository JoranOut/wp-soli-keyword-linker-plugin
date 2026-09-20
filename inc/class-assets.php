<?php
/**
 * Enqueues the editor script that applies the links and the stylesheet that
 * styles content links, in the editor canvas as well as on the front end.
 */

namespace Soli\KeywordLinker;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Assets {

	public function __construct( private Rules $rules ) {}

	public function register(): void {
		add_action( 'enqueue_block_editor_assets', array( $this, 'enqueue_editor_script' ) );
		add_action( 'enqueue_block_assets', array( $this, 'enqueue_link_style' ) );
	}

	public function enqueue_editor_script(): void {
		$asset_file = SOLI_KEYWORD_LINKER__PLUGIN_DIR_PATH . 'build/editor.asset.php';
		if ( ! file_exists( $asset_file ) ) {
			return;
		}
		$asset = require $asset_file;

		wp_enqueue_script(
			'soli-keyword-linker-editor',
			SOLI_KEYWORD_LINKER__PLUGIN_DIR_URL . 'build/editor.js',
			$asset['dependencies'],
			$asset['version'],
			true
		);

		wp_add_inline_script(
			'soli-keyword-linker-editor',
			'window.soliKeywordLinker = ' . wp_json_encode(
				array(
					'rules' => $this->rules->for_editor(),
				)
			) . ';',
			'before'
		);
	}

	/**
	 * `enqueue_block_assets` fires on the front end and inside the editor
	 * canvas iframe, so one stylesheet covers both.
	 */
	public function enqueue_link_style(): void {
		$asset_file = SOLI_KEYWORD_LINKER__PLUGIN_DIR_PATH . 'build/links.asset.php';
		$version    = file_exists( $asset_file ) ? ( require $asset_file )['version'] : SOLI_KEYWORD_LINKER__PLUGIN_VERSION;

		wp_enqueue_style(
			'soli-keyword-linker-links',
			SOLI_KEYWORD_LINKER__PLUGIN_DIR_URL . 'build/links.css',
			array(),
			$version
		);
	}
}
