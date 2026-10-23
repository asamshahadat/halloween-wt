<?php
/**
 * Front end: decides whether effects are needed and enqueues them.
 *
 * Nothing is printed into the page markup. When effects are not needed
 * no plugin asset is loaded at all.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Front-end controller.
 */
final class Halloween_WT_Frontend {

	/**
	 * Query argument used by the administrator "Preview on site" link.
	 */
	const PREVIEW_ARG = 'halloween_wt_preview';

	/**
	 * Registers hooks.
	 */
	public function register() {
		add_action( 'wp_enqueue_scripts', array( $this, 'enqueue' ) );
	}

	/**
	 * Enqueues the effect assets when required.
	 */
	public function enqueue() {
		$settings = Halloween_WT_Settings::get();
		$preview  = self::is_preview();

		if ( ! $preview && ! $this->should_load( $settings ) ) {
			return;
		}

		$args = array(
			'strategy'  => 'defer',
			'in_footer' => true,
		);

		wp_enqueue_style( 'halloween-wt-frontend', HALLOWEEN_WT_URL . 'assets/css/frontend.css', array(), HALLOWEEN_WT_VERSION );
		wp_register_script( 'halloween-wt-engine', HALLOWEEN_WT_URL . 'assets/js/engine.js', array(), HALLOWEEN_WT_VERSION, $args );
		wp_enqueue_script( 'halloween-wt-halloween', HALLOWEEN_WT_URL . 'assets/js/halloween.js', array( 'halloween-wt-engine' ), HALLOWEEN_WT_VERSION, $args );

		wp_add_inline_script(
			'halloween-wt-halloween',
			'window.halloweenWtConfig = ' . wp_json_encode( self::config( $settings, $preview ), JSON_HEX_TAG | JSON_HEX_AMP ) . ';',
			'before'
		);
	}

	/**
	 * Whether effects should run on this request.
	 *
	 * @param array $settings Settings.
	 * @return bool
	 */
	private function should_load( array $settings ) {
		$load = ! empty( $settings['general']['enabled'] )
			&& ! is_embed()
			&& ! Halloween_WT_Display_Rules::is_builder_preview()
			&& Halloween_WT_Scheduler::is_active( $settings['schedule'] )
			&& Halloween_WT_Display_Rules::matches( $settings['display'] );

		/**
		 * Filters whether Halloween WT effects load on the current request.
		 *
		 * @param bool  $load     Whether to load the effects.
		 * @param array $settings Plugin settings.
		 */
		return (bool) apply_filters( 'halloween_wt_should_load', $load, $settings );
	}

	/**
	 * Whether the current request is an administrator preview.
	 *
	 * The preview ignores the master switch, schedule and display rules so
	 * site owners can try effects before going live. It requires a valid
	 * nonce and the manage_options capability.
	 *
	 * @return bool
	 */
	public static function is_preview() {
		if ( ! isset( $_GET[ self::PREVIEW_ARG ] ) || ! is_user_logged_in() ) {
			return false;
		}

		$nonce = sanitize_text_field( wp_unslash( $_GET[ self::PREVIEW_ARG ] ) );

		return wp_verify_nonce( $nonce, 'halloween_wt_preview' ) && current_user_can( 'manage_options' );
	}

	/**
	 * Configuration passed to the browser. Contains only public,
	 * presentation-related values.
	 *
	 * @param array $settings Settings.
	 * @param bool  $preview  Whether this is an administrator preview.
	 * @return array
	 */
	public static function config( array $settings, $preview = false ) {
		$schedule = null;

		if ( ! $preview ) {
			$window = Halloween_WT_Scheduler::get_window( $settings['schedule'] );
			if ( is_array( $window ) ) {
				$schedule = array(
					'start' => $window['start']->getTimestamp() * 1000,
					'end'   => $window['end']->getTimestamp() * 1000,
				);
			}
		}

		return array(
			'assetsUrl'     => HALLOWEEN_WT_URL . 'assets/images/',
			'zIndex'        => (int) $settings['advanced']['z_index'],
			'reducedMotion' => (bool) $settings['accessibility']['reduced_motion'],
			'effects'       => $settings['effects'],
			'interactive'   => $settings['interactive'],
			'mobile'        => $settings['mobile'],
			'schedule'      => $schedule,
			'preview'       => (bool) $preview,
		);
	}
}
