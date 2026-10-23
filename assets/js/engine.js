/*
 * Halloween WT – effects engine.
 *
 * A small, theme-agnostic animation engine. It knows nothing about
 * pumpkins or ghosts: it provides a non-interactive canvas layer with
 * reusable effect primitives, plus a tiny DOM layer of draggable "hero"
 * objects driven by pluggable behaviours. Seasonal packs (see
 * halloween.js) describe *what* to draw; this file decides *how*.
 *
 * Safety rules followed throughout:
 * - The whole layer is aria-hidden and ignores the pointer, except for
 *   the small grab zones of hero objects.
 * - Every frame runs inside try/catch. Any error tears the layer down
 *   silently so the host website is never affected.
 * - Nothing runs while the document is hidden.
 */

( function ( window, document ) {
	'use strict';

	const HWT = ( window.HalloweenWT = window.HalloweenWT || {} );

	if ( HWT.Engine ) {
		return;
	}

	const TAU = Math.PI * 2;

	const rand = ( min, max ) => min + Math.random() * ( max - min );
	const clamp = ( value, min, max ) =>
		Math.min( max, Math.max( min, value ) );
	const pick = ( list ) => list[ Math.floor( Math.random() * list.length ) ];
	const now = () => window.performance.now();

	HWT.util = { TAU, rand, clamp, pick };

	/** Slow-changing primitives drawn on a background canvas at ~15 fps. */
	const SLOW_PRIMITIVES = [ 'shade', 'fog' ];
	const SLOW_INTERVAL = 1 / 15;
	HWT.primitives = HWT.primitives || {};
	HWT.behaviors = HWT.behaviors || {};

	/* ------------------------------------------------------------------ *
	 * Sprites
	 * ------------------------------------------------------------------ */

	/**
	 * Shared sprite cache. Sprites are SVG files rasterised once into an
	 * offscreen canvas so each frame only performs cheap bitmap copies.
	 * A sprite that fails to load resolves to null and is simply skipped.
	 */
	const spriteCache = new Map();

	function loadSprite( url, maxSize ) {
		const key = url + '|' + maxSize;

		if ( spriteCache.has( key ) ) {
			return spriteCache.get( key );
		}

		const promise = new Promise( ( resolve ) => {
			const img = new window.Image();
			img.decoding = 'async';
			img.onload = () => {
				try {
					const ratio =
						img.naturalWidth > 0
							? img.naturalHeight / img.naturalWidth
							: 1;
					const width = Math.round( maxSize );
					const height = Math.max( 1, Math.round( maxSize * ratio ) );
					const canvas = document.createElement( 'canvas' );
					canvas.width = width;
					canvas.height = height;
					canvas
						.getContext( '2d' )
						.drawImage( img, 0, 0, width, height );
					resolve( { canvas, ratio, url, img } );
				} catch ( e ) {
					resolve( null );
				}
			};
			img.onerror = () => resolve( null );
			img.src = url;
		} );

		spriteCache.set( key, promise );
		return promise;
	}

	/**
	 * Builds a soft radial "puff" texture used by fog and glow particles.
	 *
	 * @param {number} size  Texture size in pixels.
	 * @param {string} color CSS rgb() colour without alpha, e.g. "255,160,60".
	 * @param {number} hard  0..1, how quickly the puff fades out.
	 * @return {HTMLCanvasElement} Texture.
	 */
	function makeGlow( size, color, hard ) {
		const canvas = document.createElement( 'canvas' );
		canvas.width = size;
		canvas.height = size;
		const ctx = canvas.getContext( '2d' );
		const r = size / 2;
		const g = ctx.createRadialGradient( r, r, 0, r, r, r );
		g.addColorStop( 0, 'rgba(' + color + ',1)' );
		g.addColorStop( clamp( hard, 0.05, 0.95 ), 'rgba(' + color + ',0.45)' );
		g.addColorStop( 1, 'rgba(' + color + ',0)' );
		ctx.fillStyle = g;
		ctx.fillRect( 0, 0, size, size );
		return canvas;
	}

	HWT.makeGlow = makeGlow;

	/* ------------------------------------------------------------------ *
	 * Engine
	 * ------------------------------------------------------------------ */

	class Engine {
		/**
		 * @param {Object}      options
		 * @param {HTMLElement} [options.mount]    Container for preview mode. Defaults to the page.
		 * @param {number}      [options.zIndex]   Stacking level of the fixed layer.
		 * @param {boolean}     [options.isStatic] Draw one frame only (reduced motion).
		 * @param {number}      [options.maxDpr]   Device pixel ratio cap for the canvas.
		 * @param {Object}      [options.physics]  Interaction tuning shared by hero behaviours.
		 */
		constructor( options ) {
			this.options = options || {};
			this.mount = this.options.mount || null;
			this.isStatic = !! this.options.isStatic;
			this.physics = this.options.physics || {};
			this.effects = [];
			this.heroes = [];
			this.heroByHit = new Map();
			this.listeners = [];
			this.running = false;
			this.destroyed = false;
			this.paused = false;
			this.raf = 0;
			this.last = 0;
			this.time = 0;
			this.width = 0;
			this.height = 0;
			this.dpr = 1;
			this.quality = 1;
			// 0..1 brightness of the current lightning strike; lets other
			// effects (e.g. the darkness) react to it.
			this.light = 0;
			this.frameAvg = 1 / 60;
			this.qualityCheckAt = 0;
			this.needsResize = true;
			this.tick = this.tick.bind( this );
		}

		/**
		 * Adds an event listener that is removed automatically on destroy.
		 *
		 * @param {EventTarget} target  Target.
		 * @param {string}      type    Event type.
		 * @param {Function}    handler Handler.
		 * @param {Object}      [opts]  Listener options.
		 */
		listen( target, type, handler, opts ) {
			const safe = ( event ) => {
				try {
					handler.call( this, event );
				} catch ( e ) {
					this.fail();
				}
			};
			target.addEventListener( type, safe, opts );
			this.listeners.push( [ target, type, safe, opts ] );
		}

		/**
		 * Creates the DOM layer. Called once by start().
		 */
		createLayer() {
			const layer = document.createElement( 'div' );
			layer.className =
				'hwt-layer' + ( this.mount ? ' hwt-layer--contained' : '' );
			layer.setAttribute( 'aria-hidden', 'true' );

			if ( this.options.zIndex ) {
				layer.style.zIndex = String( this.options.zIndex );
			}

			if ( this.effects.some( ( effect ) => effect.slow ) ) {
				const back = document.createElement( 'canvas' );
				back.className = 'hwt-canvas';
				layer.appendChild( back );
				this.back = back;
				this.backCtx = back.getContext( '2d' );
			}

			const canvas = document.createElement( 'canvas' );
			canvas.className = 'hwt-canvas';

			const heroLayer = document.createElement( 'div' );
			heroLayer.className = 'hwt-heroes';

			layer.appendChild( canvas );
			layer.appendChild( heroLayer );
			( this.mount || document.body ).appendChild( layer );

			this.layer = layer;
			this.canvas = canvas;
			this.ctx = canvas.getContext( '2d' );
			this.heroLayer = heroLayer;
		}

		/**
		 * Measures the layer and resizes the canvas backing store.
		 */
		resize() {
			this.needsResize = false;
			const width = this.layer.clientWidth;
			const height = this.layer.clientHeight;

			if ( ! width || ! height ) {
				return;
			}

			const dpr = Math.min(
				window.devicePixelRatio || 1,
				this.options.maxDpr || 1.5
			);
			const changed =
				width !== this.width ||
				height !== this.height ||
				dpr !== this.dpr;

			this.width = width;
			this.height = height;
			this.dpr = dpr;

			if ( changed ) {
				this.canvas.width = Math.round( width * dpr );
				this.canvas.height = Math.round( height * dpr );
				if ( this.back ) {
					this.back.width = this.canvas.width;
					this.back.height = this.canvas.height;
					this.backDirty = true;
				}
				this.effects.forEach( ( effect ) => {
					if ( effect.resize ) {
						effect.resize( width, height, this );
					}
				} );
				this.heroes.forEach( ( hero ) => hero.keepInside() );
			}
		}

		/**
		 * Adds a canvas effect built from a registered primitive.
		 *
		 * @param {string} primitive Primitive name.
		 * @param {Object} params    Primitive parameters.
		 */
		addEffect( primitive, params ) {
			const factory = HWT.primitives[ primitive ];

			if ( factory ) {
				const effect = factory( this, params );
				effect.slow = SLOW_PRIMITIVES.includes( primitive );
				this.effects.push( effect );
			}
		}

		/**
		 * Adds an interactive hero object.
		 *
		 * @param {string} behavior Behaviour name.
		 * @param {Object} params   Behaviour parameters, including sprite list.
		 */
		addHero( behavior, params ) {
			const def = HWT.behaviors[ behavior ];

			if ( def ) {
				this.heroes.push( new Hero( this, def, params ) );
			}
		}

		/**
		 * Mounts the layer and starts animating.
		 */
		start() {
			if ( this.running || this.destroyed ) {
				return;
			}

			this.createLayer();
			this.resize();

			if ( ! this.width || ! this.height ) {
				this.destroy();
				return;
			}

			this.heroes.forEach( ( hero ) => hero.mount() );

			if ( this.mount && 'ResizeObserver' in window ) {
				this.resizeObserver = new window.ResizeObserver( () => {
					this.needsResize = true;
					if ( this.isStatic ) {
						this.renderStatic();
					}
				} );
				this.resizeObserver.observe( this.mount );
			} else {
				this.listen(
					window,
					'resize',
					() => {
						this.needsResize = true;
						if ( this.isStatic ) {
							this.renderStatic();
						}
					},
					{ passive: true }
				);
			}

			if ( this.isStatic ) {
				this.running = true;
				this.renderStatic();
				return;
			}

			if ( this.heroes.length ) {
				this.bindPointer();
			}

			this.listen( document, 'visibilitychange', () => {
				if ( document.hidden ) {
					this.halt();
				} else {
					this.resume();
				}
			} );

			this.running = true;
			this.layer.classList.add( 'is-active' );
			this.resume();
		}

		/**
		 * Draws a single frame (reduced motion / static mode).
		 */
		renderStatic() {
			try {
				this.resize();
				this.layer.classList.add( 'is-active' );
				this.draw( 0 );
			} catch ( e ) {
				this.fail();
			}
		}

		resume() {
			if (
				! this.running ||
				this.paused ||
				this.raf ||
				document.hidden
			) {
				return;
			}
			this.last = now();
			this.raf = window.requestAnimationFrame( this.tick );
		}

		halt() {
			if ( this.raf ) {
				window.cancelAnimationFrame( this.raf );
				this.raf = 0;
			}
		}

		/**
		 * Pauses or resumes animation (used by the admin preview).
		 *
		 * @param {boolean} paused Whether to pause.
		 */
		setPaused( paused ) {
			this.paused = !! paused;
			if ( this.paused ) {
				this.halt();
			} else {
				this.resume();
			}
		}

		tick( timestamp ) {
			this.raf = 0;

			if ( ! this.running ) {
				return;
			}

			// Decoration does not need more than ~60–70 updates per second;
			// skipping frames on 120/144 Hz screens halves CPU and battery use.
			if ( timestamp - this.last < 12 ) {
				this.raf = window.requestAnimationFrame( this.tick );
				return;
			}

			try {
				let dt = ( timestamp - this.last ) / 1000;
				this.last = timestamp;

				// Large gaps (tab switch, debugger, slow device) must not
				// teleport objects.
				dt = clamp( dt, 0, 0.05 );

				if ( this.needsResize ) {
					this.resize();
				}

				this.adaptQuality( dt );
				this.time += dt;
				this.update( dt );
				this.draw( dt );
			} catch ( e ) {
				this.fail();
				return;
			}

			this.raf = window.requestAnimationFrame( this.tick );
		}

		/**
		 * Lowers the number of drawn objects when frames take too long,
		 * and slowly restores it when the device copes again.
		 *
		 * @param {number} dt Frame delta in seconds.
		 */
		adaptQuality( dt ) {
			if ( dt <= 0 ) {
				return;
			}

			this.frameAvg = this.frameAvg * 0.94 + dt * 0.06;

			if ( this.time < this.qualityCheckAt ) {
				return;
			}

			if ( this.frameAvg > 1 / 40 && this.quality > 0.35 ) {
				this.quality = Math.max( 0.35, this.quality * 0.8 );
				this.qualityCheckAt = this.time + 2;
			} else if ( this.frameAvg < 1 / 55 && this.quality < 1 ) {
				this.quality = Math.min( 1, this.quality + 0.05 );
				this.qualityCheckAt = this.time + 6;
			} else {
				this.qualityCheckAt = this.time + 1;
			}
		}

		update( dt ) {
			for ( let i = 0; i < this.effects.length; i++ ) {
				this.effects[ i ].update( dt, this );
			}
			for ( let i = 0; i < this.heroes.length; i++ ) {
				this.heroes[ i ].update( dt );
			}
		}

		draw() {
			const ctx = this.ctx;
			const back = this.backCtx;

			if ( back ) {
				// Repaint mist and darkness ~15 times a second, but every
				// frame while lightning changes the scene brightness.
				const lit = this.light > 0 || this.backLit;
				if (
					this.backDirty ||
					lit ||
					this.isStatic ||
					! ( this.time - this.backDrawn < SLOW_INTERVAL )
				) {
					back.setTransform( 1, 0, 0, 1, 0, 0 );
					back.globalAlpha = 1;
					back.clearRect( 0, 0, this.back.width, this.back.height );
					for ( let i = 0; i < this.effects.length; i++ ) {
						if ( this.effects[ i ].slow ) {
							this.effects[ i ].draw( back, this );
						}
					}
					this.backDrawn = this.time;
					this.backDirty = false;
				}
				this.backLit = this.light > 0;
			}

			ctx.setTransform( 1, 0, 0, 1, 0, 0 );
			ctx.globalAlpha = 1;
			ctx.clearRect( 0, 0, this.canvas.width, this.canvas.height );

			for ( let i = 0; i < this.effects.length; i++ ) {
				if ( ! back || ! this.effects[ i ].slow ) {
					this.effects[ i ].draw( ctx, this );
				}
			}

			// Hero extras (e.g. spider threads) sit on the canvas, under
			// the hero DOM elements.
			for ( let i = 0; i < this.heroes.length; i++ ) {
				this.heroes[ i ].drawExtras( ctx );
				this.heroes[ i ].render();
			}

			ctx.setTransform( 1, 0, 0, 1, 0, 0 );
			ctx.globalAlpha = 1;
		}

		/**
		 * Draws a sprite centred on (x, y).
		 *
		 * @param {CanvasRenderingContext2D} ctx    Context.
		 * @param {Object}                   sprite Sprite from loadSprite().
		 * @param {number}                   x      Centre x in CSS pixels.
		 * @param {number}                   y      Centre y in CSS pixels.
		 * @param {number}                   w      Width in CSS pixels.
		 * @param {number}                   rot    Rotation in radians.
		 * @param {number}                   alpha  Opacity 0..1.
		 * @param {number}                   [sx=1] Horizontal scale (negative flips).
		 * @param {number}                   [sy=1] Vertical scale.
		 */
		drawSprite( ctx, sprite, x, y, w, rot, alpha, sx, sy ) {
			if ( ! sprite || alpha <= 0.01 ) {
				return;
			}

			const h = w * sprite.ratio;
			const d = this.dpr;
			const c = Math.cos( rot );
			const s = Math.sin( rot );
			const fx = sx === undefined ? 1 : sx;
			const fy = sy === undefined ? 1 : sy;

			ctx.globalAlpha = alpha > 1 ? 1 : alpha;
			ctx.setTransform(
				c * fx * d,
				s * fx * d,
				-s * fy * d,
				c * fy * d,
				x * d,
				y * d
			);
			ctx.drawImage( sprite.canvas, -w / 2, -h / 2, w, h );
		}

		/* -------------------------------------------------------------- *
		 * Pointer handling for hero objects (event delegation).
		 * -------------------------------------------------------------- */

		bindPointer() {
			if ( ! ( 'PointerEvent' in window ) ) {
				return;
			}

			const layer = this.heroLayer;

			this.listen( layer, 'pointerdown', this.onPointerDown );
			this.listen( layer, 'pointermove', this.onPointerMove, {
				passive: true,
			} );
			this.listen( layer, 'pointerup', this.onPointerUp );
			this.listen( layer, 'pointercancel', this.onPointerUp );
			this.listen( layer, 'lostpointercapture', this.onPointerUp );
			this.listen( layer, 'pointerover', ( event ) =>
				this.setHover( event, true )
			);
			this.listen( layer, 'pointerout', ( event ) =>
				this.setHover( event, false )
			);
			this.listen( layer, 'dragstart', ( event ) =>
				event.preventDefault()
			);
		}

		heroFromEvent( event ) {
			return this.heroByHit.get( event.target ) || null;
		}

		toLocal( event ) {
			const rect = this.layerRect || this.layer.getBoundingClientRect();
			return {
				x: event.clientX - rect.left,
				y: event.clientY - rect.top,
			};
		}

		setHover( event, state ) {
			const hero = this.heroFromEvent( event );

			if ( hero ) {
				hero.hover = state && ! hero.inert;
				hero.el.classList.toggle( 'is-hover', hero.hover );
			}
		}

		onPointerDown( event ) {
			const hero = this.heroFromEvent( event );

			if (
				! hero ||
				hero.inert ||
				( event.button && event.button !== 0 )
			) {
				return;
			}

			// Only the tiny grab zone receives this event, so preventing
			// the default here never affects the website underneath.
			event.preventDefault();
			this.layerRect = this.layer.getBoundingClientRect();
			const point = this.toLocal( event );

			if ( hero.def.interaction === 'tap' ) {
				hero.def.tap( hero, point, this );
				return;
			}

			try {
				event.target.setPointerCapture( event.pointerId );
			} catch ( e ) {
				// Capture is a progressive enhancement.
			}

			hero.startDrag( event.pointerId, point );
		}

		onPointerMove( event ) {
			const hero = this.heroFromEvent( event );

			if ( hero && hero.pointerId === event.pointerId ) {
				hero.moveDrag( this.toLocal( event ) );
			}
		}

		onPointerUp( event ) {
			const hero = this.heroFromEvent( event );

			if ( hero && hero.pointerId === event.pointerId ) {
				hero.endDrag();
				this.layerRect = null;
			}
		}

		/* -------------------------------------------------------------- *
		 * Teardown
		 * -------------------------------------------------------------- */

		fail() {
			this.destroy();
		}

		destroy() {
			if ( this.destroyed ) {
				return;
			}

			this.destroyed = true;
			this.running = false;
			this.halt();

			this.listeners.forEach( ( [ target, type, handler, opts ] ) => {
				target.removeEventListener( type, handler, opts );
			} );
			this.listeners = [];

			if ( this.resizeObserver ) {
				this.resizeObserver.disconnect();
			}

			if ( this.layer && this.layer.parentNode ) {
				this.layer.parentNode.removeChild( this.layer );
			}

			this.effects = [];
			this.heroes = [];
			this.heroByHit.clear();
		}
	}

	/* ------------------------------------------------------------------ *
	 * Hero objects
	 * ------------------------------------------------------------------ */

	/**
	 * An interactive object rendered as a small DOM element. Its visual is
	 * an <img>, its pointer target a circular grab zone smaller than the
	 * artwork, so transparent corners never block the page.
	 */
	class Hero {
		constructor( engine, def, params ) {
			this.engine = engine;
			this.def = def;
			this.params = params;
			this.sprites = params.sprites || [];
			this.size = params.size || 56;
			this.x = -1000;
			this.y = -1000;
			this.vx = 0;
			this.vy = 0;
			this.rot = 0;
			this.spin = 0;
			this.alpha = 0;
			this.flip = 1;
			this.frame = 0;
			this.state = 'auto';
			this.hover = false;
			this.inert = true;
			this.pointerId = null;
			this.samples = [];
			this.timer = 0;
			this.lastTransform = '';
			this.lastAlpha = -1;
			this.lastFrame = -1;
		}

		mount() {
			const el = document.createElement( 'div' );
			// Start inert: the grab zone only activates once the object is
			// actually visible on screen.
			el.className =
				'hwt-hero is-inert hwt-hero--' + ( this.def.name || 'object' );
			el.style.width = this.size + 'px';
			el.style.height =
				Math.round( this.size * ( this.params.ratio || 1 ) ) + 'px';

			this.images = this.sprites.map( ( url, index ) => {
				const img = document.createElement( 'img' );
				img.className = 'hwt-hero__img';
				img.src = url;
				img.alt = '';
				img.draggable = false;
				img.decoding = 'async';
				if ( index > 0 ) {
					img.style.visibility = 'hidden';
				}
				el.appendChild( img );
				return img;
			} );

			const hit = document.createElement( 'span' );
			hit.className =
				'hwt-hero__hit' +
				( this.def.interaction === 'tap' ? ' is-tap' : '' );
			const hitSize = Math.max(
				40,
				this.size * ( this.params.hit || 0.7 )
			);
			hit.style.width = hitSize + 'px';
			hit.style.height = hitSize + 'px';
			hit.style.marginLeft = -hitSize / 2 + 'px';
			hit.style.marginTop = -hitSize / 2 + 'px';
			el.appendChild( hit );

			this.el = el;
			this.hit = hit;
			this.height = this.size * ( this.params.ratio || 1 );
			this.engine.heroLayer.appendChild( el );
			this.engine.heroByHit.set( hit, this );
			this.def.init( this, this.engine, true );
		}

		update( dt ) {
			const engine = this.engine;

			if ( this.state === 'drag' ) {
				// Ease towards the pointer for a smooth, weighty feel.
				const follow = 1 - Math.exp( -24 * dt );
				const prevX = this.x;
				this.x += ( this.targetX - this.x ) * follow;
				this.y += ( this.targetY - this.y ) * follow;
				this.keepInside();
				const swing = clamp(
					( this.x - prevX ) / Math.max( dt, 0.001 ) / 900,
					-0.6,
					0.6
				);
				this.rot += ( swing - this.rot ) * Math.min( 1, dt * 10 );
				if ( this.def.dragging ) {
					this.def.dragging( this, dt, engine );
				}
			} else if ( this.state === 'free' ) {
				if ( this.def.free( this, dt, engine ) ) {
					this.state = 'auto';
				}
			} else {
				this.def.auto( this, dt * ( this.hover ? 0.25 : 1 ), engine );
			}

			const visible =
				this.alpha > 0.45 &&
				this.x > -this.size / 2 &&
				this.y > -this.height / 2 &&
				this.x < engine.width + this.size / 2 &&
				this.y < engine.height + this.height / 2;

			const inert = ! visible && this.state !== 'drag';

			if ( inert !== this.inert ) {
				this.inert = inert;
				this.el.classList.toggle( 'is-inert', inert );
				if ( inert && this.hover ) {
					this.hover = false;
					this.el.classList.remove( 'is-hover' );
				}
			}
		}

		render() {
			const w = this.size;
			const h = this.height;
			const transform =
				'translate3d(' +
				( this.x - w / 2 ).toFixed( 1 ) +
				'px,' +
				( this.y - h / 2 ).toFixed( 1 ) +
				'px,0) rotate(' +
				this.rot.toFixed( 3 ) +
				'rad) scale(' +
				this.flip +
				',1)';

			if ( transform !== this.lastTransform ) {
				this.el.style.transform = transform;
				this.lastTransform = transform;
			}

			const alpha = Math.round( clamp( this.alpha, 0, 1 ) * 100 ) / 100;
			if ( alpha !== this.lastAlpha ) {
				this.el.style.opacity = String( alpha );
				this.lastAlpha = alpha;
			}

			if ( this.images.length > 1 && this.frame !== this.lastFrame ) {
				this.images.forEach( ( img, index ) => {
					img.style.visibility =
						index === this.frame ? 'visible' : 'hidden';
				} );
				this.lastFrame = this.frame;
			}
		}

		drawExtras( ctx ) {
			if ( this.def.drawExtras ) {
				this.def.drawExtras( ctx, this, this.engine );
			}
		}

		/**
		 * Keeps the hero reachable after resizes and drags.
		 */
		keepInside() {
			const engine = this.engine;

			if ( ! engine.width ) {
				return;
			}

			if ( this.state === 'drag' || this.state === 'free' ) {
				const r = this.size / 2;
				this.x = clamp( this.x, r * 0.5, engine.width - r * 0.5 );
				this.y = clamp(
					this.y,
					-this.height,
					engine.height - this.height * 0.25
				);
			} else if (
				this.x > engine.width + this.size * 2 &&
				this.def.reset
			) {
				this.def.reset( this, engine );
			}

			if ( this.def.keepInside ) {
				this.def.keepInside( this, engine );
			}
		}

		startDrag( pointerId, point ) {
			this.state = 'drag';
			this.pointerId = pointerId;
			this.grabX = this.x - point.x;
			this.grabY = this.y - point.y;
			this.targetX = this.x;
			this.targetY = this.y;
			this.samples = [ { t: now(), x: point.x, y: point.y } ];
			this.el.classList.add( 'is-dragging' );

			if ( this.def.grab ) {
				this.def.grab( this, this.engine );
			}
		}

		moveDrag( point ) {
			this.targetX = point.x + this.grabX;
			this.targetY = point.y + this.grabY;
			this.samples.push( { t: now(), x: point.x, y: point.y } );

			if ( this.samples.length > 8 ) {
				this.samples.shift();
			}
		}

		endDrag() {
			const t = now();
			const last = this.samples[ this.samples.length - 1 ];
			let vx = 0;
			let vy = 0;

			// Velocity from the last ~100ms of movement. If the pointer was
			// held still before release, the object is simply dropped.
			if ( last && t - last.t < 80 ) {
				let first = last;
				for ( let i = this.samples.length - 1; i >= 0; i-- ) {
					if ( last.t - this.samples[ i ].t > 100 ) {
						break;
					}
					first = this.samples[ i ];
				}
				const span = ( last.t - first.t ) / 1000;
				if ( span > 0.008 ) {
					vx = ( last.x - first.x ) / span;
					vy = ( last.y - first.y ) / span;
				}
			}

			const max = this.engine.physics.maxThrow || 1800;
			const speed = Math.hypot( vx, vy );
			if ( speed > max ) {
				vx = ( vx / speed ) * max;
				vy = ( vy / speed ) * max;
			}

			this.state = 'free';
			this.pointerId = null;
			this.samples = [];
			this.vx = vx;
			this.vy = vy;
			this.timer = 0;
			this.el.classList.remove( 'is-dragging' );

			if ( this.def.release ) {
				this.def.release( this, this.engine );
			}
		}
	}

	HWT.Engine = Engine;
	HWT.loadSprite = loadSprite;

	/* ------------------------------------------------------------------ *
	 * Canvas primitives
	 *
	 * Each primitive returns { resize, update, draw }. Items are reused
	 * ("recycled") instead of being created and garbage collected.
	 * ------------------------------------------------------------------ */

	const visibleCount = ( items, engine ) =>
		Math.ceil( items.length * engine.quality );

	const depth = () => rand( 0.65, 1.15 );

	/**
	 * Sprites falling with sway, spin and optional leaf-like flutter.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { sprites, count, size, speed, sway, spin, opacity, flutter }
	 * @return {Object} Effect.
	 */
	HWT.primitives.fallers = ( engine, p ) => {
		const items = [];

		const spawn = ( item, initial ) => {
			const z = depth();
			item.sprite = pick( p.sprites );
			item.size = rand( p.size[ 0 ], p.size[ 1 ] ) * z;
			item.vy = rand( p.speed[ 0 ], p.speed[ 1 ] ) * z;
			item.x = rand( 0, engine.width );
			item.y = initial
				? rand( -engine.height, engine.height * 0.85 )
				: -item.size - rand( 0, engine.height * 0.6 );
			item.swayAmp = rand( p.sway[ 0 ], p.sway[ 1 ] );
			item.swayRate = rand( 0.25, 0.7 ) * TAU;
			item.phase = rand( 0, TAU );
			item.rot = rand( -0.6, 0.6 );
			item.spin = rand( -p.spin, p.spin );
			item.alpha =
				rand( p.opacity[ 0 ], p.opacity[ 1 ] ) *
				clamp( 0.55 + 0.45 * z, 0, 1 );
			item.flutter = p.flutter ? rand( 1.2, 2.4 ) : 0;
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
					return;
				}
				items.forEach( ( item ) => {
					if ( item.x > engine.width ) {
						item.x = rand( 0, engine.width );
					}
				} );
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					item.y += item.vy * dt;
					item.phase += item.swayRate * dt;
					item.rot += item.spin * dt;
					if ( item.y - item.size > engine.height ) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const n = visibleCount( items, engine );
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					if ( item.y < -item.size ) {
						continue;
					}
					let rot = item.rot;
					let sx = 1;
					if ( item.flutter ) {
						sx = Math.cos( item.phase * item.flutter );
						sx =
							sx < 0
								? Math.min( sx, -0.18 )
								: Math.max( sx, 0.18 );
						rot = item.rot * 0.3 + Math.sin( item.phase ) * 0.7;
					}
					engine.drawSprite(
						ctx,
						item.sprite,
						item.x + Math.sin( item.phase ) * item.swayAmp,
						item.y,
						item.size,
						rot,
						item.alpha,
						sx
					);
				}
			},
		};
	};

	/**
	 * Flapping creatures crossing the screen with bobbing flight paths.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { frames, count, size, speed, opacity }
	 * @return {Object} Effect.
	 */
	HWT.primitives.flyers = ( engine, p ) => {
		const items = [];

		const spawn = ( item, initial ) => {
			const z = depth();
			item.size = rand( p.size[ 0 ], p.size[ 1 ] ) * z;
			item.dir = Math.random() < 0.5 ? 1 : -1;
			item.vx = rand( p.speed[ 0 ], p.speed[ 1 ] ) * z * item.dir;
			item.x = item.dir > 0 ? -item.size : engine.width + item.size;
			item.baseY = rand( 0.05, 0.6 ) * engine.height;
			item.drift = rand( -22, 22 ) * z;
			item.bobAmp = rand( 8, 34 );
			item.bobRate = rand( 0.5, 1.4 ) * TAU;
			item.phase = rand( 0, TAU );
			item.flapRate = rand( 4.5, 8 );
			item.flap = rand( 0, 1 );
			item.alpha =
				rand( p.opacity[ 0 ], p.opacity[ 1 ] ) *
				clamp( 0.6 + 0.4 * z, 0, 1 );
			item.delay = initial ? rand( 0, 5 ) : rand( 1.5, 9 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						item.delay -= dt;
						continue;
					}
					item.x += item.vx * dt;
					item.baseY += item.drift * dt;
					item.phase += item.bobRate * dt;
					item.flap += item.flapRate * dt;
					if (
						item.x < -item.size * 1.5 ||
						item.x > engine.width + item.size * 1.5
					) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const n = visibleCount( items, engine );
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						continue;
					}
					const frame = item.flap % 1 < 0.5 ? 0 : 1;
					engine.drawSprite(
						ctx,
						p.frames[ frame ] || p.frames[ 0 ],
						item.x,
						item.baseY + Math.sin( item.phase ) * item.bobAmp,
						item.size,
						Math.cos( item.phase ) * 0.14 * item.dir,
						item.alpha
					);
				}
			},
		};
	};

	/**
	 * Translucent wanderers that fade in, drift on a meandering heading
	 * and fade out again.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { sprites, count, size, speed, opacity }
	 * @return {Object} Effect.
	 */
	HWT.primitives.wanderers = ( engine, p ) => {
		const items = [];

		const spawn = ( item, initial ) => {
			const z = depth();
			item.sprite = pick( p.sprites );
			item.size = rand( p.size[ 0 ], p.size[ 1 ] ) * z;
			item.x = rand( 0.06, 0.94 ) * engine.width;
			item.y = rand( 0.1, 0.75 ) * engine.height;
			item.speed = rand( p.speed[ 0 ], p.speed[ 1 ] ) * z;
			item.heading = rand( 0, TAU );
			item.turnRate = rand( 0.15, 0.4 );
			item.life = rand( 9, 16 );
			item.age = 0;
			item.bob = rand( 0, TAU );
			item.maxAlpha = rand( p.opacity[ 0 ], p.opacity[ 1 ] );
			item.delay = initial ? rand( 0, 4 ) : rand( 1, 6 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						item.delay -= dt;
						continue;
					}
					item.age += dt;
					const heading =
						item.heading +
						Math.sin( item.age * item.turnRate ) * 1.6;
					item.vx = Math.cos( heading ) * item.speed;
					item.x += item.vx * dt;
					item.y += Math.sin( heading ) * item.speed * 0.45 * dt;
					item.bob += dt * 1.6;
					if ( item.age >= item.life ) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const n = visibleCount( items, engine );
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						continue;
					}
					const fade = Math.min(
						1,
						item.age / 1.6,
						( item.life - item.age ) / 1.6
					);
					engine.drawSprite(
						ctx,
						item.sprite,
						item.x,
						item.y + Math.sin( item.bob ) * 6,
						item.size,
						Math.sin( item.bob * 0.7 ) * 0.08,
						item.maxAlpha * fade,
						item.vx < 0 ? -1 : 1,
						1 + Math.sin( item.bob * 1.3 ) * 0.03
					);
				}
			},
		};
	};

	/**
	 * Creatures descending on a thread, pausing, then climbing back up.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { sprites, count, size, speed, thread }
	 * @return {Object} Effect.
	 */
	HWT.primitives.hangers = ( engine, p ) => {
		const items = [];

		const spawn = ( item, initial ) => {
			const z = depth();
			item.sprite = pick( p.sprites );
			item.size = rand( p.size[ 0 ], p.size[ 1 ] ) * z;
			item.x = rand( 0.04, 0.96 ) * engine.width;
			item.target = rand( 0.12, 0.45 ) * engine.height;
			item.speed = rand( p.speed[ 0 ], p.speed[ 1 ] );
			item.y = initial ? rand( -item.size, item.target ) : -item.size;
			item.mode = 'down';
			item.timer = 0;
			item.phase = rand( 0, TAU );
			item.alpha = rand( 0.85, 1 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
				items.forEach( ( item ) => {
					item.x = clamp( item.x, 8, engine.width - 8 );
				} );
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					item.phase += dt;
					if ( item.mode === 'down' ) {
						item.y += item.speed * dt;
						if ( item.y >= item.target ) {
							item.mode = 'hold';
							item.timer = rand( 2.5, 7 );
						}
					} else if ( item.mode === 'hold' ) {
						item.timer -= dt;
						item.y = item.target + Math.sin( item.phase * 2.2 ) * 4;
						if ( item.timer <= 0 ) {
							item.mode = 'up';
						}
					} else if ( item.mode === 'up' ) {
						item.y -= item.speed * 1.5 * dt;
						if ( item.y < -item.size ) {
							item.mode = 'wait';
							item.timer = rand( 2, 8 );
						}
					} else {
						item.timer -= dt;
						if ( item.timer <= 0 ) {
							spawn( item, false );
						}
					}
				}
			},
			draw( ctx ) {
				const n = visibleCount( items, engine );
				const d = engine.dpr;

				ctx.setTransform( d, 0, 0, d, 0, 0 );
				ctx.globalAlpha = 0.75;
				ctx.strokeStyle = p.thread;
				ctx.lineWidth = 1;
				ctx.beginPath();
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					const top = item.y - item.size * 0.3;
					if ( top > 0 ) {
						ctx.moveTo( item.x, 0 );
						ctx.lineTo(
							item.x + Math.sin( item.phase * 1.1 ) * 2,
							top
						);
					}
				}
				ctx.stroke();

				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					engine.drawSprite(
						ctx,
						item.sprite,
						item.x + Math.sin( item.phase * 1.1 ) * 2,
						item.y,
						item.size,
						Math.sin( item.phase * 1.1 ) * 0.04,
						item.alpha
					);
				}
			},
		};
	};

	/**
	 * Static decorations pinned to the top corners.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { sprite, scale, opacity }
	 * @return {Object} Effect.
	 */
	HWT.primitives.corners = ( engine, p ) => {
		let size = 0;
		let cache = null;

		return {
			// Thin lines alias badly when a large bitmap is shrunk every
			// frame, so the decoration is scaled once with high-quality
			// smoothing and then copied 1:1.
			resize() {
				size = clamp(
					Math.min( engine.width, engine.height ) * 0.2 * p.scale,
					60,
					320
				);
				const px = Math.max( 1, Math.round( size * engine.dpr ) );
				cache = document.createElement( 'canvas' );
				cache.width = px;
				cache.height = Math.max( 1, Math.round( px * p.sprite.ratio ) );
				const c = cache.getContext( '2d' );
				c.imageSmoothingQuality = 'high';
				c.drawImage(
					p.sprite.img || p.sprite.canvas,
					0,
					0,
					cache.width,
					cache.height
				);
			},
			update() {},
			draw( ctx ) {
				if ( ! cache ) {
					return;
				}
				const sprite = { canvas: cache, ratio: p.sprite.ratio };
				engine.drawSprite(
					ctx,
					sprite,
					size / 2,
					size / 2,
					size,
					0,
					p.opacity
				);
				engine.drawSprite(
					ctx,
					sprite,
					engine.width - size / 2,
					size / 2,
					size,
					0,
					p.opacity,
					-1
				);
			},
		};
	};

	/**
	 * Slow drifting mist confined to a band at the bottom (fog) or the top
	 * (storm clouds) of the screen, so it never sits on reading content.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { color, intensity, height, top, strength }
	 * @return {Object} Effect.
	 */
	HWT.primitives.fog = ( engine, p ) => {
		const texture = makeGlow( 256, p.color, 0.35 );
		const items = [];
		const strength = p.strength || 0.32;
		let band = 0;
		let wash = null;

		const bandY = ( ry ) =>
			p.top ? ry * band : engine.height - ry * band;

		const spawn = ( item, x ) => {
			item.x = x === undefined ? rand( -0.1, 1.1 ) * engine.width : x;
			item.ry = rand( 0, 0.75 );
			item.w = rand( 0.25, 0.5 );
			item.h = rand( 0.9, 1.6 );
			item.vx = rand( 5, 16 ) * ( Math.random() < 0.5 ? -1 : 1 );
			item.alpha = rand( 0.5, 1 );
			item.phase = rand( 0, TAU );
		};

		return {
			resize() {
				band = engine.height * p.height;
				const count = clamp(
					Math.round( engine.width / 160 ) + 4,
					6,
					18
				);
				while ( items.length < count ) {
					const item = {};
					spawn( item );
					items.push( item );
				}
				items.length = count;
				wash = p.top
					? engine.ctx.createLinearGradient( 0, 0, 0, band )
					: engine.ctx.createLinearGradient(
							0,
							engine.height,
							0,
							engine.height - band
						);
				wash.addColorStop(
					0,
					'rgba(' + p.color + ',' + p.intensity * strength + ')'
				);
				wash.addColorStop( 1, 'rgba(' + p.color + ',0)' );
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					const half = ( item.w * engine.width ) / 2;
					item.x += item.vx * dt;
					item.phase += dt * 0.25;
					if ( item.x - half > engine.width ) {
						spawn( item, -half );
					} else if ( item.x + half < 0 ) {
						spawn( item, engine.width + half );
					}
				}
			},
			draw( ctx ) {
				const d = engine.dpr;
				ctx.setTransform( d, 0, 0, d, 0, 0 );

				if ( wash ) {
					ctx.globalAlpha = 1;
					ctx.fillStyle = wash;
					ctx.fillRect(
						0,
						p.top ? 0 : engine.height - band,
						engine.width,
						band
					);
				}

				const n = visibleCount( items, engine );
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					const w = item.w * engine.width;
					const h = item.h * band;
					const y = bandY( item.ry );
					ctx.globalAlpha =
						p.intensity *
						strength *
						item.alpha *
						( 0.8 + 0.2 * Math.sin( item.phase ) );
					ctx.drawImage( texture, item.x - w / 2, y - h / 2, w, h );
				}
			},
		};
	};

	/**
	 * Small glowing motes rising slowly, with a gentle twinkle.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { count, speed, colors }
	 * @return {Object} Effect.
	 */
	HWT.primitives.motes = ( engine, p ) => {
		const textures = p.colors.map( ( color ) =>
			makeGlow( 32, color, 0.25 )
		);
		const items = [];

		const spawn = ( item, initial ) => {
			item.texture = pick( textures );
			item.x = rand( 0, engine.width );
			item.y = initial ? rand( 0, engine.height ) : engine.height + 10;
			item.vy = -rand( 10, 32 ) * p.speed;
			item.size = rand( 3, 8 );
			item.drift = rand( 6, 20 );
			item.phase = rand( 0, TAU );
			item.twinkle = rand( 0.3, 1 ) * TAU;
			item.alpha = rand( 0.35, 0.85 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					item.y += item.vy * dt;
					item.phase += item.twinkle * dt;
					if ( item.y < -10 ) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const d = engine.dpr;
				const n = visibleCount( items, engine );
				ctx.setTransform( d, 0, 0, d, 0, 0 );
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					const x =
						item.x + Math.sin( item.phase * 0.5 ) * item.drift;
					ctx.globalAlpha =
						item.alpha * ( 0.55 + 0.45 * Math.sin( item.phase ) );
					ctx.drawImage(
						item.texture,
						x - item.size / 2,
						item.y - item.size / 2,
						item.size,
						item.size
					);
				}
			},
		};
	};

	/**
	 * Thunderstorm lightning: a branching bolt plus a sky flash.
	 *
	 * Each strike is one bright flash followed by a weaker after-flicker
	 * (two flashes), and strikes are at least 8 seconds apart. That stays
	 * well below the WCAG limit of three flashes in any one second.
	 * While a strike is lit, engine.light (0..1) lets the darkness lift.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { gap, intensity, color, bolts }
	 * @return {Object} Effect.
	 */
	HWT.primitives.flash = ( engine, p ) => {
		const minGap = Math.max( 8, p.gap[ 0 ] );
		let clock = 0;
		let next = rand( 4, 9 );
		let t = -1;
		let gradient = null;
		let bolts = [];

		const envelope = ( time ) => {
			const main =
				time < 0.05 ? time / 0.05 : Math.exp( -( time - 0.05 ) * 9 );
			let flicker = 0;
			if ( time >= 0.22 ) {
				flicker =
					0.6 *
					( time < 0.27
						? ( time - 0.22 ) / 0.05
						: Math.exp( -( time - 0.27 ) * 5 ) );
			}
			return Math.min( 1, main + flicker );
		};

		// Jagged line between two points by midpoint displacement.
		const jag = ( x1, y1, x2, y2, spread, steps, out ) => {
			if ( steps === 0 ) {
				out.push( x2, y2 );
				return;
			}
			const mx = ( x1 + x2 ) / 2 + rand( -spread, spread );
			const my = ( y1 + y2 ) / 2 + rand( -spread, spread ) * 0.3;
			jag( x1, y1, mx, my, spread / 2, steps - 1, out );
			jag( mx, my, x2, y2, spread / 2, steps - 1, out );
		};

		const makeBolt = () => {
			const x = rand( 0.12, 0.88 ) * engine.width;
			const endY = rand( 0.35, 0.65 ) * engine.height;
			const main = [ x, 0 ];
			jag(
				x,
				0,
				x + rand( -0.12, 0.12 ) * engine.width,
				endY,
				endY * 0.22,
				6,
				main
			);
			const paths = [ { points: main, width: 1 } ];
			const branches = Math.floor( rand( 1, 3.99 ) );
			for ( let b = 0; b < branches; b++ ) {
				const at =
					2 * Math.floor( rand( 0.2, 0.7 ) * ( main.length / 2 ) );
				const bx = main[ at ];
				const by = main[ at + 1 ];
				const len = rand( 0.12, 0.25 ) * engine.height;
				const dir = Math.random() < 0.5 ? -1 : 1;
				const branch = [ bx, by ];
				jag(
					bx,
					by,
					bx + dir * len * rand( 0.5, 1 ),
					by + len,
					len * 0.25,
					4,
					branch
				);
				paths.push( { points: branch, width: 0.55 } );
			}
			return paths;
		};

		const strokePaths = ( ctx, width, style ) => {
			ctx.strokeStyle = style;
			bolts.forEach( ( path ) => {
				ctx.lineWidth = width * path.width;
				ctx.beginPath();
				ctx.moveTo( path.points[ 0 ], path.points[ 1 ] );
				for ( let i = 2; i < path.points.length; i += 2 ) {
					ctx.lineTo( path.points[ i ], path.points[ i + 1 ] );
				}
				ctx.stroke();
			} );
		};

		return {
			resize() {
				gradient = engine.ctx.createLinearGradient(
					0,
					0,
					0,
					engine.height
				);
				gradient.addColorStop( 0, 'rgba(' + p.color + ',1)' );
				gradient.addColorStop( 0.6, 'rgba(' + p.color + ',0.3)' );
				gradient.addColorStop( 1, 'rgba(' + p.color + ',0.05)' );
				bolts = [];
			},
			update( dt ) {
				clock += dt;
				if ( t >= 0 ) {
					t += dt;
					if ( t > 1.2 ) {
						t = -1;
					}
				} else if ( clock >= next ) {
					t = 0;
					bolts = p.bolts ? makeBolt() : [];
					next =
						clock + rand( minGap, Math.max( minGap, p.gap[ 1 ] ) );
				}
				engine.light = t >= 0 ? envelope( t ) : 0;
			},
			draw( ctx ) {
				if ( t < 0 || ! gradient ) {
					return;
				}
				const level = envelope( t );
				const d = engine.dpr;
				ctx.setTransform( d, 0, 0, d, 0, 0 );
				ctx.globalAlpha = p.intensity * level;
				ctx.fillStyle = gradient;
				ctx.fillRect( 0, 0, engine.width, engine.height );

				if ( bolts.length ) {
					ctx.lineJoin = 'round';
					ctx.lineCap = 'round';
					// A coloured glow keeps the bolt visible on light sites too.
					ctx.shadowColor = 'rgba(110,100,255,0.9)';
					ctx.shadowBlur = 18 * d;
					ctx.globalAlpha = level * 0.6;
					strokePaths( ctx, 12, 'rgb(105,95,230)' );
					ctx.globalAlpha = level * 0.9;
					strokePaths( ctx, 5, 'rgb(170,175,255)' );
					ctx.shadowBlur = 0;
					ctx.shadowColor = 'transparent';
					ctx.globalAlpha = level;
					strokePaths( ctx, 2, '#fff' );
				}
			},
		};
	};

	/**
	 * Darkness: a gloomy vignette that is darkest at the edges and very
	 * light in the reading area. It lifts briefly when lightning strikes.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { color, intensity }
	 * @return {Object} Effect.
	 */
	HWT.primitives.shade = ( engine, p ) => {
		// The soft gradient is rendered once per resize at quarter
		// resolution and scaled up; per frame it is a single bitmap copy.
		const SCALE = 4;
		let cache = null;

		return {
			resize() {
				const w = Math.max( 1, Math.ceil( engine.width / SCALE ) );
				const h = Math.max( 1, Math.ceil( engine.height / SCALE ) );
				cache = document.createElement( 'canvas' );
				cache.width = w;
				cache.height = h;
				const c = cache.getContext( '2d' );
				const gradient = c.createRadialGradient(
					w / 2,
					h * 0.45,
					Math.min( w, h ) * 0.12,
					w / 2,
					h * 0.45,
					Math.hypot( w, h ) * 0.6
				);
				const rgba = ( alpha ) =>
					'rgba(' + p.color + ',' + alpha.toFixed( 3 ) + ')';
				gradient.addColorStop( 0, rgba( p.intensity * 0.26 ) );
				gradient.addColorStop( 0.5, rgba( p.intensity * 0.62 ) );
				gradient.addColorStop(
					1,
					rgba( Math.min( 0.92, p.intensity * 1.15 ) )
				);
				c.fillStyle = gradient;
				c.fillRect( 0, 0, w, h );
			},
			update() {},
			draw( ctx ) {
				if ( ! cache ) {
					return;
				}
				const d = engine.dpr;
				ctx.setTransform( d, 0, 0, d, 0, 0 );
				ctx.globalAlpha = 1 - 0.8 * engine.light;
				ctx.drawImage( cache, 0, 0, engine.width, engine.height );
			},
		};
	};

	/**
	 * Slanted rain streaks, drawn as a single path per frame.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { count, speed, wind, color }
	 * @return {Object} Effect.
	 */
	HWT.primitives.rain = ( engine, p ) => {
		const items = [];
		const sin = Math.sin( p.wind );
		const cos = Math.cos( p.wind );

		const spawn = ( item, initial ) => {
			item.len = rand( 10, 26 );
			item.v = rand( 650, 1050 ) * p.speed;
			item.x = rand( -0.15, 1.05 ) * engine.width;
			item.y = initial
				? rand( -engine.height, engine.height )
				: -rand( 20, engine.height * 0.4 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					item.y += item.v * cos * dt;
					item.x += item.v * sin * dt;
					if ( item.y - item.len > engine.height ) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const d = engine.dpr;
				const n = visibleCount( items, engine );
				ctx.setTransform( d, 0, 0, d, 0, 0 );
				ctx.globalAlpha = 0.6 + 0.35 * engine.light;
				ctx.strokeStyle = p.color;
				ctx.lineWidth = 1;
				ctx.lineCap = 'round';
				ctx.beginPath();
				for ( let i = 0; i < n; i++ ) {
					const item = items[ i ];
					ctx.moveTo( item.x, item.y );
					ctx.lineTo(
						item.x - item.len * sin,
						item.y - item.len * cos
					);
				}
				ctx.stroke();
			},
		};
	};

	/**
	 * Pairs of glowing eyes that open near the screen edges, blink and
	 * fade away again. They hide while lightning lights up the scene.
	 *
	 * @param {Object} engine Engine.
	 * @param {Object} p      { count, colors }
	 * @return {Object} Effect.
	 */
	HWT.primitives.eyes = ( engine, p ) => {
		const textures = p.colors.map( ( color ) =>
			makeGlow( 64, color, 0.3 )
		);
		const core = makeGlow( 32, '255,240,200', 0.5 );
		const items = [];

		const spawn = ( item, initial ) => {
			const side = pick( [ 'left', 'right', 'bottom' ] );
			if ( side === 'bottom' ) {
				item.x = rand( 0.15, 0.85 ) * engine.width;
				item.y = rand( 0.8, 0.93 ) * engine.height;
			} else {
				item.x =
					( side === 'left'
						? rand( 0.03, 0.14 )
						: rand( 0.86, 0.97 ) ) * engine.width;
				item.y = rand( 0.3, 0.85 ) * engine.height;
			}
			item.size = rand( 5, 8 );
			item.gap = item.size * rand( 3, 4 );
			item.texture = pick( textures );
			item.life = rand( 3, 6 );
			item.age = 0;
			item.blink = rand( 0.9, item.life - 0.9 );
			item.delay = initial ? rand( 2, 8 ) : rand( 5, 15 );
		};

		return {
			resize() {
				if ( ! items.length ) {
					for ( let i = 0; i < p.count; i++ ) {
						const item = {};
						spawn( item, true );
						items.push( item );
					}
				}
			},
			update( dt ) {
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						item.delay -= dt;
						continue;
					}
					item.age += dt;
					if ( item.age >= item.life ) {
						spawn( item, false );
					}
				}
			},
			draw( ctx ) {
				const d = engine.dpr;
				ctx.setTransform( d, 0, 0, d, 0, 0 );
				for ( let i = 0; i < items.length; i++ ) {
					const item = items[ i ];
					if ( item.delay > 0 ) {
						continue;
					}
					const fade =
						Math.min(
							1,
							item.age / 0.8,
							( item.life - item.age ) / 0.8
						) *
						( 1 - engine.light );
					const open =
						Math.abs( item.age - item.blink ) < 0.09 ? 0.12 : 1;
					const s = item.size;
					[ -1, 1 ].forEach( ( side ) => {
						const x = item.x + ( side * item.gap ) / 2;
						ctx.globalAlpha = fade * 0.9;
						ctx.drawImage(
							item.texture,
							x - s * 2.2,
							item.y - s * 1.3 * open,
							s * 4.4,
							s * 2.6 * open
						);
						ctx.globalAlpha = fade;
						ctx.drawImage(
							core,
							x - s * 0.6,
							item.y - s * 0.45 * open,
							s * 1.2,
							s * 0.9 * open
						);
					} );
				}
			},
		};
	};

	/* ------------------------------------------------------------------ *
	 * Hero behaviours
	 *
	 * init(hero, engine, first) – (re)spawns the hero.
	 * auto(hero, dt, engine)    – natural motion.
	 * free(hero, dt, engine)    – physics after release; return true to
	 *                             hand control back to auto().
	 * ------------------------------------------------------------------ */

	const physics = ( engine ) => ( {
		restitution: engine.physics.restitution || 0.4,
		spin: engine.physics.spin || 1,
		flee: engine.physics.flee || 1,
	} );

	/**
	 * Heavy object: falls, can be thrown, bounces, rolls and fades.
	 */
	HWT.behaviors.tumbler = {
		name: 'tumbler',
		interaction: 'drag',
		init( hero, engine, first ) {
			const p = hero.params;
			hero.x = rand( 0.08, 0.92 ) * engine.width;
			hero.baseX = hero.x;
			hero.y = first
				? rand( -engine.height * 0.6, engine.height * 0.35 )
				: -hero.height - rand( 0, engine.height * 0.5 );
			hero.fall = rand( p.speed[ 0 ], p.speed[ 1 ] );
			hero.phase = rand( 0, TAU );
			hero.swayAmp = rand( 8, 26 );
			hero.rot = rand( -0.4, 0.4 );
			hero.spin = rand( -0.5, 0.5 );
			hero.alpha = p.opacity;
			hero.wiggle = rand( 4, 10 );
		},
		auto( hero, dt, engine ) {
			hero.y += hero.fall * dt;
			hero.phase += dt * 1.6;
			hero.x = hero.baseX + Math.sin( hero.phase ) * hero.swayAmp;
			hero.rot += hero.spin * dt;

			// An occasional little wiggle hints that it can be grabbed.
			hero.wiggle -= dt;
			if ( hero.wiggle < 0 ) {
				hero.rot += Math.sin( hero.wiggle * 40 ) * 0.04;
				if ( hero.wiggle < -0.5 ) {
					hero.wiggle = rand( 6, 12 );
				}
			}

			if ( hero.y - hero.height > engine.height ) {
				this.init( hero, engine, false );
			}
		},
		release( hero, engine ) {
			hero.spin =
				( hero.vx / ( hero.size * 0.5 ) ) *
				0.5 *
				physics( engine ).spin;
			hero.alpha = hero.params.opacity;
		},
		free( hero, dt, engine ) {
			const ph = physics( engine );
			const r = hero.size * 0.45;
			const floor = engine.height - hero.height * 0.45;

			hero.vy += 1900 * dt;
			hero.vx *= Math.exp( -0.3 * dt );
			hero.x += hero.vx * dt;
			hero.y += hero.vy * dt;
			hero.rot += hero.spin * dt;

			if ( hero.x < r ) {
				hero.x = r;
				hero.vx = Math.abs( hero.vx ) * ph.restitution;
			} else if ( hero.x > engine.width - r ) {
				hero.x = engine.width - r;
				hero.vx = -Math.abs( hero.vx ) * ph.restitution;
			}

			if ( hero.y >= floor ) {
				hero.y = floor;
				if ( hero.vy > 140 ) {
					hero.vy = -hero.vy * ph.restitution;
					hero.vx *= 0.85;
				} else {
					hero.vy = 0;
					hero.vx *= Math.exp( -2.5 * dt );
				}
				hero.spin = ( hero.vx / r ) * 0.9;

				if ( hero.vy === 0 && Math.abs( hero.vx ) < 15 ) {
					hero.timer += dt;
					if ( hero.timer > 1.2 ) {
						hero.alpha -= dt * 1.8;
						if ( hero.alpha <= 0 ) {
							this.init( hero, engine, false );
							return true;
						}
					}
				}
			}
			return false;
		},
	};

	/**
	 * Light object: wanders, can be dragged, glides and floats upwards
	 * after release before resuming its wander.
	 */
	HWT.behaviors.floater = {
		name: 'floater',
		interaction: 'drag',
		init( hero, engine, first ) {
			const p = hero.params;
			hero.x = rand( 0.12, 0.88 ) * engine.width;
			hero.y = rand( 0.15, 0.7 ) * engine.height;
			hero.heading = rand( 0, TAU );
			hero.speed = rand( p.speed[ 0 ], p.speed[ 1 ] );
			hero.life = rand( 12, 20 );
			hero.age = 0;
			hero.bob = rand( 0, TAU );
			hero.alpha = 0;
			hero.delay = first ? rand( 0.5, 3 ) : rand( 1.5, 5 );
		},
		auto( hero, dt, engine ) {
			if ( hero.delay > 0 ) {
				hero.delay -= dt;
				hero.alpha = 0;
				return;
			}

			hero.age += dt;
			hero.bob += dt * 1.6;
			const margin = hero.size * 0.6;
			if (
				hero.x < margin ||
				hero.x > engine.width - margin ||
				hero.y < margin ||
				hero.y > engine.height * 0.85
			) {
				hero.heading = Math.atan2(
					engine.height * 0.4 - hero.y,
					engine.width / 2 - hero.x
				);
			}
			const heading = hero.heading + Math.sin( hero.age * 0.3 ) * 1.4;
			const vx = Math.cos( heading ) * hero.speed;
			hero.x += vx * dt;
			hero.y +=
				( Math.sin( heading ) * hero.speed * 0.45 +
					Math.cos( hero.bob ) * 6 ) *
				dt;
			hero.flip = vx < 0 ? -1 : 1;
			hero.rot = Math.sin( hero.bob * 0.7 ) * 0.08;
			hero.alpha =
				hero.params.opacity *
				clamp(
					Math.min( hero.age / 1.5, ( hero.life - hero.age ) / 1.5 ),
					0,
					1
				);

			if ( hero.age >= hero.life ) {
				this.init( hero, engine, false );
			}
		},
		grab( hero ) {
			hero.alpha = Math.max( hero.alpha, hero.params.opacity );
		},
		free( hero, dt, engine ) {
			const k = Math.exp( -2.4 * dt );
			hero.vx *= k;
			hero.vy = hero.vy * k - 40 * dt;
			hero.x += hero.vx * dt;
			hero.y += hero.vy * dt;
			hero.rot += ( 0 - hero.rot ) * Math.min( 1, dt * 3 );
			if ( Math.abs( hero.vx ) > 20 ) {
				hero.flip = hero.vx < 0 ? -1 : 1;
			}

			const r = hero.size / 2;
			if ( hero.x < r || hero.x > engine.width - r ) {
				hero.x = clamp( hero.x, r, engine.width - r );
				hero.vx = -hero.vx * 0.5;
			}
			if ( hero.y < r || hero.y > engine.height - r ) {
				hero.y = clamp( hero.y, r, engine.height - r );
				hero.vy = -hero.vy * 0.5;
			}

			if ( Math.hypot( hero.vx, hero.vy ) < 25 ) {
				hero.heading = rand( 0, TAU );
				hero.age = Math.min( hero.age, hero.life - 6 );
				return true;
			}
			return false;
		},
	};

	/**
	 * Hanging object on an inextensible thread: can be pulled around and
	 * swings like a pendulum when released.
	 */
	HWT.behaviors.dangler = {
		name: 'dangler',
		interaction: 'drag',
		init( hero, engine, first ) {
			const p = hero.params;
			hero.anchorX = rand( 0.06, 0.94 ) * engine.width;
			hero.x = hero.anchorX;
			hero.target = rand( 0.18, 0.5 ) * engine.height;
			hero.y = first ? rand( 0, hero.target ) : -hero.height;
			hero.speed = rand( p.speed[ 0 ], p.speed[ 1 ] );
			hero.mode = 'down';
			hero.timer = 0;
			hero.phase = rand( 0, TAU );
			hero.rot = 0;
			hero.alpha = 1;
		},
		auto( hero, dt, engine ) {
			hero.phase += dt;
			if ( hero.mode === 'down' ) {
				hero.y += hero.speed * dt;
				if ( hero.y >= hero.target ) {
					hero.mode = 'hold';
					hero.timer = rand( 3, 7 );
				}
			} else if ( hero.mode === 'hold' ) {
				hero.timer -= dt;
				hero.y = hero.target + Math.sin( hero.phase * 2.2 ) * 4;
				if ( hero.timer <= 0 ) {
					hero.mode = 'up';
				}
			} else if ( hero.mode === 'up' ) {
				hero.y -= hero.speed * 1.5 * dt;
				if ( hero.y < -hero.height ) {
					hero.mode = 'wait';
					hero.timer = rand( 2, 6 );
				}
			} else {
				hero.timer -= dt;
				if ( hero.timer <= 0 ) {
					this.init( hero, engine, false );
				}
			}
			hero.x = hero.anchorX + Math.sin( hero.phase * 1.1 ) * 2;
			hero.rot += ( 0 - hero.rot ) * Math.min( 1, dt * 4 );
		},
		dragging( hero, dt, engine ) {
			const max = engine.height * 0.9;
			const dx = hero.x - hero.anchorX;
			const dist = Math.hypot( dx, hero.y );
			if ( dist > max ) {
				hero.x = hero.anchorX + ( dx / dist ) * max;
				hero.y = ( hero.y / dist ) * max;
			}
			hero.rot = Math.atan2(
				hero.anchorX - hero.x,
				Math.max( 1, hero.y )
			);
		},
		release( hero ) {
			hero.length = Math.max(
				40,
				Math.hypot( hero.x - hero.anchorX, hero.y )
			);
		},
		free( hero, dt ) {
			hero.vy += 1400 * dt;
			const k = Math.exp( -0.9 * dt );
			hero.vx *= k;
			hero.vy *= k;
			hero.x += hero.vx * dt;
			hero.y += hero.vy * dt;

			const dx = hero.x - hero.anchorX;
			const dist = Math.hypot( dx, hero.y );
			if ( dist > hero.length ) {
				const nx = dx / dist;
				const ny = hero.y / dist;
				hero.x = hero.anchorX + nx * hero.length;
				hero.y = ny * hero.length;
				const radial = hero.vx * nx + hero.vy * ny;
				if ( radial > 0 ) {
					hero.vx -= radial * nx;
					hero.vy -= radial * ny;
				}
			}
			hero.rot = Math.atan2(
				hero.anchorX - hero.x,
				Math.max( 1, hero.y )
			);

			if (
				Math.hypot( hero.vx, hero.vy ) < 20 &&
				Math.abs( hero.x - hero.anchorX ) < 4
			) {
				hero.timer += dt;
				if ( hero.timer > 0.5 ) {
					hero.mode = 'hold';
					hero.target = hero.y;
					hero.timer = rand( 2, 5 );
					return true;
				}
			}
			return false;
		},
		keepInside( hero, engine ) {
			hero.anchorX = clamp( hero.anchorX, 10, engine.width - 10 );
			if ( hero.target > engine.height * 0.85 ) {
				hero.target = engine.height * 0.5;
			}
		},
		drawExtras( ctx, hero, engine ) {
			if ( hero.alpha <= 0.05 ) {
				return;
			}
			const reach = hero.height * 0.3;
			const endX = hero.x + Math.sin( hero.rot ) * reach;
			const endY = hero.y - Math.cos( hero.rot ) * reach;
			if ( endY <= 0 ) {
				return;
			}
			const d = engine.dpr;
			ctx.setTransform( d, 0, 0, d, 0, 0 );
			ctx.globalAlpha = 0.8 * hero.alpha;
			ctx.strokeStyle = hero.params.thread;
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.moveTo( hero.anchorX, 0 );
			ctx.lineTo( endX, endY );
			ctx.stroke();
		},
	};

	/**
	 * Skittish flyer: tapping or clicking it makes it veer away.
	 */
	HWT.behaviors.skittish = {
		name: 'skittish',
		interaction: 'tap',
		init( hero, engine, first ) {
			const p = hero.params;
			const dir = Math.random() < 0.5 ? 1 : -1;
			hero.dir = dir;
			hero.vx = rand( p.speed[ 0 ], p.speed[ 1 ] ) * dir;
			hero.vy = 0;
			hero.x = dir > 0 ? -hero.size : engine.width + hero.size;
			hero.baseY = rand( 0.08, 0.5 ) * engine.height;
			hero.y = hero.baseY;
			hero.bobAmp = rand( 10, 30 );
			hero.phase = rand( 0, TAU );
			hero.flapRate = rand( 4.5, 7 );
			hero.flapT = 0;
			hero.fleeing = false;
			hero.alpha = p.opacity;
			hero.rot = 0;
			hero.delay = first ? rand( 0, 4 ) : rand( 2, 8 );
		},
		auto( hero, dt, engine ) {
			if ( hero.delay > 0 ) {
				hero.delay -= dt;
				return;
			}

			hero.flapT += dt * ( hero.fleeing ? 13 : hero.flapRate );
			hero.frame = hero.flapT % 1 < 0.5 ? 0 : 1;

			if ( hero.fleeing ) {
				hero.vx *= 1 + dt * 0.8;
				hero.vy -= 160 * dt;
				hero.x += hero.vx * dt;
				hero.y += hero.vy * dt;
				hero.rot =
					clamp( hero.vy / 900, -0.5, 0.5 ) * Math.sign( hero.vx );
			} else {
				hero.phase += dt * 2.2;
				hero.x += hero.vx * dt;
				hero.y = hero.baseY + Math.sin( hero.phase ) * hero.bobAmp;
				hero.rot = Math.cos( hero.phase ) * 0.12 * hero.dir;
			}

			const pad = hero.size * 1.5;
			if (
				hero.x < -pad ||
				hero.x > engine.width + pad ||
				hero.y < -pad ||
				hero.y > engine.height + pad
			) {
				this.init( hero, engine, false );
			}
		},
		tap( hero, point, engine ) {
			if ( hero.fleeing ) {
				return;
			}
			const away = hero.x - point.x >= 0 ? 1 : -1;
			hero.fleeing = true;
			hero.vx = away * rand( 480, 680 ) * physics( engine ).flee;
			hero.vy = -rand( 220, 380 );
		},
		free() {
			return true;
		},
	};
} )( window, document );
