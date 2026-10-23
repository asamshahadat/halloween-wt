<?php
/**
 * Plugin bootstrap.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Wires the plugin components together.
 */
final class Halloween_WT_Plugin {

	/**
	 * Singleton instance.
	 *
	 * @var Halloween_WT_Plugin|null
	 */
	private static $instance = null;

	/**
	 * Returns the plugin instance, creating it on first use.
	 *
	 * @return Halloween_WT_Plugin
	 */
	public static function instance() {
		if ( null === self::$instance ) {
			self::$instance = new self();
			self::$instance->init();
		}
		return self::$instance;
	}

	/**
	 * Registers hooks.
	 */
	private function init() {
		Halloween_WT_Settings::register_hooks();

		if ( is_admin() ) {
			( new Halloween_WT_Admin() )->register();
		} else {
			( new Halloween_WT_Frontend() )->register();
		}
	}

	/**
	 * Activation: store default settings once so they are autoloaded.
	 *
	 * Existing settings are never overwritten and the active theme is
	 * never touched.
	 */
	public static function activate() {
		if ( false === get_option( Halloween_WT_Settings::OPTION, false ) ) {
			add_option( Halloween_WT_Settings::OPTION, Halloween_WT_Settings::defaults(), '', true );
		}
	}
}
