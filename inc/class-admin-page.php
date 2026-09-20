<?php
/**
 * Tools → Keyword links. Lists the rules and offers a form to add, edit and
 * delete them. Plain admin-post handlers, no REST, no JavaScript.
 */

namespace Soli\KeywordLinker;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Admin_Page {

	const SLUG       = 'soli-keyword-linker';
	const CAPABILITY = 'manage_options';

	public function __construct( private Rules $rules ) {}

	public function register(): void {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_post_soli_keyword_linker_save', array( $this, 'handle_save' ) );
		add_action( 'admin_post_soli_keyword_linker_delete', array( $this, 'handle_delete' ) );
	}

	public function add_menu(): void {
		add_management_page(
			__( 'Keyword links', 'soli-keyword-linker' ),
			__( 'Keyword links', 'soli-keyword-linker' ),
			self::CAPABILITY,
			self::SLUG,
			array( $this, 'render' )
		);
	}

	public function handle_save(): void {
		$this->authorize( 'soli_keyword_linker_save' );

		$id      = isset( $_POST['rule_id'] ) ? sanitize_key( wp_unslash( $_POST['rule_id'] ) ) : '';
		$phrases = isset( $_POST['phrases'] ) ? Rules::parse_phrases( sanitize_textarea_field( wp_unslash( $_POST['phrases'] ) ) ) : array();
		$post_id = isset( $_POST['post_id'] ) ? absint( $_POST['post_id'] ) : 0;

		if ( ! $phrases || ! $post_id || ! get_post( $post_id ) ) {
			$this->redirect( 'invalid' );
		}

		$saved = $this->rules->save( $phrases, $post_id, $id );
		$this->redirect( $saved ? 'saved' : 'invalid' );
	}

	public function handle_delete(): void {
		$this->authorize( 'soli_keyword_linker_delete' );

		$id = isset( $_REQUEST['rule_id'] ) ? sanitize_key( wp_unslash( $_REQUEST['rule_id'] ) ) : '';
		$this->redirect( $this->rules->delete( $id ) ? 'deleted' : 'invalid' );
	}

