/**
 * Watches the block editor and turns configured phrases into core links.
 *
 * Runs on every store change, but only touches blocks that are not being
 * typed in: rewriting the selected block's content would move the caret. As
 * soon as the writer moves to another block, the previous one is scanned.
 *
 * The writer stays in charge. When an automatic link is removed by hand, the
 * text keeps an invisible `soli/keyword-nolink` mark and is never linked
 * again. The same mark can be set or cleared from the text toolbar.
 */

import { select, dispatch, subscribe } from '@wordpress/data';
import {
	create,
	toHTMLString,
	applyFormat,
	removeFormat,
	registerFormatType,
} from '@wordpress/rich-text';
import { RichTextToolbarButton } from '@wordpress/block-editor';
import { createElement } from '@wordpress/element';
import { __ } from '@wordpress/i18n';

const LINK_FORMAT = 'core/link';
const LINK_CLASS = 'soli-keyword-link';
const NOLINK_FORMAT = 'soli/keyword-nolink';
const NOLINK_CLASS = 'soli-keyword-nolink';

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

function isKeywordLink( format ) {
	if ( format.type !== LINK_FORMAT ) {
		return false;
	}
	const className =
		( format.attributes && format.attributes.class ) ||
		( format.unregisteredAttributes && format.unregisteredAttributes.class ) ||
		'';
	return className.split( /\s+/ ).includes( LINK_CLASS );
}

/** True when any character in [start, end) carries a format matching `test`. */
function hasFormat( value, start, end, test ) {
	for ( let i = start; i < end; i++ ) {
		const formats = value.formats[ i ];
		if ( formats && formats.some( test ) ) {
			return true;
		}
	}
	return false;
}

/** Ranges [start, end) of the automatic links in a value. */
function keywordLinkRanges( value ) {
	const ranges = [];
	let start = -1;
	for ( let i = 0; i <= value.text.length; i++ ) {
		const formats = value.formats[ i ];
		const linked = !! ( formats && formats.some( isKeywordLink ) );
		if ( linked && start === -1 ) {
			start = i;
		} else if ( ! linked && start !== -1 ) {
			ranges.push( { start, end: i, text: value.text.slice( start, i ) } );
			start = -1;
		}
	}
	return ranges;
}

/**
 * Applies every matching phrase once and returns the new HTML, or null when
 * nothing changed. Text already inside any link, or marked as not-to-link,
 * is left alone.
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
		const match = matcher.regex.exec( value.text );
		if ( ! match ) {
			continue;
		}
		const start = match.index;
		const end = start + match[ 0 ].length;
		if (
			hasFormat(
				value,
				start,
				end,
				( f ) => f.type === LINK_FORMAT || f.type === NOLINK_FORMAT
			)
		) {
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

/**
 * Compares a block's content with the last version this script saw. Every
 * automatic link that was there before, whose text is still present but no
 * longer linked, gets the no-link mark so it is not linked again.
 *
 * @param {string} previousHtml
 * @param {string} html
 * @return {string|null} Updated HTML, or null when nothing was unlinked.
 */
export function markManualUnlinks( previousHtml, html ) {
	if ( ! previousHtml || previousHtml === html ) {
		return null;
	}
	const previous = create( { html: previousHtml } );
	let value = create( { html } );
	let changed = false;

	for ( const range of keywordLinkRanges( previous ) ) {
		let start = -1;
		if ( value.text.slice( range.start, range.end ) === range.text ) {
			start = range.start;
		} else {
			const first = value.text.indexOf( range.text );
			const again = first === -1 ? -1 : value.text.indexOf( range.text, first + 1 );
			if ( first !== -1 && again === -1 ) {
				start = first;
			}
		}
		if ( start === -1 ) {
			continue;
		}
		const end = start + range.text.length;
		if (
			hasFormat(
				value,
				start,
				end,
				( f ) => f.type === LINK_FORMAT || f.type === NOLINK_FORMAT
			)
		) {
			continue;
		}
		value = applyFormat( value, { type: NOLINK_FORMAT }, start, end );
		changed = true;
	}

	return changed ? toHTMLString( { value } ) : null;
}

/** Last content seen per block, to detect links removed by hand. */
const seen = new Map();

function scan() {
	const blockEditor = select( 'core/block-editor' );
	const editor = select( 'core/editor' );
	if ( ! blockEditor || ! editor ) {
		return;
	}

	const currentPostId = editor.getCurrentPostId();
	const selected = blockEditor.getSelectedBlockClientId();
	const clientIds = blockEditor.getClientIdsWithDescendants();
	const present = new Set( clientIds );
	for ( const id of seen.keys() ) {
		if ( ! present.has( id ) ) {
			seen.delete( id );
		}
	}

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

		let updated = markManualUnlinks( seen.get( clientId ), html ) ?? html;
		updated = linkPhrases( updated, currentPostId ) ?? updated;
		seen.set( clientId, updated );

		if ( updated !== html ) {
			dispatch( 'core/block-editor' ).updateBlockAttributes( clientId, {
				content: updated,
			} );
		}
	}
}

/**
 * Toolbar toggle. On an automatic link it removes the link and marks the
 * text; on marked text it clears the mark so the linker may link it again;
 * on plain text it marks the selection.
 */
function NoLinkButton( { isActive, value, onChange } ) {
	const { start, end } = value;
	const onKeywordLink =
		start !== undefined && end !== undefined && hasFormat( value, start, Math.max( end, start + 1 ), isKeywordLink );

	return createElement( RichTextToolbarButton, {
		icon: 'editor-unlink',
		title: isActive
			? __( 'Allow keyword link', 'soli-keyword-linker' )
			: __( 'No keyword link', 'soli-keyword-linker' ),
		isActive,
		onClick: () => {
			if ( isActive ) {
				onChange( removeFormat( value, NOLINK_FORMAT ) );
				return;
			}
			let next = value;
			if ( onKeywordLink ) {
				next = removeFormat( next, LINK_FORMAT );
			}
			onChange( applyFormat( next, { type: NOLINK_FORMAT } ) );
		},
	} );
}

registerFormatType( NOLINK_FORMAT, {
	title: __( 'No keyword link', 'soli-keyword-linker' ),
	tagName: 'span',
	className: NOLINK_CLASS,
	edit: NoLinkButton,
} );

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
