<?php
/**
 * Storage for keyword rules.
 *
 * A rule is one target page plus one or more phrases that should link to it.
 * Rules live in a single option, which keeps the plugin free of custom tables.
 */

namespace Soli\KeywordLinker;

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

class Rules {

	const OPTION = 'soli_keyword_linker_rules';

	/**
	 * @return array<int, array{id: string, phrases: string[], post_id: int}>
	 */
	public function all(): array {
		$stored = get_option( self::OPTION, array() );
		if ( ! is_array( $stored ) ) {
			return array();
		}

		$rules = array();
		foreach ( $stored as $rule ) {
			$normalized = $this->normalize( $rule );
			if ( $normalized ) {
				$rules[] = $normalized;
			}
		}

		return $rules;
	}

	public function find( string $id ): ?array {
		foreach ( $this->all() as $rule ) {
			if ( $rule['id'] === $id ) {
				return $rule;
			}
		}

		return null;
	}

	/**
	 * Adds a rule, or replaces the one with the same id.
	 *
	 * @param string[] $phrases
	 * @return array|null The saved rule, or null when nothing valid was given.
	 */
	public function save( array $phrases, int $post_id, string $id = '' ): ?array {
		$rule = $this->normalize(
			array(
				'id'      => $id ?: wp_generate_uuid4(),
				'phrases' => $phrases,
				'post_id' => $post_id,
			)
		);
		if ( ! $rule ) {
			return null;
		}

		$rules    = $this->all();
		$replaced = false;
		foreach ( $rules as $index => $existing ) {
			if ( $existing['id'] === $rule['id'] ) {
				$rules[ $index ] = $rule;
				$replaced        = true;
			}
		}
		if ( ! $replaced ) {
			$rules[] = $rule;
		}

		update_option( self::OPTION, array_values( $rules ), false );

		return $rule;
	}

	public function delete( string $id ): bool {
		$rules   = $this->all();
		$deleted = array_filter( $rules, fn( $rule ) => $rule['id'] !== $id );
		if ( count( $deleted ) === count( $rules ) ) {
			return false;
		}

		update_option( self::OPTION, array_values( $deleted ), false );

		return true;
	}

	/**
	 * Rules as the editor script needs them: resolved URL and title, published
	 * targets only, longest phrases first so "Klein Orkest" wins over "Orkest".
	 *
	 * @return array<int, array{phrases: string[], postId: int, url: string, title: string}>
	 */
	public function for_editor(): array {
		$rules = array();
		foreach ( $this->all() as $rule ) {
			$post = get_post( $rule['post_id'] );
			if ( ! $post || 'publish' !== $post->post_status ) {
				continue;
			}

			$rules[] = array(
				'phrases' => $rule['phrases'],
				'postId'  => $rule['post_id'],
				'url'     => get_permalink( $post ),
				'title'   => get_the_title( $post ),
			);
		}

		return $rules;
	}

	/**
	 * Splits a textarea value into phrases: one per line or comma separated.
	 *
	 * @return string[]
	 */
	public static function parse_phrases( string $input ): array {
		$parts = preg_split( '/[\n,]+/', $input ) ?: array();

		return array_values( array_filter( array_map( 'trim', $parts ) ) );
	}

	private function normalize( $rule ): ?array {
		if ( ! is_array( $rule ) ) {
			return null;
		}

		$post_id = isset( $rule['post_id'] ) ? absint( $rule['post_id'] ) : 0;
		$phrases = isset( $rule['phrases'] ) && is_array( $rule['phrases'] ) ? $rule['phrases'] : array();
		$phrases = array_map( fn( $p ) => sanitize_text_field( (string) $p ), $phrases );
		$phrases = array_values( array_unique( array_filter( array_map( 'trim', $phrases ) ) ) );
		$id      = isset( $rule['id'] ) ? sanitize_key( (string) $rule['id'] ) : '';

		if ( ! $post_id || ! $phrases || ! $id ) {
			return null;
		}

		return array(
			'id'      => $id,
			'phrases' => $phrases,
			'post_id' => $post_id,
		);
	}
}