	public function render(): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to manage keyword links.', 'soli-keyword-linker' ) );
		}

		$editing = isset( $_GET['edit'] ) ? $this->rules->find( sanitize_key( wp_unslash( $_GET['edit'] ) ) ) : null; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		$notice  = isset( $_GET['notice'] ) ? sanitize_key( wp_unslash( $_GET['notice'] ) ) : ''; // phpcs:ignore WordPress.Security.NonceVerification.Recommended
		?>
		<div class="wrap soli-keyword-linker">
			<h1><?php esc_html_e( 'Keyword links', 'soli-keyword-linker' ); ?></h1>
			<p><?php esc_html_e( 'While editing a post or page, every phrase below is turned into a link to its page the first time it appears in a paragraph, heading or list item.', 'soli-keyword-linker' ); ?></p>

			<?php $this->render_notice( $notice ); ?>

			<h2><?php echo $editing ? esc_html__( 'Edit rule', 'soli-keyword-linker' ) : esc_html__( 'Add rule', 'soli-keyword-linker' ); ?></h2>
			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>">
				<input type="hidden" name="action" value="soli_keyword_linker_save" />
				<input type="hidden" name="rule_id" value="<?php echo esc_attr( $editing['id'] ?? '' ); ?>" />
				<?php wp_nonce_field( 'soli_keyword_linker_save' ); ?>
				<table class="form-table" role="presentation">
					<tr>
						<th scope="row"><label for="soli-keyword-phrases"><?php esc_html_e( 'Keywords or phrases', 'soli-keyword-linker' ); ?></label></th>
						<td>
							<textarea id="soli-keyword-phrases" name="phrases" rows="4" class="large-text" required><?php echo esc_textarea( implode( "\n", $editing['phrases'] ?? array() ) ); ?></textarea>
							<p class="description"><?php esc_html_e( 'One per line, or separated by commas. Matching ignores case and only matches whole words.', 'soli-keyword-linker' ); ?></p>
						</td>
					</tr>
					<tr>
						<th scope="row"><label for="soli-keyword-post-id"><?php esc_html_e( 'Links to page', 'soli-keyword-linker' ); ?></label></th>
						<td>
							<?php
							wp_dropdown_pages(
								array(
									'id'                => 'soli-keyword-post-id',
									'name'              => 'post_id',
									'selected'          => $editing['post_id'] ?? 0,
									'show_option_none'  => __( '— Select a page —', 'soli-keyword-linker' ),
									'option_none_value' => 0,
									'post_status'       => array( 'publish', 'private', 'draft' ),
								)
							);
							?>
						</td>
					</tr>
				</table>
				<?php submit_button( $editing ? __( 'Update rule', 'soli-keyword-linker' ) : __( 'Add rule', 'soli-keyword-linker' ) ); ?>
				<?php if ( $editing ) : ?>
					<a class="button-link" href="<?php echo esc_url( $this->page_url() ); ?>"><?php esc_html_e( 'Cancel', 'soli-keyword-linker' ); ?></a>
				<?php endif; ?>
			</form>

			<h2><?php esc_html_e( 'Rules', 'soli-keyword-linker' ); ?></h2>
			<?php $this->render_table(); ?>
		</div>
		<?php
	}

	private function render_table(): void {
		$rules = $this->rules->all();
		?>
		<table class="wp-list-table widefat fixed striped" id="soli-keyword-linker-rules">
			<thead>
				<tr>
					<th scope="col"><?php esc_html_e( 'Keywords or phrases', 'soli-keyword-linker' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Links to page', 'soli-keyword-linker' ); ?></th>
					<th scope="col"><?php esc_html_e( 'Actions', 'soli-keyword-linker' ); ?></th>
				</tr>
			</thead>
			<tbody>
			<?php if ( ! $rules ) : ?>
				<tr><td colspan="3"><?php esc_html_e( 'No rules yet.', 'soli-keyword-linker' ); ?></td></tr>
			<?php endif; ?>
			<?php foreach ( $rules as $rule ) : ?>
				<?php $post = get_post( $rule['post_id'] ); ?>
				<tr data-rule-id="<?php echo esc_attr( $rule['id'] ); ?>">
					<td><?php echo esc_html( implode( ', ', $rule['phrases'] ) ); ?></td>
					<td>
						<?php if ( $post ) : ?>
							<a href="<?php echo esc_url( get_permalink( $post ) ); ?>"><?php echo esc_html( get_the_title( $post ) ); ?></a>
							<?php if ( 'publish' !== $post->post_status ) : ?>
								<span class="description">(<?php echo esc_html( get_post_status_object( $post->post_status )->label ?? $post->post_status ); ?>, <?php esc_html_e( 'not linked until published', 'soli-keyword-linker' ); ?>)</span>
							<?php endif; ?>
						<?php else : ?>
							<em><?php esc_html_e( 'Page no longer exists', 'soli-keyword-linker' ); ?></em>
						<?php endif; ?>
					</td>
					<td>
						<a href="<?php echo esc_url( add_query_arg( 'edit', $rule['id'], $this->page_url() ) ); ?>"><?php esc_html_e( 'Edit', 'soli-keyword-linker' ); ?></a> |
						<a class="submitdelete" href="<?php echo esc_url( $this->delete_url( $rule['id'] ) ); ?>"><?php esc_html_e( 'Delete', 'soli-keyword-linker' ); ?></a>
					</td>
				</tr>
			<?php endforeach; ?>
			</tbody>
		</table>
		<?php
	}

	private function render_notice( string $notice ): void {
		$messages = array(
			'saved'   => array( 'success', __( 'Rule saved.', 'soli-keyword-linker' ) ),
			'deleted' => array( 'success', __( 'Rule deleted.', 'soli-keyword-linker' ) ),
			'invalid' => array( 'error', __( 'Enter at least one phrase and choose a page.', 'soli-keyword-linker' ) ),
		);
		if ( ! isset( $messages[ $notice ] ) ) {
			return;
		}
		[ $type, $text ] = $messages[ $notice ];
		printf( '<div class="notice notice-%s is-dismissible"><p>%s</p></div>', esc_attr( $type ), esc_html( $text ) );
	}

	private function authorize( string $action ): void {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'You are not allowed to manage keyword links.', 'soli-keyword-linker' ), '', array( 'response' => 403 ) );
		}
		check_admin_referer( $action );
	}

	private function page_url(): string {
		return admin_url( 'tools.php?page=' . self::SLUG );
	}

	private function delete_url( string $id ): string {
		return wp_nonce_url(
			admin_url( 'admin-post.php?action=soli_keyword_linker_delete&rule_id=' . rawurlencode( $id ) ),
			'soli_keyword_linker_delete'
		);
	}

	private function redirect( string $notice ): never {
		wp_safe_redirect( add_query_arg( 'notice', $notice, $this->page_url() ) );
		exit;
	}
}
