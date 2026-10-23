/*
 * Halloween WT – Halloween effect pack.
 *
 * Maps the plugin settings onto the generic engine primitives and hero
 * behaviours, then boots the engine once the page has finished loading.
 */

( function ( window, document ) {
	'use strict';

	const HWT = window.HalloweenWT;

	if ( ! HWT || ! HWT.Engine || HWT.boot ) {
		return;
	}

	const { clamp } = HWT.util;

	/** Sprite files, relative to the plugin's images directory. */
	const SPRITES = {
		pumpkinJack: 'pumpkin-jack.svg',
		pumpkinPlain: 'pumpkin-plain.svg',
		ghost: 'ghost.svg',
		batUp: 'bat-up.svg',
		batDown: 'bat-down.svg',
		spider: 'spider.svg',
		web: 'web-corner.svg',
		skull: 'skull.svg',
		leafMaple: 'leaf-maple.svg',
		leafOak: 'leaf-oak.svg',
		leafElm: 'leaf-elm.svg',
	};

	/** Raster size (px) of each sprite's cached bitmap. */
	const RASTER = { web: 640 };

	/** Canvas draw order, back to front. */
	const ORDER = [
		'darkness',
		'clouds',
		'webs',
		'ghosts',
		'bats',
		'spiders',
		'leaves',
		'pumpkins',
		'skulls',
		'eyes',
		'rain',
		'particles',
		'fog',
		'lightning',
	];

	/** Effects drawn as cheap lines/glows, kept out of the sprite budget. */
	const UNBUDGETED = [ 'rain', 'eyes' ];

	/** Effects kept for visitors who prefer reduced motion (all static). */
	const CALM = [ 'darkness', 'webs', 'fog' ];

	/** Sprites each effect needs. */
	const NEEDS = {
		pumpkins: [ 'pumpkinJack', 'pumpkinPlain' ],
		bats: [ 'batUp', 'batDown' ],
		ghosts: [ 'ghost' ],
		spiders: [ 'spider' ],
		webs: [ 'web' ],
		skulls: [ 'skull' ],
		leaves: [ 'leafMaple', 'leafOak', 'leafElm' ],
	};

	const PHYSICS = {
		subtle: { maxThrow: 1100, restitution: 0.25, spin: 0.6, flee: 0.8 },
		normal: { maxThrow: 1800, restitution: 0.4, spin: 1, flee: 1 },
		playful: { maxThrow: 2800, restitution: 0.55, spin: 1.5, flee: 1.25 },
	};

	const LIGHTNING_GAPS = {
		rare: [ 40, 90 ],
		occasional: [ 20, 45 ],
		frequent: [ 10, 25 ],
	};

	const MOBILE_DENSITY = { low: 0.6, medium: 0.8, high: 1 };

	/** Hard ceilings that no preset or setting can exceed. */
	const LIMITS = {
		desktop: { sprites: 260, heroes: 8, rain: 320 },
		mobile: { sprites: 110, heroes: 3, rain: 120 },
	};

	const HERO_ORDER = [ 'pumpkins', 'ghosts', 'spiders', 'bats' ];

	const num = ( value, fallback ) => {
		const n = Number( value );
		return Number.isFinite( n ) ? n : fallback;
	};

	const hexToRgb = ( hex ) => {
		const match = /^#?([0-9a-f]{6})$/i.exec( String( hex || '' ) );
		if ( ! match ) {
			return '205,200,220';
		}
		const digits = match[ 1 ];
		return [ 0, 2, 4 ]
			.map( ( i ) => parseInt( digits.slice( i, i + 2 ), 16 ) )
			.join( ',' );
	};

	const range = ( base, factor ) => [
		base[ 0 ] * factor,
		base[ 1 ] * factor,
	];

	/**
	 * Whether the current viewport should be treated as mobile.
	 *
	 * @return {boolean} True on phones and touch tablets.
	 */
	HWT.isMobileViewport = function () {
		const mq = ( query ) =>
			window.matchMedia ? window.matchMedia( query ).matches : false;
		return (
			mq( '(max-width: 767px)' ) ||
			mq( '(pointer: coarse) and (max-width: 1024px)' )
		);
	};

	/**
	 * Whether the visitor asked for reduced motion and the site respects it.
	 *
	 * @param {Object} config Plugin config.
	 * @return {boolean} True when motion should be reduced.
	 */
	HWT.prefersReducedMotion = function ( config ) {
		return (
			!! config.reducedMotion &&
			!! window.matchMedia &&
			window.matchMedia( '(prefers-reduced-motion: reduce)' ).matches
		);
	};

	/**
	 * Builds and starts an engine for the given configuration.
	 *
	 * @param {Object}      config        Settings in the shape produced by PHP.
	 * @param {Object}      [env]         Runtime environment.
	 * @param {HTMLElement} [env.mount]   Preview container.
	 * @param {boolean}     [env.mobile]  Use mobile limits.
	 * @param {boolean}     [env.reduced] Reduced motion (static scene).
	 * @return {Object|null} Controller with destroy() and setPaused().
	 */
	HWT.boot = function ( config, env ) {
		env = env || {};

		const controller = {
			engine: null,
			destroyed: false,
			paused: false,
			destroy() {
				this.destroyed = true;
				if ( this.engine ) {
					this.engine.destroy();
					this.engine = null;
				}
			},
			setPaused( paused ) {
				this.paused = !! paused;
				if ( this.engine ) {
					this.engine.setPaused( this.paused );
				}
			},
		};

		try {
			const plan = buildPlan( config, env );

			if ( ! plan.effects.length && ! plan.heroes.length ) {
				return null;
			}

			loadPlanSprites( config, plan ).then( ( sprites ) => {
				if ( controller.destroyed ) {
					return;
				}
				try {
					const engine = createEngine( config, env, plan, sprites );
					controller.engine = engine;
					engine.start();
					if ( controller.paused ) {
						engine.setPaused( true );
					}
				} catch ( e ) {
					controller.destroy();
				}
			} );
		} catch ( e ) {
			return null;
		}

		return controller;
	};

	/**
	 * Converts settings into a list of effects and heroes with final counts.
	 *
	 * @param {Object} config Settings.
	 * @param {Object} env    Environment.
	 * @return {Object} Plan.
	 */
	function buildPlan( config, env ) {
		const fx = config.effects || {};
		const mobile = !! env.mobile;
		const reduced = !! env.reduced;
		const limits = mobile ? LIMITS.mobile : LIMITS.desktop;

		let area = window.innerWidth * window.innerHeight;
		if ( env.mount ) {
			const rect = env.mount.getBoundingClientRect();
			area = rect.width * rect.height;
		}
		const areaFactor = clamp(
			Math.sqrt( area / ( 1440 * 900 ) ),
			0.5,
			1.2
		);
		const density = mobile
			? MOBILE_DENSITY[ ( config.mobile || {} ).density ] || 0.6
			: 1;

		const on = ( key ) => !! ( fx[ key ] && fx[ key ].enabled );
		const count = ( key ) =>
			Math.max(
				0,
				Math.round(
					num( fx[ key ].quantity, 0 ) * areaFactor * density
				)
			);

		const effects = [];

		ORDER.forEach( ( key ) => {
			if ( ! on( key ) ) {
				return;
			}
			// Reduced motion keeps only calm, static decoration.
			if ( reduced && ! CALM.includes( key ) ) {
				return;
			}
			const item = { key, count: 0 };
			if ( 'quantity' in fx[ key ] ) {
				item.count = count( key );
				if ( ! item.count ) {
					return;
				}
			}
			effects.push( item );
		} );

		// Keep the total number of canvas sprites within a hard budget.
		const budgeted = effects.filter(
			( item ) => ! UNBUDGETED.includes( item.key )
		);
		const total = budgeted.reduce( ( sum, item ) => sum + item.count, 0 );
		if ( total > limits.sprites ) {
			const scale = limits.sprites / total;
			budgeted.forEach( ( item ) => {
				item.count = Math.max( 1, Math.floor( item.count * scale ) );
			} );
		}
		effects.forEach( ( item ) => {
			if ( item.key === 'rain' ) {
				item.count = Math.min( item.count, limits.rain );
			} else if ( item.key === 'eyes' ) {
				item.count = Math.min( item.count, 6 );
			}
		} );

		// Interactive heroes are taken from the matching effect's budget.
		const heroes = [];
		const ia = config.interactive || {};
		const pointerOk = 'PointerEvent' in window;
		const allowed =
			! reduced &&
			pointerOk &&
			!! ia.enabled &&
			( ! mobile || !! ( config.mobile || {} ).interactive );

		if ( allowed ) {
			const max = Math.min( num( ia.max_objects, 4 ), limits.heroes );
			const pools = HERO_ORDER.filter( ( key ) => ia[ key ] )
				.map( ( key ) => effects.find( ( item ) => item.key === key ) )
				.filter( Boolean );

			let added = true;
			while ( heroes.length < max && added ) {
				added = false;
				for (
					let i = 0;
					i < pools.length && heroes.length < max;
					i++
				) {
					const pool = pools[ i ];
					const taken = heroes.filter(
						( k ) => k === pool.key
					).length;
					if ( pool.count > 0 && taken < 3 ) {
						pool.count--;
						heroes.push( pool.key );
						added = true;
					}
				}
			}
		}

		return {
			effects: effects.filter(
				( item ) => item.count > 0 || ! ( 'quantity' in fx[ item.key ] )
			),
			heroes,
			mobile,
			reduced,
		};
	}

	/**
	 * Loads only the sprites required by the plan.
	 *
	 * @param {Object} config Settings.
	 * @param {Object} plan   Plan.
	 * @return {Promise<Object>} Map of sprite name to sprite (or null).
	 */
	function loadPlanSprites( config, plan ) {
		const names = new Set();
		plan.effects.forEach( ( item ) =>
			( NEEDS[ item.key ] || [] ).forEach( ( name ) => names.add( name ) )
		);
		plan.heroes.forEach( ( key ) =>
			( NEEDS[ key ] || [] ).forEach( ( name ) => names.add( name ) )
		);

		const base = String( config.assetsUrl || '' );
		const list = Array.from( names );

		return Promise.all(
			list.map( ( name ) =>
				HWT.loadSprite( base + SPRITES[ name ], RASTER[ name ] || 192 )
			)
		).then( ( loaded ) => {
			const map = {};
			list.forEach( ( name, index ) => {
				map[ name ] = loaded[ index ];
			} );
			return map;
		} );
	}

	/**
	 * Instantiates the engine with effects and heroes.
	 *
	 * @param {Object} config  Settings.
	 * @param {Object} env     Environment.
	 * @param {Object} plan    Plan.
	 * @param {Object} sprites Loaded sprites.
	 * @return {Object} Engine.
	 */
	function createEngine( config, env, plan, sprites ) {
		const fx = config.effects || {};
		const ia = config.interactive || {};
		const mobileScale = plan.mobile ? 0.8 : 1;
		const pct = ( value, fallback ) => num( value, fallback ) / 100;
		const sizeOf = ( key ) => pct( fx[ key ].size, 100 ) * mobileScale;
		const speedOf = ( key ) => pct( fx[ key ].speed, 100 );
		const opacityOf = ( key ) =>
			clamp( pct( fx[ key ].opacity, 100 ), 0.05, 1 );
		const list = ( names ) =>
			names.map( ( name ) => sprites[ name ] ).filter( Boolean );
		const thread = 'rgba(128,124,142,0.9)';

		const engine = new HWT.Engine( {
			mount: env.mount || null,
			zIndex: env.mount ? 0 : num( config.zIndex, 9990 ),
			isStatic: plan.reduced,
			maxDpr: plan.mobile ? 1.25 : 1.5,
			physics: PHYSICS[ ia.intensity ] || PHYSICS.normal,
		} );

		plan.effects.forEach( ( item ) => {
			const key = item.key;
			const n = item.count;

			switch ( key ) {
				case 'pumpkins': {
					const set = list( [
						'pumpkinJack',
						'pumpkinPlain',
						'pumpkinJack',
					] );
					if ( set.length ) {
						engine.addEffect( 'fallers', {
							sprites: set,
							count: n,
							size: range( [ 34, 60 ], sizeOf( key ) ),
							speed: range( [ 38, 80 ], speedOf( key ) ),
							sway: [ 6, 22 ],
							spin: 0.6,
							opacity: [
								opacityOf( key ) * 0.85,
								opacityOf( key ),
							],
						} );
					}
					break;
				}
				case 'skulls': {
					const set = list( [ 'skull' ] );
					if ( set.length ) {
						engine.addEffect( 'fallers', {
							sprites: set,
							count: n,
							size: range( [ 26, 42 ], sizeOf( key ) ),
							speed: range( [ 45, 85 ], speedOf( key ) ),
							sway: [ 4, 14 ],
							spin: 1,
							opacity: [
								opacityOf( key ) * 0.85,
								opacityOf( key ),
							],
						} );
					}
					break;
				}
				case 'leaves': {
					const set = list( [ 'leafMaple', 'leafOak', 'leafElm' ] );
					if ( set.length ) {
						engine.addEffect( 'fallers', {
							sprites: set,
							count: n,
							size: range( [ 16, 30 ], sizeOf( key ) ),
							speed: range( [ 30, 70 ], speedOf( key ) ),
							sway: [ 20, 60 ],
							spin: 1.4,
							flutter: true,
							opacity: [ 0.75, 1 ],
						} );
					}
					break;
				}
				case 'bats': {
					const frames = list( [ 'batUp', 'batDown' ] );
					if ( frames.length ) {
						engine.addEffect( 'flyers', {
							frames,
							count: n,
							size: range( [ 36, 62 ], sizeOf( key ) ),
							speed: range( [ 90, 180 ], speedOf( key ) ),
							opacity: [ 0.85, 1 ],
						} );
					}
					break;
				}
				case 'ghosts': {
					const set = list( [ 'ghost' ] );
					if ( set.length ) {
						engine.addEffect( 'wanderers', {
							sprites: set,
							count: n,
							size: range( [ 46, 80 ], sizeOf( key ) ),
							speed: range( [ 12, 30 ], speedOf( key ) ),
							opacity: [
								opacityOf( key ) * 0.55,
								opacityOf( key ),
							],
						} );
					}
					break;
				}
				case 'spiders': {
					const set = list( [ 'spider' ] );
					if ( set.length ) {
						engine.addEffect( 'hangers', {
							sprites: set,
							count: n,
							size: range( [ 24, 38 ], sizeOf( key ) ),
							speed: [ 35, 80 ],
							thread,
						} );
					}
					break;
				}
				case 'webs':
					if ( sprites.web ) {
						engine.addEffect( 'corners', {
							sprite: sprites.web,
							scale: sizeOf( key ),
							opacity: opacityOf( key ),
						} );
					}
					break;
				case 'fog':
					engine.addEffect( 'fog', {
						color: hexToRgb( fx.fog.color ),
						intensity: clamp( pct( fx.fog.intensity, 40 ), 0, 1 ),
						height: clamp( pct( fx.fog.height, 22 ), 0.1, 0.4 ),
					} );
					break;
				case 'particles':
					engine.addEffect( 'motes', {
						count: n,
						speed: speedOf( key ),
						colors: [ '255,150,60', '255,196,90', '186,140,255' ],
					} );
					break;
				case 'lightning':
					engine.addEffect( 'flash', {
						gap:
							LIGHTNING_GAPS[ fx.lightning.frequency ] ||
							LIGHTNING_GAPS.rare,
						intensity:
							clamp( pct( fx.lightning.intensity, 40 ), 0, 1 ) *
							0.3,
						color: '225,232,255',
						bolts: !! fx.lightning.bolts,
					} );
					break;
				case 'darkness':
					engine.addEffect( 'shade', {
						color: hexToRgb( fx.darkness.color ),
						intensity: clamp(
							pct( fx.darkness.intensity, 40 ),
							0,
							0.85
						),
					} );
					break;
				case 'clouds':
					engine.addEffect( 'fog', {
						color: '14,10,30',
						intensity: clamp(
							pct( fx.clouds.intensity, 50 ),
							0,
							1
						),
						height: plan.mobile ? 0.14 : 0.2,
						top: true,
						strength: 0.6,
					} );
					break;
				case 'rain':
					engine.addEffect( 'rain', {
						count: n,
						speed: speedOf( key ),
						wind: 0.2,
						color: 'rgb(140,150,190)',
					} );
					break;
				case 'eyes':
					engine.addEffect( 'eyes', {
						count: n,
						colors: [ '255,40,20', '255,150,20' ],
					} );
					break;
			}
		} );

		const base = String( config.assetsUrl || '' );
		const url = ( name ) => base + SPRITES[ name ];
		const ratio = ( name, fallback ) =>
			sprites[ name ] ? sprites[ name ].ratio : fallback;

		plan.heroes.forEach( ( key ) => {
			if ( key === 'pumpkins' && sprites.pumpkinJack ) {
				engine.addHero( 'tumbler', {
					sprites: [ url( 'pumpkinJack' ) ],
					ratio: ratio( 'pumpkinJack', 1 ),
					size: Math.max( 46, 60 * sizeOf( key ) ),
					speed: range( [ 40, 70 ], speedOf( key ) ),
					opacity: opacityOf( key ),
				} );
			} else if ( key === 'ghosts' && sprites.ghost ) {
				engine.addHero( 'floater', {
					sprites: [ url( 'ghost' ) ],
					ratio: ratio( 'ghost', 1.16 ),
					size: Math.max( 50, 72 * sizeOf( key ) ),
					speed: range( [ 14, 28 ], speedOf( key ) ),
					opacity: Math.max( 0.6, opacityOf( key ) ),
				} );
			} else if ( key === 'spiders' && sprites.spider ) {
				engine.addHero( 'dangler', {
					sprites: [ url( 'spider' ) ],
					ratio: ratio( 'spider', 1 ),
					size: Math.max( 40, 46 * sizeOf( key ) ),
					speed: [ 40, 70 ],
					hit: 0.8,
					thread,
				} );
			} else if ( key === 'bats' && sprites.batUp ) {
				engine.addHero( 'skittish', {
					sprites: [ url( 'batUp' ), url( 'batDown' ) ],
					ratio: ratio( 'batUp', 0.6 ),
					size: Math.max( 56, 66 * sizeOf( key ) ),
					speed: range( [ 80, 140 ], speedOf( key ) ),
					hit: 0.6,
					opacity: 1,
				} );
			}
		} );

		return engine;
	}

	/**
	 * Front-end entry point. Reads the config printed by PHP, re-checks
	 * the schedule (pages may be served from a full-page cache), then
	 * starts the effects once the page is idle so they never compete
	 * with the site's own loading.
	 */
	function autoBoot() {
		const config = window.halloweenWtConfig;

		if ( ! config || typeof config !== 'object' ) {
			return;
		}

		const schedule = config.schedule;
		if ( schedule ) {
			const t = Date.now();
			if (
				( schedule.start && t < schedule.start ) ||
				( schedule.end && t > schedule.end )
			) {
				return;
			}
		}

		let controller = null;

		const run = () => {
			try {
				if ( controller ) {
					controller.destroy();
					controller = null;
				}
				const mobile = HWT.isMobileViewport();
				if (
					mobile &&
					! config.preview &&
					! ( config.mobile || {} ).enabled
				) {
					return;
				}
				controller = HWT.boot( config, {
					mobile,
					reduced: HWT.prefersReducedMotion( config ),
				} );
			} catch ( e ) {
				controller = null;
			}
		};

		const whenIdle = () => {
			if ( 'requestIdleCallback' in window ) {
				window.requestIdleCallback( run, { timeout: 1500 } );
			} else {
				window.setTimeout( run, 300 );
			}
		};

		if ( document.readyState === 'complete' ) {
			whenIdle();
		} else {
			window.addEventListener( 'load', whenIdle, { once: true } );
		}

		// Follow live changes of the visitor's motion preference.
		if ( config.reducedMotion && window.matchMedia ) {
			const mq = window.matchMedia( '(prefers-reduced-motion: reduce)' );
			if ( mq.addEventListener ) {
				mq.addEventListener( 'change', run );
			}
		}
	}

	try {
		autoBoot();
	} catch ( e ) {
		// Never let decoration break the page.
	}
} )( window, document );
