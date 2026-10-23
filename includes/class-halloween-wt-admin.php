<?php
/**
 * Administration screen.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Settings page under Settings → Halloween WT.
 */
final class Halloween_WT_Admin {

	/**
	 * Admin page slug.
	 */
	const PAGE = 'halloween-wt';

	/**
	 * Capability required to manage the plugin.
	 */
	const CAPABILITY = 'manage_options';

	/**
	 * "Buy me a coffee" support link.
	 */
	const SUPPORT_URL = 'https://asamshahadat.gumroad.com/l/rueznx?wanted=true';

	/**
	 * Page hook suffix.
	 *
	 * @var string
	 */
	private $hook = '';

	/**
	 * Settings being rendered.
	 *
	 * @var array
	 */
	private $settings = array();

	/**
	 * Registers hooks.
	 */
	public function register() {
		add_action( 'admin_menu', array( $this, 'add_menu' ) );
		add_action( 'admin_enqueue_scripts', array( $this, 'enqueue' ) );
		add_action( 'admin_post_halloween_wt_reset_settings', array( $this, 'handle_reset' ) );
		add_filter( 'plugin_action_links_' . plugin_basename( HALLOWEEN_WT_FILE ), array( $this, 'action_links' ) );
		add_filter( 'plugin_row_meta', array( $this, 'row_meta' ), 10, 2 );
	}

	/**
	 * Adds the settings page.
	 */
	public function add_menu() {
		$this->hook = (string) add_options_page(
			__( 'Halloween WT', 'halloween-wt' ),
			__( 'Halloween WT', 'halloween-wt' ),
			self::CAPABILITY,
			self::PAGE,
			array( $this, 'render' )
		);
	}

	/**
	 * Adds a Settings link on the Plugins screen.
	 *
	 * @param string[] $links Links.
	 * @return string[]
	 */
	public function action_links( $links ) {
		$link = sprintf(
			'<a href="%s">%s</a>',
			esc_url( self::page_url() ),
			esc_html__( 'Settings', 'halloween-wt' )
		);
		array_unshift( $links, $link );
		return $links;
	}

	/**
	 * Adds a "Buy me a coffee" link to the plugin's row on the Plugins screen.
	 *
	 * @param string[] $links Links.
	 * @param string   $file  Plugin basename.
	 * @return string[]
	 */
	public function row_meta( $links, $file ) {
		if ( plugin_basename( HALLOWEEN_WT_FILE ) === $file ) {
			$links[] = sprintf(
				'<a href="%s" target="_blank" rel="noopener">%s</a>',
				esc_url( self::SUPPORT_URL ),
				esc_html__( '☕ Buy me a coffee', 'halloween-wt' )
			);
		}
		return $links;
	}

	/**
	 * Settings page URL.
	 *
	 * @return string
	 */
	public static function page_url() {
		return admin_url( 'options-general.php?page=' . self::PAGE );
	}

	/**
	 * Enqueues assets on the plugin screen only.
	 *
	 * @param string $hook Current admin page hook.
	 */
	public function enqueue( $hook ) {
		if ( '' === $this->hook || $hook !== $this->hook ) {
			return;
		}

		wp_register_style( 'halloween-wt-frontend', HALLOWEEN_WT_URL . 'assets/css/frontend.css', array(), HALLOWEEN_WT_VERSION );
		wp_enqueue_style( 'halloween-wt-admin', HALLOWEEN_WT_URL . 'assets/css/admin.css', array( 'halloween-wt-frontend' ), HALLOWEEN_WT_VERSION );

		wp_register_script( 'halloween-wt-engine', HALLOWEEN_WT_URL . 'assets/js/engine.js', array(), HALLOWEEN_WT_VERSION, true );
		wp_register_script( 'halloween-wt-halloween', HALLOWEEN_WT_URL . 'assets/js/halloween.js', array( 'halloween-wt-engine' ), HALLOWEEN_WT_VERSION, true );
		wp_enqueue_script(
			'halloween-wt-admin',
			HALLOWEEN_WT_URL . 'assets/js/admin.js',
			array( 'halloween-wt-halloween', 'wp-api-fetch', 'wp-i18n' ),
			HALLOWEEN_WT_VERSION,
			true
		);

		wp_set_script_translations( 'halloween-wt-admin', 'halloween-wt', HALLOWEEN_WT_PATH . 'languages' );

		$data = array(
			'presets'   => Halloween_WT_Settings::presets(),
			'assetsUrl' => HALLOWEEN_WT_URL . 'assets/images/',
			'option'    => Halloween_WT_Settings::OPTION,
		);

		wp_add_inline_script(
			'halloween-wt-admin',
			'window.halloweenWtAdmin = ' . wp_json_encode( $data, JSON_HEX_TAG | JSON_HEX_AMP ) . ';',
			'before'
		);
	}

