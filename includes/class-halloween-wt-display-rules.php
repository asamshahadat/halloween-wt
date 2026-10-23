<?php
/**
 * Display rules: where on the site effects may appear.
 *
 * Uses standard conditional tags only. WooCommerce is optional; its
 * conditionals are only called when they exist.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Evaluates display targeting for the current request.
 */
final class Halloween_WT_Display_Rules {

	/**
	 * Whether effects should be shown on the current front-end request.
	 *
	 * @param array $display Display settings.
	 * @return bool
	 */
	public static function matches( array $display ) {
		if ( ! empty( $display['exclude_commerce'] ) && self::is_commerce_flow() ) {
			return false;
		}

		$object_id = self::current_object_id();

		if ( $object_id && in_array( $object_id, (array) $display['excluded'], true ) ) {
			return false;
		}

		if ( 'home' === $display['mode'] ) {
			return is_front_page();
		}

		if ( 'selected' !== $display['mode'] ) {
			return true;
		}

		if ( ! empty( $display['home'] ) && is_front_page() ) {
			return true;
		}

		// Never pass an empty array to is_page()/is_single(): it would match
		// every page/post.
		$pages = (array) $display['pages'];
		if ( $pages && ( is_page( $pages ) || ( $object_id && is_home() && in_array( $object_id, $pages, true ) ) ) ) {
			return true;
		}

		$posts = (array) $display['posts'];
		if ( $posts && is_single( $posts ) ) {
			return true;
		}

		if ( ! empty( $display['shop'] ) && self::is_shop() ) {
			return true;
		}

		if ( ! empty( $display['products'] ) && function_exists( 'is_product' ) && is_product() ) {
			return true;
		}

		return false;
	}

	/**
	 * Whether a page builder's editing canvas is being rendered, where
	 * draggable decorations would get in the way of editing.
	 *
	 * @return bool
	 */
	public static function is_builder_preview() {
		if ( class_exists( '\Elementor\Plugin' ) ) {
			$elementor = \Elementor\Plugin::$instance;
			if ( isset( $elementor->preview ) && is_object( $elementor->preview ) && method_exists( $elementor->preview, 'is_preview_mode' ) && $elementor->preview->is_preview_mode() ) {
				return true;
			}
		}

		if ( function_exists( 'et_core_is_fb_enabled' ) && et_core_is_fb_enabled() ) {
			return true;
		}

		if ( class_exists( 'FLBuilderModel' ) && method_exists( 'FLBuilderModel', 'is_builder_active' ) && FLBuilderModel::is_builder_active() ) {
			return true;
		}

		if ( function_exists( 'bricks_is_builder' ) && bricks_is_builder() ) {
			return true;
		}

		return false;
	}

	/**
	 * ID of the singular post/page (or the static posts page) being viewed.
	 *
	 * @return int
	 */
	private static function current_object_id() {
		if ( is_singular() || ( is_home() && ! is_front_page() ) ) {
			return (int) get_queried_object_id();
		}
		return 0;
	}

	/**
	 * WooCommerce shop or product archive.
	 *
	 * @return bool
	 */
	private static function is_shop() {
		return ( function_exists( 'is_shop' ) && is_shop() )
			|| ( function_exists( 'is_product_taxonomy' ) && is_product_taxonomy() );
	}

	/**
	 * Cart, checkout and account pages.
	 *
	 * @return bool
	 */
	private static function is_commerce_flow() {
		return ( function_exists( 'is_cart' ) && is_cart() )
			|| ( function_exists( 'is_checkout' ) && is_checkout() )
			|| ( function_exists( 'is_account_page' ) && is_account_page() );
	}
}
