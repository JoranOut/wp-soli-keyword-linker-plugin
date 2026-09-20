<?php
/**
 * Plugin Name: Soli Keyword Linker
 * Description: Turns configured keywords and phrases into links to a chosen page while editing, and gives content links a thick red underline.
 * Version: 0.1.0
 * Author: Joran Out
 * License: GPL-2.0-or-later
 * Text Domain: soli-keyword-linker
 * Domain Path: /languages
 * Requires at least: 6.9
 * Requires PHP: 8.1
 */

namespace Soli\KeywordLinker;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

define( 'SOLI_KEYWORD_LINKER__PLUGIN_VERSION', "0.1.0" );
define( 'SOLI_KEYWORD_LINKER__PLUGIN_FILE', __FILE__ );
define( 'SOLI_KEYWORD_LINKER__PLUGIN_DIR_PATH', plugin_dir_path( __FILE__ ) );
define( 'SOLI_KEYWORD_LINKER__PLUGIN_DIR_URL', plugin_dir_url( __FILE__ ) );

require_once __DIR__ . '/inc/class-rules.php';
require_once __DIR__ . '/inc/class-admin-page.php';
require_once __DIR__ . '/inc/class-assets.php';

add_action( 'init', function () {
	load_plugin_textdomain( 'soli-keyword-linker', false, dirname( plugin_basename( __FILE__ ) ) . '/languages' );
} );

( new Admin_Page( new Rules() ) )->register();
( new Assets( new Rules() ) )->register();

add_action( 'init', function () {
	require_once __DIR__ . '/updater.php';

	if ( ! defined( 'WP_GITHUB_FORCE_UPDATE' ) ) {
		define( 'WP_GITHUB_FORCE_UPDATE', true );
	}

	if ( ! is_admin() ) {
		return;
	}

	$config = array(
		'slug'               => plugin_basename( __FILE__ ),
		'proper_folder_name' => dirname( plugin_basename( __FILE__ ) ),
		'api_url'            => 'https://api.github.com/repos/JoranOut/wp-soli-keyword-linker-plugin',
		'raw_url'            => 'https://raw.githubusercontent.com/JoranOut/wp-soli-keyword-linker-plugin/main',
		'github_url'         => 'https://github.com/JoranOut/wp-soli-keyword-linker-plugin',
		// Fallback only. The updater resolves the real download from the GitHub
		// releases API and overrides this with the release's zip asset.
		'zip_url'            => 'https://github.com/JoranOut/wp-soli-keyword-linker-plugin/releases/latest/download/wp-soli-keyword-linker-plugin.zip',
		'sslverify'          => true,
		'requires'           => '6.9', // oldest branch the e2e suite covers; see package.json wordpress.requiresAtLeast
		// Rewritten at packaging time by the nightly and release workflows to the
		// WordPress version the e2e suite actually ran against. Do not reformat.
		'tested'             => '7.0.4',
		'readme'             => 'README.md',
	);

	new WP_GitHub_Updater( $config );
} );
