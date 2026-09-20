/**
 * Watches the block editor and turns configured phrases into core links.
 *
 * Runs on every store change, but only touches blocks whose content actually
 * changed and never the block that is being typed in: rewriting the selected
 * block's content would move the caret. As soon as the writer moves to another
 * block, the previous one is scanned and linked.
 */

import { select, dispatch, subscribe } from '@wordpress/data';
import { create, toHTMLString, applyFormat } from '@wordpress/rich-text';

const LINK_FORMAT = 'core/link';
const LINK_CLASS = 'soli-keyword-link';

/** Blocks whose `content` attribute is rich text we may link in. */
const SUPPORTED_BLOCKS = new Set( [
	'core/paragraph',
	'core/heading',
	'core/list-item',
] );

const rules = ( window.soliKeywordLinker && window.soliKeywordLinker.rules ) || [];

/**
 * One matcher per phrase, longest phrase first so that "Klein Orkest" is
 * linked before "Orkest" gets a chance to claim part of it.
 */
const matchers = rules
	.flatMap( ( rule ) =>
		rule.phrases.map( ( phrase ) => ( {
			phrase,
			url: rule.url,
			postId: rule.postId,
			regex: new RegExp(
				'(?<![\\p{L}\\p{N}])' + escapeRegExp( phrase ) + '(?![\\p{L}\\p{N}])',
				'iu'
			),
		} ) )
	)
	.sort( ( a, b ) => b.phrase.length - a.phrase.length );

function escapeRegExp( text ) {
	return text.replace( /[.*+?^${}()|[\]\\]/g, '\\$&' );
}

function toHtml( content ) {
	if ( content === undefined || content === null ) {
		return '';
	}
	return typeof content === 'string' ? content : content.toHTMLString();
}

function hasLink( value, start, end ) {
	for ( let i = start; i < end; i++ ) {
		const formats = value.formats[ i ];
		if ( formats && formats.some( ( f ) => f.type === LINK_FORMAT ) ) {
			return true;
		}
	}
	return false;
}

/**
 * Applies every matching phrase once and returns the new HTML, or null when
 * nothing changed.
 *
 * @param {string} html          Block content.
 * @param {number} currentPostId Post being edited, so a page never links to itself.
 * @return {string|null} Updated HTML.
 */
export function linkPhrases( html, currentPostId ) {
	let value = create( { html } );
	let changed = false;

	for ( const matcher of matchers ) {
		if ( matcher.postId === currentPostId ) {
			continue;
		}
		matcher.regex.lastIndex = 0;
		const match = matcher.regex.exec( value.text );
		if ( ! match ) {
			continue;
		}
		const start = match.index;
		const end = start + match[ 0 ].length;
		if ( hasLink( value, start, end ) ) {
			continue;
		}
		value = applyFormat(
			value,
			{
				type: LINK_FORMAT,
				attributes: {
					url: matcher.url,
					type: 'page',
					id: String( matcher.postId ),
					class: LINK_CLASS,
				},
			},
			start,
			end
		);
		changed = true;
	}

	return changed ? toHTMLString( { value } ) : null;
}

function scan() {
	const blockEditor = select( 'core/block-editor' );
	const editor = select( 'core/editor' );
	if ( ! blockEditor || ! editor ) {
		return;
	}

	const currentPostId = editor.getCurrentPostId();
	const selected = blockEditor.getSelectedBlockClientId();
	const clientIds = blockEditor.getClientIdsWithDescendants();

	for ( const clientId of clientIds ) {
		if ( clientId === selected ) {
			continue;
		}
		const block = blockEditor.getBlock( clientId );
		if ( ! block || ! SUPPORTED_BLOCKS.has( block.name ) ) {
			continue;
		}
		const html = toHtml( block.attributes.content );
		if ( ! html ) {
			continue;
		}
		const updated = linkPhrases( html, currentPostId );
		if ( updated !== null && updated !== html ) {
			dispatch( 'core/block-editor' ).updateBlockAttributes( clientId, {
				content: updated,
			} );
		}
	}
}

if ( matchers.length ) {
	let lastBlocks;
	let lastSelected;
	subscribe( () => {
		const blockEditor = select( 'core/block-editor' );
		if ( ! blockEditor ) {
			return;
		}
		const blocks = blockEditor.getBlocks();
		const selected = blockEditor.getSelectedBlockClientId();
		if ( blocks === lastBlocks && selected === lastSelected ) {
			return;
		}
		lastBlocks = blocks;
		lastSelected = selected;
		scan();
	}, 'core/block-editor' );
}
