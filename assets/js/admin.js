/*
 * Halloween WT – settings screen.
 *
 * Tabs, presets, the page/post picker and the live preview. The preview
 * runs the real front-end engine inside a mock website using the
 * current (unsaved) form values.
 */

( function ( window, document ) {
	'use strict';

	const data = window.halloweenWtAdmin;
	const wp = window.wp;
	const form = document.getElementById( 'hwt-settings-form' );
	const root = document.querySelector( '.hwt-admin' );

	if ( ! data || ! form || ! root || ! wp || ! wp.i18n ) {
		return;
	}

	const { __, sprintf } = wp.i18n;
	const option = data.option;
	const STORAGE_KEY = 'halloweenWtAdminTab';

	root.classList.add( 'hwt-js' );

	const fieldName = ( path ) => option + '[' + path.join( '][' ) + ']';
	const fields = ( path ) =>
		Array.from(
			form.querySelectorAll( '[name="' + fieldName( path ) + '"]' )
		);

	const debounce = ( fn, wait ) => {
		let timer = 0;
		return ( ...args ) => {
			window.clearTimeout( timer );
			timer = window.setTimeout( () => fn( ...args ), wait );
		};
	};

	const storage = {
		get( key ) {
			try {
				return window.sessionStorage.getItem( key );
			} catch ( e ) {
				return null;
			}
		},
		set( key, value ) {
			try {
				window.sessionStorage.setItem( key, value );
			} catch ( e ) {
				// Storage is optional.
			}
		},
	};

	/* ------------------------------------------------------------------ *
	 * Tabs (WAI-ARIA tabs pattern)
	 * ------------------------------------------------------------------ */

	const tabs = Array.from( root.querySelectorAll( '.hwt-tabs__tab' ) );

	function selectTab( tab, focus ) {
		tabs.forEach( ( item ) => {
			const selected = item === tab;
			const panel = document.getElementById(
				item.getAttribute( 'aria-controls' )
			);
			item.setAttribute( 'aria-selected', selected ? 'true' : 'false' );
			item.tabIndex = selected ? 0 : -1;
			if ( panel ) {
				panel.hidden = ! selected;
			}
		} );
		if ( focus ) {
			tab.focus();
		}
		storage.set( STORAGE_KEY, tab.id );
	}

	if ( tabs.length ) {
		tabs.forEach( ( tab, index ) => {
			tab.addEventListener( 'click', () => selectTab( tab, false ) );
			tab.addEventListener( 'keydown', ( event ) => {
				let next = null;
				if ( event.key === 'ArrowRight' ) {
					next = tabs[ ( index + 1 ) % tabs.length ];
				} else if ( event.key === 'ArrowLeft' ) {
					next = tabs[ ( index - 1 + tabs.length ) % tabs.length ];
				} else if ( event.key === 'Home' ) {
					next = tabs[ 0 ];
				} else if ( event.key === 'End' ) {
					next = tabs[ tabs.length - 1 ];
				}
				if ( next ) {
					event.preventDefault();
					selectTab( next, true );
				}
			} );
		} );

		const remembered = document.getElementById(
			storage.get( STORAGE_KEY ) || ''
		);
		selectTab(
			tabs.includes( remembered ) ? remembered : tabs[ 0 ],
			false
		);
	}

	/* ------------------------------------------------------------------ *
	 * Range outputs, effect cards and conditional sections
	 * ------------------------------------------------------------------ */

	function updateOutput( input ) {
		const output = input.parentNode.querySelector( 'output' );
		if ( output ) {
			output.textContent = input.value + ( input.dataset.unit || '' );
		}
	}

	function refreshCards() {
		root.querySelectorAll( '.hwt-effect' ).forEach( ( card ) => {
			const toggle = card.querySelector(
				'.hwt-effect__toggle input[type="checkbox"]'
			);
			card.classList.toggle( 'is-off', !! toggle && ! toggle.checked );
		} );
	}

	function refreshConditionals() {
		root.querySelectorAll( '[data-hwt-show-when]' ).forEach(
			( section ) => {
				const path = section.dataset.hwtShowWhen.split( '-' );
				const checked = fields( path ).find(
					( input ) => input.checked
				);
				section.hidden =
					! checked || checked.value !== section.dataset.hwtValue;
			}
		);
	}

	refreshCards();
	refreshConditionals();

	/* ------------------------------------------------------------------ *
	 * Presets
	 * ------------------------------------------------------------------ */

	let applyingPreset = false;

	function setField( path, value ) {
		fields( path ).forEach( ( input ) => {
			if ( input.type === 'checkbox' ) {
				input.checked = !! value;
			} else if ( input.type === 'radio' ) {
				input.checked = input.value === String( value );
			} else {
				input.value = String( value );
				if ( input.type === 'range' ) {
					updateOutput( input );
				}
			}
		} );
	}

	function applyPreset( name ) {
		const preset = data.presets && data.presets[ name ];
		if ( ! preset ) {
			return;
		}
		applyingPreset = true;
		Object.keys( preset.effects || {} ).forEach( ( effect ) => {
			Object.keys( preset.effects[ effect ] ).forEach( ( field ) => {
				setField(
					[ 'effects', effect, field ],
					preset.effects[ effect ][ field ]
				);
			} );
		} );
		Object.keys( preset.interactive || {} ).forEach( ( field ) => {
			setField( [ 'interactive', field ], preset.interactive[ field ] );
		} );
		applyingPreset = false;
		refreshCards();
	}

	function markCustom( target ) {
		if ( applyingPreset || ! target.name ) {
			return;
		}
		const tuning =
			target.name.indexOf( option + '[effects]' ) === 0 ||
			target.name === fieldName( [ 'interactive', 'intensity' ] );
		if ( tuning ) {
			setField( [ 'general', 'preset' ], 'custom' );
		}
	}

	/* ------------------------------------------------------------------ *
	 * Page / post picker (core REST search endpoint)
	 * ------------------------------------------------------------------ */

	const decode = ( html ) => {
		const doc = new window.DOMParser().parseFromString(
			String( html ),
			'text/html'
		);
		return doc.documentElement.textContent || '';
	};

	function initPicker( picker ) {
		const search = picker.querySelector( '.hwt-picker__search' );
		const list = picker.querySelector( '.hwt-picker__list' );
		const results = picker.querySelector( '.hwt-picker__results' );
		const name = picker.dataset.name;
		let options = [];
		let active = -1;
		let request = 0;

		const selectedIds = () =>
			Array.from( list.querySelectorAll( 'input[type="hidden"]' ) ).map(
				( input ) => Number( input.value )
			);

		const close = () => {
			results.hidden = true;
			results.textContent = '';
			search.setAttribute( 'aria-expanded', 'false' );
			search.removeAttribute( 'aria-activedescendant' );
			options = [];
			active = -1;
		};

		const highlight = ( index ) => {
			const items = results.querySelectorAll( '[role="option"]' );
			items.forEach( ( item, i ) => {
				item.classList.toggle( 'is-active', i === index );
				item.setAttribute(
					'aria-selected',
					i === index ? 'true' : 'false'
				);
			} );
			active = index;
			if ( items[ index ] ) {
				search.setAttribute(
					'aria-activedescendant',
					items[ index ].id
				);
			}
		};

		const add = ( choice ) => {
			if ( selectedIds().includes( choice.id ) ) {
				return;
			}
			const item = document.createElement( 'li' );
			item.className = 'hwt-picker__item';

			const input = document.createElement( 'input' );
			input.type = 'hidden';
			input.name = name;
			input.value = String( choice.id );

			const title = document.createElement( 'span' );
			title.className = 'hwt-picker__title';
			title.textContent = choice.title;

			const remove = document.createElement( 'button' );
			remove.type = 'button';
			remove.className = 'hwt-picker__remove button-link';
			remove.setAttribute(
				'aria-label',
				/* translators: %s: page or post title. */
				sprintf( __( 'Remove %s', 'halloween-wt' ), choice.title )
			);
			remove.textContent = '×';

			item.append( input, title, remove );
			list.appendChild( item );
			search.value = '';
			close();
		};

		const render = ( items ) => {
			results.textContent = '';
			const taken = selectedIds();
			options = items
				.filter( ( item ) => ! taken.includes( Number( item.id ) ) )
				.map( ( item ) => ( {
					id: Number( item.id ),
					title:
						decode( item.title ) ||
						sprintf(
							/* translators: %d: post ID. */
							__( '#%d (no title)', 'halloween-wt' ),
							Number( item.id )
						),
					subtype: item.subtype,
				} ) );

			if ( ! options.length ) {
				const empty = document.createElement( 'li' );
				empty.className = 'hwt-picker__empty';
				empty.textContent = __(
					'No matching content found.',
					'halloween-wt'
				);
				results.appendChild( empty );
			}

			options.forEach( ( choice, index ) => {
				const item = document.createElement( 'li' );
				item.id = search.id + '-option-' + index;
				item.setAttribute( 'role', 'option' );
				item.setAttribute( 'aria-selected', 'false' );
				item.textContent = choice.title;
				if (
					picker.dataset.subtype.indexOf( ',' ) !== -1 &&
					choice.subtype
				) {
					const type = document.createElement( 'span' );
					type.className = 'hwt-picker__type';
					type.textContent = choice.subtype;
					item.appendChild( type );
				}
				item.addEventListener( 'mousedown', ( event ) => {
					event.preventDefault();
					add( choice );
					schedulePreview();
				} );
				results.appendChild( item );
			} );

			results.hidden = false;
			search.setAttribute( 'aria-expanded', 'true' );
			active = -1;
		};

		const run = debounce( () => {
			const term = search.value.trim();
			if ( term.length < 2 ) {
				close();
				return;
			}
			const id = ++request;
			const params = new window.URLSearchParams( {
				search: term,
				type: 'post',
				subtype: picker.dataset.subtype,
				per_page: '10',
				_fields: 'id,title,subtype',
			} );
			wp.apiFetch( { path: '/wp/v2/search?' + params.toString() } )
				.then( ( items ) => {
					if ( id === request ) {
						render( Array.isArray( items ) ? items : [] );
					}
				} )
				.catch( () => {
					if ( id === request ) {
						render( [] );
					}
				} );
		}, 250 );

		search.addEventListener( 'input', run );
		search.addEventListener( 'blur', () =>
			window.setTimeout( close, 150 )
		);
		search.addEventListener( 'keydown', ( event ) => {
			if ( event.key === 'ArrowDown' && options.length ) {
				event.preventDefault();
				highlight( ( active + 1 ) % options.length );
			} else if ( event.key === 'ArrowUp' && options.length ) {
				event.preventDefault();
				highlight( ( active - 1 + options.length ) % options.length );
			} else if ( event.key === 'Enter' ) {
				// Never submit the settings form from the search box.
				event.preventDefault();
				if ( options[ active ] ) {
					add( options[ active ] );
					schedulePreview();
				}
			} else if ( event.key === 'Escape' ) {
				close();
			}
		} );

		list.addEventListener( 'click', ( event ) => {
			const button = event.target.closest( '.hwt-picker__remove' );
			if ( button ) {
				button.closest( 'li' ).remove();
				search.focus();
			}
		} );
	}

	if ( wp.apiFetch ) {
		root.querySelectorAll( '.hwt-picker' ).forEach( initPicker );
	}

	/* ------------------------------------------------------------------ *
	 * Live preview
	 * ------------------------------------------------------------------ */

	const HWT = window.HalloweenWT;
	const stage = document.getElementById( 'hwt-preview-stage' );
	const note = root.querySelector( '.hwt-preview__note' );
	const pauseButton = root.querySelector( '.hwt-preview__pause' );
	let controller = null;
	let device = 'desktop';
	let paused = false;

	function readSettings() {
		const out = {};
		const prefix = option + '[';

		Array.from( form.elements ).forEach( ( el ) => {
			if ( ! el.name || el.name.indexOf( prefix ) !== 0 ) {
				return;
			}
			const isList = el.name.slice( -2 ) === '[]';
			const keys = (
				el.name
					.slice( option.length )
					.replace( /\[\]$/, '' )
					.match( /\[[^\]]*\]/g ) || []
			).map( ( part ) => part.slice( 1, -1 ) );
			if ( ! keys.length ) {
				return;
			}
			let node = out;
			for ( let i = 0; i < keys.length - 1; i++ ) {
				node[ keys[ i ] ] = node[ keys[ i ] ] || {};
				node = node[ keys[ i ] ];
			}
			const key = keys[ keys.length - 1 ];

			if ( el.type === 'checkbox' ) {
				node[ key ] = el.checked;
			} else if ( el.type === 'radio' ) {
				if ( el.checked ) {
					node[ key ] = el.value;
				}
			} else if ( isList ) {
				node[ key ] = node[ key ] || [];
				node[ key ].push( el.value );
			} else if ( el.type === 'range' || el.type === 'number' ) {
				node[ key ] = Number( el.value );
			} else {
				node[ key ] = el.value;
			}
		} );

		return out;
	}

	function setNote( messages ) {
		if ( note ) {
			note.textContent = messages.join( ' ' );
		}
	}

	function rebuildPreview() {
		if ( ! stage || ! HWT || ! HWT.boot ) {
			return;
		}

		if ( controller ) {
			controller.destroy();
			controller = null;
		}

		const s = readSettings();
		const mobile = device === 'mobile';
		const messages = [];
		const config = {
			assetsUrl: data.assetsUrl,
			zIndex: 0,
			reducedMotion: !! ( s.accessibility || {} ).reduced_motion,
			effects: s.effects || {},
			interactive: s.interactive || {},
			mobile: s.mobile || {},
			preview: true,
		};

		stage.classList.toggle( 'is-mobile', mobile );

		if ( ! ( s.general || {} ).enabled ) {
			messages.push(
				__(
					'Effects are switched off for visitors; the preview still shows them.',
					'halloween-wt'
				)
			);
		}

		if ( mobile && ! config.mobile.enabled ) {
			messages.push(
				__(
					'Effects are turned off for mobile visitors.',
					'halloween-wt'
				)
			);
			setNote( messages );
			return;
		}

		const reduced = HWT.prefersReducedMotion( config );
		if ( reduced ) {
			messages.push(
				__(
					'Your device asks for reduced motion, so the preview shows the calm, static version.',
					'halloween-wt'
				)
			);
		}

		setNote( messages );
		controller = HWT.boot( config, { mount: stage, mobile, reduced } );
		if ( controller && paused ) {
			controller.setPaused( true );
		}
	}

	const schedulePreview = debounce( rebuildPreview, 300 );

	root.querySelectorAll( '[data-hwt-device]' ).forEach( ( button ) => {
		button.addEventListener( 'click', () => {
			device = button.dataset.hwtDevice;
			root.querySelectorAll( '[data-hwt-device]' ).forEach( ( other ) => {
				const on = other === button;
				other.classList.toggle( 'is-active', on );
				other.setAttribute( 'aria-pressed', on ? 'true' : 'false' );
			} );
			rebuildPreview();
		} );
	} );

	if ( pauseButton ) {
		pauseButton.addEventListener( 'click', () => {
			paused = ! paused;
			pauseButton.setAttribute(
				'aria-pressed',
				paused ? 'true' : 'false'
			);
			pauseButton.textContent = paused
				? __( 'Play', 'halloween-wt' )
				: __( 'Pause', 'halloween-wt' );
			if ( controller ) {
				controller.setPaused( paused );
			}
		} );
	}

	const mockButton = root.querySelector( '.hwt-mock__button' );
	const mockResult = root.querySelector( '.hwt-mock__result' );
	let clicks = 0;
	if ( mockButton && mockResult ) {
		mockButton.addEventListener( 'click', () => {
			clicks++;
			mockResult.textContent = sprintf(
				/* translators: %d: number of clicks. */
				__(
					'Clicked %d× – effects never block your site.',
					'halloween-wt'
				),
				clicks
			);
		} );
	}

	/* ------------------------------------------------------------------ *
	 * Form events
	 * ------------------------------------------------------------------ */

	form.addEventListener( 'input', ( event ) => {
		const target = event.target;
		if ( target.type === 'range' ) {
			updateOutput( target );
		}
		if ( target.classList.contains( 'hwt-picker__search' ) ) {
			return;
		}
		markCustom( target );
		schedulePreview();
	} );

	form.addEventListener( 'change', ( event ) => {
		const target = event.target;
		if ( target.classList.contains( 'hwt-picker__search' ) ) {
			return;
		}
		if ( target.name === fieldName( [ 'general', 'preset' ] ) ) {
			applyPreset( target.value );
		} else {
			markCustom( target );
		}
		refreshCards();
		refreshConditionals();
		schedulePreview();
	} );

	const reset = root.querySelector( '.hwt-reset' );
	if ( reset ) {
		reset.addEventListener( 'submit', ( event ) => {
			// eslint-disable-next-line no-alert
			if ( ! window.confirm( reset.dataset.confirm ) ) {
				event.preventDefault();
			}
		} );
	}

	rebuildPreview();
} )( window, document );
