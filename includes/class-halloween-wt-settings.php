<?php
/**
 * Settings schema, defaults, presets and sanitisation.
 *
 * All settings live in a single autoloaded option. The schema below is
 * the single source of truth for defaults, validation and the admin UI.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Settings model.
 */
final class Halloween_WT_Settings {

	/**
	 * Option name.
	 */
	const OPTION = 'halloween_wt_settings';

	/**
	 * Settings group used by the Settings API.
	 */
	const GROUP = 'halloween_wt_settings_group';

	/**
	 * Schema version, stored with the settings for future migrations.
	 */
	const SCHEMA_VERSION = 1;

	/**
	 * Maximum number of IDs accepted in a page/post list.
	 */
	const MAX_IDS = 500;

	/**
	 * Per-request cache of merged settings.
	 *
	 * @var array|null
	 */
	private static $cache = null;

	/**
	 * Whether validation notices were already added in this request.
	 *
	 * @var bool
	 */
	private static $reported = false;

	/**
	 * Registers hooks shared by admin and front end.
	 */
	public static function register_hooks() {
		add_action( 'admin_init', array( __CLASS__, 'register_setting' ) );
		add_action( 'add_option_' . self::OPTION, array( __CLASS__, 'flush' ) );
		add_action( 'update_option_' . self::OPTION, array( __CLASS__, 'flush' ) );
		add_action( 'delete_option_' . self::OPTION, array( __CLASS__, 'flush' ) );
	}

	/**
	 * Registers the option with the Settings API.
	 */
	public static function register_setting() {
		register_setting(
			self::GROUP,
			self::OPTION,
			array(
				'type'              => 'array',
				'sanitize_callback' => array( __CLASS__, 'sanitize' ),
				'default'           => self::defaults(),
				'show_in_rest'      => false,
			)
		);
	}

	/**
	 * Clears the per-request cache.
	 */
	public static function flush() {
		self::$cache = null;
	}

	// Schema.

	/**
	 * Boolean field definition.
	 *
	 * @param bool $default_value Default.
	 * @return array
	 */
	private static function boolean( $default_value ) {
		return array(
			'type'    => 'bool',
			'default' => (bool) $default_value,
		);
	}

	/**
	 * Integer field definition.
	 *
	 * @param int $default_value Default.
	 * @param int $min           Minimum.
	 * @param int $max           Maximum.
	 * @return array
	 */
	private static function integer( $default_value, $min, $max ) {
		return array(
			'type'    => 'int',
			'default' => (int) $default_value,
			'min'     => (int) $min,
			'max'     => (int) $max,
		);
	}

	/**
	 * Enumeration field definition.
	 *
	 * @param string   $default_value Default.
	 * @param string[] $options       Allowed values.
	 * @return array
	 */
	private static function choice( $default_value, array $options ) {
		return array(
			'type'    => 'enum',
			'default' => $default_value,
			'options' => $options,
		);
	}

	/**
	 * Post ID list field definition.
	 *
	 * @param string[] $post_types Allowed post types.
	 * @return array
	 */
	private static function ids( array $post_types ) {
		return array(
			'type'       => 'ids',
			'default'    => array(),
			'post_types' => $post_types,
		);
	}