	/**
	 * Resets all settings to their defaults.
	 */
	public function handle_reset() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			wp_die( esc_html__( 'Sorry, you are not allowed to manage these settings.', 'halloween-wt' ), 403 );
		}

		check_admin_referer( 'halloween_wt_reset_settings' );

		update_option( Halloween_WT_Settings::OPTION, Halloween_WT_Settings::defaults() );

		add_settings_error(
			Halloween_WT_Settings::OPTION,
			'halloween_wt_reset',
			__( 'Settings were reset to their defaults.', 'halloween-wt' ),
			'success'
		);
		set_transient( 'settings_errors', get_settings_errors(), 30 );

		wp_safe_redirect( add_query_arg( 'settings-updated', 'true', self::page_url() ) );
		exit;
	}

	/**
	 * Renders the settings page.
	 */
	public function render() {
		if ( ! current_user_can( self::CAPABILITY ) ) {
			return;
		}

		$this->settings = Halloween_WT_Settings::get();
		$status         = Halloween_WT_Scheduler::status( $this->settings );
		$preview_url    = add_query_arg( Halloween_WT_Frontend::PREVIEW_ARG, wp_create_nonce( 'halloween_wt_preview' ), home_url( '/' ) );

		include HALLOWEEN_WT_PATH . 'includes/views/settings-page.php';
	}

	// Labels.

	/**
	 * Effect labels and descriptions.
	 *
	 * @return array
	 */
	public static function effect_labels() {
		return array(
			'darkness'  => array(
				__( 'Darkness', 'halloween-wt' ),
				__( 'A gloomy vignette that darkens the screen edges. The reading area stays light.', 'halloween-wt' ),
			),
			'lightning' => array(
				__( 'Thunder & lightning', 'halloween-wt' ),
				__( 'Branching lightning bolts that light up the darkness. Never more than two flashes per strike.', 'halloween-wt' ),
			),
			'rain'      => array(
				__( 'Rain', 'halloween-wt' ),
				__( 'Slanted storm rain streaking across the page.', 'halloween-wt' ),
			),
			'clouds'    => array(
				__( 'Storm clouds', 'halloween-wt' ),
				__( 'Dark clouds drifting along the top edge.', 'halloween-wt' ),
			),
			'eyes'      => array(
				__( 'Eyes in the dark', 'halloween-wt' ),
				__( 'Glowing eyes that open near the edges, blink, and vanish.', 'halloween-wt' ),
			),
			'pumpkins'  => array(
				__( 'Pumpkins', 'halloween-wt' ),
				__( 'Glowing jack-o’-lanterns tumbling down the screen.', 'halloween-wt' ),
			),
			'bats'      => array(
				__( 'Bats', 'halloween-wt' ),
				__( 'Bats flapping across the page on wavy flight paths.', 'halloween-wt' ),
			),
			'ghosts'    => array(
				__( 'Ghosts', 'halloween-wt' ),
				__( 'Friendly translucent ghosts that drift, then fade away.', 'halloween-wt' ),
			),
			'spiders'   => array(
				__( 'Spiders', 'halloween-wt' ),
				__( 'Spiders lowering themselves on silk threads.', 'halloween-wt' ),
			),
			'webs'      => array(
				__( 'Spider webs', 'halloween-wt' ),
				__( 'Cobwebs in the top corners of the screen.', 'halloween-wt' ),
			),
			'fog'       => array(
				__( 'Fog', 'halloween-wt' ),
				__( 'Low mist along the bottom edge. It never covers the middle of the page.', 'halloween-wt' ),
			),
			'particles' => array(
				__( 'Particles', 'halloween-wt' ),
				__( 'Tiny glowing embers rising slowly.', 'halloween-wt' ),
			),
			'leaves'    => array(
				__( 'Autumn leaves', 'halloween-wt' ),
				__( 'Fluttering maple, oak and elm leaves.', 'halloween-wt' ),
			),
			'skulls'    => array(
				__( 'Skulls', 'halloween-wt' ),
				__( 'Slowly tumbling skulls for a spookier look.', 'halloween-wt' ),
			),
		);
	}

	/**
	 * Field labels for effect settings.
	 *
	 * @return array
	 */
	private static function field_labels() {
		return array(
			'quantity'  => __( 'Quantity', 'halloween-wt' ),
			'size'      => __( 'Size', 'halloween-wt' ),
			'speed'     => __( 'Speed', 'halloween-wt' ),
			'opacity'   => __( 'Opacity', 'halloween-wt' ),
			'intensity' => __( 'Intensity', 'halloween-wt' ),
			'height'    => __( 'Fog height', 'halloween-wt' ),
			'color'     => __( 'Fog color', 'halloween-wt' ),
			'frequency' => __( 'Frequency', 'halloween-wt' ),
			'bolts'     => __( 'Show lightning bolts', 'halloween-wt' ),
		);
	}

	// Field helpers (used by the view).

	/**
	 * Input name for a settings path.
	 *
	 * @param string[] $path Path.
	 * @return string
	 */
	private function field_name( array $path ) {
		return Halloween_WT_Settings::OPTION . '[' . implode( '][', $path ) . ']';
	}

	/**
	 * Element ID for a settings path.
	 *
	 * @param string[] $path Path.
	 * @return string
	 */
	private function field_id( array $path ) {
		return 'hwt-' . implode( '-', array_map( 'sanitize_html_class', $path ) );
	}

	/**
	 * Current value for a settings path.
	 *
	 * @param string[] $path Path.
	 * @return mixed
	 */
	private function field_value( array $path ) {
		$value = $this->settings;
		foreach ( $path as $key ) {
			if ( ! is_array( $value ) || ! array_key_exists( $key, $value ) ) {
				return null;
			}
			$value = $value[ $key ];
		}
		return $value;
	}

	/**
	 * Schema definition for a settings path.
	 *
	 * @param string[] $path Path.
	 * @return array
	 */
	private function field_def( array $path ) {
		$def = Halloween_WT_Settings::schema();
		foreach ( $path as $key ) {
			if ( ! isset( $def[ $key ] ) ) {
				return array();
			}
			$def = $def[ $key ];
		}
		return $def;
	}

	/**
	 * Prints a description paragraph.
	 *
	 * @param string $id          Element ID.
	 * @param string $description Text.
	 */
	private function description( $id, $description ) {
		if ( '' !== $description ) {
			printf( '<p class="description" id="%s">%s</p>', esc_attr( $id ), esc_html( $description ) );
		}
	}

	/**
	 * Renders a toggle switch (an accessible native checkbox).
	 *
	 * @param string[] $path        Path.
	 * @param string   $label       Label.
	 * @param string   $description Optional description.
	 * @param string   $extra_class Optional wrapper class.
	 */
	public function toggle( array $path, $label, $description = '', $extra_class = '' ) {
		$id = $this->field_id( $path );
		?>
		<div class="hwt-field hwt-field--toggle <?php echo esc_attr( $extra_class ); ?>">
			<label class="hwt-switch" for="<?php echo esc_attr( $id ); ?>">
				<input type="checkbox" class="hwt-switch__input" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" value="1" <?php checked( (bool) $this->field_value( $path ) ); ?><?php echo '' !== $description ? ' aria-describedby="' . esc_attr( $id . '-desc' ) . '"' : ''; ?> />
				<span class="hwt-switch__track" aria-hidden="true"></span>
				<span class="hwt-switch__label"><?php echo esc_html( $label ); ?></span>
			</label>
			<?php $this->description( $id . '-desc', $description ); ?>
		</div>
		<?php
	}

	/**
	 * Renders a range slider with live value output.
	 *
	 * @param string[] $path  Path.
	 * @param string   $label Label.
	 * @param string   $unit  Unit suffix shown next to the value.
	 */
	public function range( array $path, $label, $unit = '' ) {
		$id    = $this->field_id( $path );
		$def   = $this->field_def( $path );
		$value = (int) $this->field_value( $path );
		?>
		<div class="hwt-field hwt-field--range">
			<label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<div class="hwt-range">
				<input type="range" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" min="<?php echo esc_attr( $def['min'] ); ?>" max="<?php echo esc_attr( $def['max'] ); ?>" step="1" value="<?php echo esc_attr( $value ); ?>" data-unit="<?php echo esc_attr( $unit ); ?>" />
				<output for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $value . $unit ); ?></output>
			</div>
		</div>
		<?php
	}

	/**
	 * Renders a number input.
	 *
	 * @param string[] $path        Path.
	 * @param string   $label       Label.
	 * @param string   $description Description.
	 */
	public function number( array $path, $label, $description = '' ) {
		$id  = $this->field_id( $path );
		$def = $this->field_def( $path );
		?>
		<div class="hwt-field hwt-field--number">
			<label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<input type="number" class="small-text" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" min="<?php echo esc_attr( $def['min'] ); ?>" max="<?php echo esc_attr( $def['max'] ); ?>" step="1" value="<?php echo esc_attr( (int) $this->field_value( $path ) ); ?>"<?php echo '' !== $description ? ' aria-describedby="' . esc_attr( $id . '-desc' ) . '"' : ''; ?> />
			<?php $this->description( $id . '-desc', $description ); ?>
		</div>
		<?php
	}

	/**
	 * Renders a group of radio buttons styled as a segmented control.
	 *
	 * @param string[] $path        Path.
	 * @param string   $legend      Legend.
	 * @param array    $choices     Value => label.
	 * @param string   $description Description.
	 */
	public function radios( array $path, $legend, array $choices, $description = '' ) {
		$id      = $this->field_id( $path );
		$current = (string) $this->field_value( $path );
		?>
		<fieldset class="hwt-field hwt-field--radios"<?php echo '' !== $description ? ' aria-describedby="' . esc_attr( $id . '-desc' ) . '"' : ''; ?>>
			<legend><?php echo esc_html( $legend ); ?></legend>
			<div class="hwt-segmented">
				<?php foreach ( $choices as $value => $label ) : ?>
					<label class="hwt-segmented__option">
						<input type="radio" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" value="<?php echo esc_attr( $value ); ?>" <?php checked( $current, (string) $value ); ?> />
						<span class="hwt-segmented__label"><?php echo esc_html( $label ); ?></span>
					</label>
				<?php endforeach; ?>
			</div>
			<?php $this->description( $id . '-desc', $description ); ?>
		</fieldset>
		<?php
	}

	/**
	 * Renders a native colour picker.
	 *
	 * @param string[] $path  Path.
	 * @param string   $label Label.
	 */
	public function color( array $path, $label ) {
		$id = $this->field_id( $path );
		?>
		<div class="hwt-field hwt-field--color">
			<label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<input type="color" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" value="<?php echo esc_attr( (string) $this->field_value( $path ) ); ?>" />
		</div>
		<?php
	}

	/**
	 * Renders a date input.
	 *
	 * @param string[] $path  Path.
	 * @param string   $label Label.
	 */
	public function date( array $path, $label ) {
		$id = $this->field_id( $path );
		?>
		<div class="hwt-field hwt-field--date">
			<label for="<?php echo esc_attr( $id ); ?>"><?php echo esc_html( $label ); ?></label>
			<input type="date" id="<?php echo esc_attr( $id ); ?>" name="<?php echo esc_attr( $this->field_name( $path ) ); ?>" value="<?php echo esc_attr( (string) $this->field_value( $path ) ); ?>" />
		</div>
		<?php
	}

	/**
	 * Renders a searchable post/page picker.
	 *
	 * @param string[] $path        Path.
	 * @param string   $label       Label.
	 * @param string   $subtypes    Comma separated post types to search.
	 * @param string   $description Description.
	 */
	public function picker( array $path, $label, $subtypes, $description = '' ) {
		$id   = $this->field_id( $path );
		$name = $this->field_name( $path ) . '[]';
		$ids  = (array) $this->field_value( $path );
		?>
		<div class="hwt-field hwt-picker" data-subtype="<?php echo esc_attr( $subtypes ); ?>" data-name="<?php echo esc_attr( $name ); ?>">
			<label for="<?php echo esc_attr( $id ); ?>-search"><?php echo esc_html( $label ); ?></label>
			<ul class="hwt-picker__list">
				<?php
				foreach ( $ids as $post_id ) :
					$title = get_the_title( (int) $post_id );
					/* translators: %d: post ID. */
					$title = '' !== $title ? $title : sprintf( __( '#%d (no title)', 'halloween-wt' ), (int) $post_id );
					?>
					<li class="hwt-picker__item">
						<input type="hidden" name="<?php echo esc_attr( $name ); ?>" value="<?php echo esc_attr( (int) $post_id ); ?>" />
						<span class="hwt-picker__title"><?php echo esc_html( $title ); ?></span>
						<button type="button" class="hwt-picker__remove button-link" aria-label="<?php /* translators: %s: page or post title. */ echo esc_attr( sprintf( __( 'Remove %s', 'halloween-wt' ), $title ) ); ?>">&times;</button>
					</li>
				<?php endforeach; ?>
			</ul>
			<div class="hwt-picker__search-wrap">
				<input type="search" class="regular-text hwt-picker__search" id="<?php echo esc_attr( $id ); ?>-search" autocomplete="off" placeholder="<?php esc_attr_e( 'Search by title…', 'halloween-wt' ); ?>" role="combobox" aria-expanded="false" aria-controls="<?php echo esc_attr( $id ); ?>-results" aria-autocomplete="list"<?php echo '' !== $description ? ' aria-describedby="' . esc_attr( $id . '-desc' ) . '"' : ''; ?> />
				<ul class="hwt-picker__results" id="<?php echo esc_attr( $id ); ?>-results" role="listbox" hidden></ul>
			</div>
			<?php $this->description( $id . '-desc', $description ); ?>
		</div>
		<?php
	}

	/**
	 * Renders an effect card with its toggle and controls.
	 *
	 * @param string $key Effect key.
	 */
	public function effect_card( $key ) {
		$labels = self::effect_labels();
		$fields = self::field_labels();
		$schema = Halloween_WT_Settings::schema();

		if ( ! isset( $labels[ $key ], $schema['effects'][ $key ] ) ) {
			return;
		}

		$path = array( 'effects', $key );
		?>
		<div class="hwt-card hwt-effect" data-effect="<?php echo esc_attr( $key ); ?>">
			<div class="hwt-effect__head">
				<span class="hwt-effect__icon hwt-effect__icon--<?php echo esc_attr( $key ); ?>" aria-hidden="true"></span>
				<?php $this->toggle( array_merge( $path, array( 'enabled' ) ), $labels[ $key ][0], $labels[ $key ][1], 'hwt-effect__toggle' ); ?>
			</div>
			<div class="hwt-effect__body">
				<?php
				foreach ( $schema['effects'][ $key ] as $field => $def ) {
					$field_path = array_merge( $path, array( $field ) );
					$label      = isset( $fields[ $field ] ) ? $fields[ $field ] : $field;

					if ( 'enabled' === $field ) {
						continue;
					}

					if ( 'color' === $def['type'] ) {
						$this->color( $field_path, 'darkness' === $key ? __( 'Shadow color', 'halloween-wt' ) : $label );
					} elseif ( 'bool' === $def['type'] ) {
						$this->toggle( $field_path, $label );
					} elseif ( 'frequency' === $field ) {
						$this->radios(
							$field_path,
							$label,
							array(
								'rare'       => __( 'Rare', 'halloween-wt' ),
								'occasional' => __( 'Occasional', 'halloween-wt' ),
								'frequent'   => __( 'Frequent', 'halloween-wt' ),
							)
						);
					} elseif ( 'int' === $def['type'] ) {
						$this->range( $field_path, $label, 'quantity' === $field ? '' : '%' );
					}
				}
				?>
			</div>
		</div>
		<?php
	}
}