	/**
	 * Returns the settings schema.
	 *
	 * Field definitions contain a "type" key; anything else is a group.
	 *
	 * @return array
	 */
	public static function schema() {
		$year = gmdate( 'Y' );

		return array(
			'general'       => array(
				'enabled' => self::boolean( true ),
				'preset'  => self::choice( 'normal', array( 'subtle', 'normal', 'spooky', 'insane', 'custom' ) ),
			),
			'effects'       => array(
				'pumpkins'  => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 10, 0, 40 ),
					'size'     => self::integer( 100, 50, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
					'opacity'  => self::integer( 100, 10, 100 ),
				),
				'bats'      => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 5, 0, 30 ),
					'size'     => self::integer( 100, 50, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
				),
				'ghosts'    => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 3, 0, 15 ),
					'size'     => self::integer( 100, 50, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
					'opacity'  => self::integer( 70, 10, 100 ),
				),
				'spiders'   => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 2, 0, 8 ),
					'size'     => self::integer( 100, 50, 200 ),
				),
				'webs'      => array(
					'enabled' => self::boolean( true ),
					'size'    => self::integer( 100, 50, 200 ),
					'opacity' => self::integer( 70, 10, 100 ),
				),
				'fog'       => array(
					'enabled'   => self::boolean( true ),
					'intensity' => self::integer( 40, 5, 100 ),
					'height'    => self::integer( 22, 10, 40 ),
					'color'     => array(
						'type'    => 'color',
						'default' => '#cdc8dc',
					),
				),
				'particles' => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 45, 0, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
				),
				'lightning' => array(
					'enabled'   => self::boolean( true ),
					'frequency' => self::choice( 'occasional', array( 'rare', 'occasional', 'frequent' ) ),
					'intensity' => self::integer( 60, 10, 100 ),
					'bolts'     => self::boolean( true ),
				),
				'leaves'    => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 14, 0, 60 ),
					'size'     => self::integer( 100, 50, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
				),
				'skulls'    => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 3, 0, 20 ),
					'size'     => self::integer( 100, 50, 200 ),
					'speed'    => self::integer( 100, 25, 300 ),
					'opacity'  => self::integer( 100, 10, 100 ),
				),
				'darkness'  => array(
					'enabled'   => self::boolean( true ),
					'intensity' => self::integer( 50, 5, 85 ),
					'color'     => array(
						'type'    => 'color',
						'default' => '#0c0820',
					),
				),
				'rain'      => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 90, 0, 300 ),
					'speed'    => self::integer( 100, 25, 300 ),
				),
				'clouds'    => array(
					'enabled'   => self::boolean( true ),
					'intensity' => self::integer( 50, 5, 100 ),
				),
				'eyes'      => array(
					'enabled'  => self::boolean( true ),
					'quantity' => self::integer( 2, 0, 6 ),
				),
			),
			'interactive'   => array(
				'enabled'     => self::boolean( true ),
				'pumpkins'    => self::boolean( true ),
				'ghosts'      => self::boolean( true ),
				'spiders'     => self::boolean( true ),
				'bats'        => self::boolean( true ),
				'max_objects' => self::integer( 4, 1, 8 ),
				'intensity'   => self::choice( 'normal', array( 'subtle', 'normal', 'playful' ) ),
			),
			'mobile'        => array(
				'enabled'     => self::boolean( true ),
				'interactive' => self::boolean( true ),
				'density'     => self::choice( 'low', array( 'low', 'medium', 'high' ) ),
			),
			'accessibility' => array(
				'reduced_motion' => self::boolean( true ),
			),
			'display'       => array(
				'mode'             => self::choice( 'all', array( 'all', 'home', 'selected' ) ),
				'home'             => self::boolean( true ),
				'pages'            => self::ids( array( 'page' ) ),
				'posts'            => self::ids( array( 'post' ) ),
				'shop'             => self::boolean( false ),
				'products'         => self::boolean( false ),
				'excluded'         => self::ids( array( 'page', 'post' ) ),
				'exclude_commerce' => self::boolean( true ),
			),
			'schedule'      => array(
				'mode'   => self::choice( 'always', array( 'always', 'range' ) ),
				'start'  => array(
					'type'    => 'date',
					'default' => $year . '-10-20',
				),
				'end'    => array(
					'type'    => 'date',
					'default' => $year . '-11-01',
				),
				'annual' => self::boolean( true ),
			),
			'advanced'      => array(
				'z_index' => self::integer( 9990, 1, 2147483000 ),
			),
		);
	}

	/**
	 * Effect presets. Each preset only touches effect quantities, speeds,
	 * intensities and the interaction feel; everything remains editable.
	 *
	 * @return array
	 */
	public static function presets() {
		return array(
			'subtle' => array(
				'effects'     => array(
					'pumpkins'  => array(
						'enabled'  => true,
						'quantity' => 6,
						'speed'    => 80,
					),
					'bats'      => array(
						'enabled'  => true,
						'quantity' => 3,
						'speed'    => 80,
					),
					'ghosts'    => array(
						'enabled'  => true,
						'quantity' => 2,
						'opacity'  => 55,
					),
					'spiders'   => array(
						'enabled'  => true,
						'quantity' => 1,
					),
					'webs'      => array(
						'enabled' => true,
						'opacity' => 50,
					),
					'fog'       => array(
						'enabled'   => true,
						'intensity' => 25,
						'height'    => 18,
					),
					'particles' => array(
						'enabled'  => true,
						'quantity' => 25,
					),
					'lightning' => array( 'enabled' => false ),
					'leaves'    => array(
						'enabled'  => true,
						'quantity' => 8,
					),
					'skulls'    => array( 'enabled' => false ),
					'darkness'  => array(
						'enabled'   => true,
						'intensity' => 30,
					),
					'rain'      => array( 'enabled' => false ),
					'clouds'    => array( 'enabled' => false ),
					'eyes'      => array( 'enabled' => false ),
				),
				'interactive' => array( 'intensity' => 'subtle' ),
			),
			'normal' => array(
				'effects'     => array(
					'pumpkins'  => array(
						'enabled'  => true,
						'quantity' => 10,
						'speed'    => 100,
					),
					'bats'      => array(
						'enabled'  => true,
						'quantity' => 5,
						'speed'    => 100,
					),
					'ghosts'    => array(
						'enabled'  => true,
						'quantity' => 3,
						'opacity'  => 70,
					),
					'spiders'   => array(
						'enabled'  => true,
						'quantity' => 2,
					),
					'webs'      => array(
						'enabled' => true,
						'opacity' => 70,
					),
					'fog'       => array(
						'enabled'   => true,
						'intensity' => 40,
						'height'    => 22,
					),
					'particles' => array(
						'enabled'  => true,
						'quantity' => 45,
					),
					'lightning' => array(
						'enabled'   => true,
						'frequency' => 'occasional',
						'intensity' => 60,
						'bolts'     => true,
					),
					'leaves'    => array(
						'enabled'  => true,
						'quantity' => 14,
					),
					'skulls'    => array(
						'enabled'  => true,
						'quantity' => 3,
					),
					'darkness'  => array(
						'enabled'   => true,
						'intensity' => 50,
					),
					'rain'      => array(
						'enabled'  => true,
						'quantity' => 90,
					),
					'clouds'    => array(
						'enabled'   => true,
						'intensity' => 50,
					),
					'eyes'      => array(
						'enabled'  => true,
						'quantity' => 2,
					),
				),
				'interactive' => array( 'intensity' => 'normal' ),
			),
			'spooky' => array(
				'effects'     => array(
					'pumpkins'  => array(
						'enabled'  => true,
						'quantity' => 14,
						'speed'    => 110,
					),
					'bats'      => array(
						'enabled'  => true,
						'quantity' => 9,
						'speed'    => 115,
					),
					'ghosts'    => array(
						'enabled'  => true,
						'quantity' => 5,
						'opacity'  => 80,
					),
					'spiders'   => array(
						'enabled'  => true,
						'quantity' => 3,
					),
					'webs'      => array(
						'enabled' => true,
						'opacity' => 85,
					),
					'fog'       => array(
						'enabled'   => true,
						'intensity' => 60,
						'height'    => 28,
					),
					'particles' => array(
						'enabled'  => true,
						'quantity' => 70,
					),
					'lightning' => array(
						'enabled'   => true,
						'frequency' => 'occasional',
						'intensity' => 75,
						'bolts'     => true,
					),
					'leaves'    => array(
						'enabled'  => true,
						'quantity' => 18,
					),
					'skulls'    => array(
						'enabled'  => true,
						'quantity' => 5,
					),
					'darkness'  => array(
						'enabled'   => true,
						'intensity' => 65,
					),
					'rain'      => array(
						'enabled'  => true,
						'quantity' => 140,
					),
					'clouds'    => array(
						'enabled'   => true,
						'intensity' => 65,
					),
					'eyes'      => array(
						'enabled'  => true,
						'quantity' => 3,
					),
				),
				'interactive' => array( 'intensity' => 'normal' ),
			),
			'insane' => array(
				'effects'     => array(
					'pumpkins'  => array(
						'enabled'  => true,
						'quantity' => 24,
						'speed'    => 140,
					),
					'bats'      => array(
						'enabled'  => true,
						'quantity' => 16,
						'speed'    => 140,
					),
					'ghosts'    => array(
						'enabled'  => true,
						'quantity' => 8,
						'opacity'  => 85,
					),
					'spiders'   => array(
						'enabled'  => true,
						'quantity' => 5,
					),
					'webs'      => array(
						'enabled' => true,
						'opacity' => 100,
					),
					'fog'       => array(
						'enabled'   => true,
						'intensity' => 75,
						'height'    => 34,
					),
					'particles' => array(
						'enabled'  => true,
						'quantity' => 120,
					),
					'lightning' => array(
						'enabled'   => true,
						'frequency' => 'frequent',
						'intensity' => 85,
						'bolts'     => true,
					),
					'leaves'    => array(
						'enabled'  => true,
						'quantity' => 30,
					),
					'skulls'    => array(
						'enabled'  => true,
						'quantity' => 10,
					),
					'darkness'  => array(
						'enabled'   => true,
						'intensity' => 80,
					),
					'rain'      => array(
						'enabled'  => true,
						'quantity' => 220,
					),
					'clouds'    => array(
						'enabled'   => true,
						'intensity' => 80,
					),
					'eyes'      => array(
						'enabled'  => true,
						'quantity' => 5,
					),
				),
				'interactive' => array( 'intensity' => 'playful' ),
			),
		);
	}

	// Reading.

	/**
	 * Default settings.
	 *
	 * @return array
	 */
	public static function defaults() {
		$defaults                   = self::collect_defaults( self::schema() );
		$defaults['schema_version'] = self::SCHEMA_VERSION;
		return $defaults;
	}

	/**
	 * Recursively collects schema defaults.
	 *
	 * @param array $schema Schema node.
	 * @return array
	 */
	private static function collect_defaults( array $schema ) {
		$out = array();
		foreach ( $schema as $key => $def ) {
			$out[ $key ] = isset( $def['type'] ) ? $def['default'] : self::collect_defaults( $def );
		}
		return $out;
	}

	/**
	 * Returns the current settings merged over the defaults.
	 *
	 * Stored values are re-validated (without database lookups) so that a
	 * value edited outside the settings screen can never cause type errors.
	 *
	 * @return array
	 */
	public static function get() {
		if ( null === self::$cache ) {
			$saved       = get_option( self::OPTION, array() );
			self::$cache = self::sanitize_node( self::schema(), is_array( $saved ) ? $saved : array(), false );
		}
		return self::$cache;
	}

	// Sanitisation.

	/**
	 * Sanitize callback for register_setting().
	 *
	 * @param mixed $input Raw input.
	 * @return array
	 */
	public static function sanitize( $input ) {
		$input                   = is_array( $input ) ? $input : array();
		$clean                   = self::sanitize_node( self::schema(), $input, true );
		$clean['schema_version'] = self::SCHEMA_VERSION;

		self::validate( $clean );

		return $clean;
	}

	/**
	 * Sanitises a schema node.
	 *
	 * @param array $schema   Schema node.
	 * @param mixed $input    Input for this node.
	 * @param bool  $is_input True when sanitising submitted input (missing
	 *                        booleans mean "off"), false when reading stored
	 *                        values (missing keys fall back to defaults).
	 * @return array
	 */
	private static function sanitize_node( array $schema, $input, $is_input ) {
		$input = is_array( $input ) ? $input : array();
		$out   = array();

		foreach ( $schema as $key => $def ) {
			if ( ! isset( $def['type'] ) ) {
				$out[ $key ] = self::sanitize_node( $def, isset( $input[ $key ] ) ? $input[ $key ] : array(), $is_input );
				continue;
			}

			if ( ! array_key_exists( $key, $input ) ) {
				// An unchecked checkbox is not submitted at all.
				$out[ $key ] = ( $is_input && 'bool' === $def['type'] ) ? false : $def['default'];
				continue;
			}

			$out[ $key ] = self::sanitize_field( $def, $input[ $key ], $is_input );
		}

		return $out;
	}

	/**
	 * Sanitises a single value according to its definition.
	 *
	 * @param array $def      Field definition.
	 * @param mixed $value    Raw value.
	 * @param bool  $is_input Whether the value comes from a form submission.
	 * @return mixed
	 */
	private static function sanitize_field( array $def, $value, $is_input ) {
		switch ( $def['type'] ) {
			case 'bool':
				return (bool) rest_sanitize_boolean( is_scalar( $value ) ? $value : false );

			case 'int':
				if ( ! is_numeric( $value ) ) {
					return $def['default'];
				}
				return max( $def['min'], min( $def['max'], (int) round( (float) $value ) ) );

			case 'enum':
				$value = is_string( $value ) ? sanitize_key( $value ) : '';
				return in_array( $value, $def['options'], true ) ? $value : $def['default'];

			case 'color':
				$color = is_string( $value ) ? sanitize_hex_color( $value ) : '';
				return $color ? $color : $def['default'];

			case 'date':
				return self::sanitize_date( $value );

			case 'ids':
				return self::sanitize_ids( $value, $def['post_types'], $is_input );
		}

		return $def['default'];
	}

	/**
	 * Validates a Y-m-d date string.
	 *
	 * @param mixed $value Raw value.
	 * @return string Valid date or empty string.
	 */
	private static function sanitize_date( $value ) {
		$value = is_string( $value ) ? sanitize_text_field( $value ) : '';

		if ( ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $value, $m ) ) {
			return '';
		}

		return checkdate( (int) $m[2], (int) $m[3], (int) $m[1] ) ? $value : '';
	}

	/**
	 * Sanitises a list of post IDs.
	 *
	 * @param mixed    $value      Raw value.
	 * @param string[] $post_types Allowed post types.
	 * @param bool     $verify     Whether to confirm the posts exist.
	 * @return int[]
	 */
	private static function sanitize_ids( $value, array $post_types, $verify ) {
		if ( ! is_array( $value ) ) {
			return array();
		}

		$ids = array_values( array_unique( array_filter( array_map( 'absint', $value ) ) ) );
		$ids = array_slice( $ids, 0, self::MAX_IDS );

		if ( ! $verify || ! $ids ) {
			return $ids;
		}

		$found = get_posts(
			array(
				'post__in'               => $ids,
				'post_type'              => $post_types,
				'post_status'            => 'any',
				'fields'                 => 'ids',
				'posts_per_page'         => count( $ids ),
				'orderby'                => 'post__in',
				'no_found_rows'          => true,
				'update_post_meta_cache' => false,
				'update_post_term_cache' => false,
				'suppress_filters'       => false,
			)
		);

		return array_map( 'intval', $found );
	}

	/**
	 * Cross-field validation with admin notices.
	 *
	 * @param array $clean Sanitised settings.
	 */
	private static function validate( array $clean ) {
		if ( self::$reported || 'range' !== $clean['schedule']['mode'] ) {
			return;
		}

		$schedule = $clean['schedule'];

		if ( '' === $schedule['start'] || '' === $schedule['end'] ) {
			self::$reported = true;
			add_settings_error(
				self::OPTION,
				'halloween_wt_schedule_missing',
				__( 'Please choose both a start and an end date for the schedule. Effects stay off until the schedule is valid.', 'halloween-wt' ),
				'error'
			);
			return;
		}

		if ( empty( $schedule['annual'] ) && $schedule['start'] > $schedule['end'] ) {
			self::$reported = true;
			add_settings_error(
				self::OPTION,
				'halloween_wt_schedule_order',
				__( 'The schedule end date is before the start date. Effects stay off until the schedule is valid.', 'halloween-wt' ),
				'error'
			);
		}
	}
}
