<?php
/**
 * Uninstall routine.
 *
 * Runs only when the plugin is deleted from the Plugins screen (not on
 * deactivation). Removes the single option this plugin owns – on every
 * site of a multisite network – and nothing else.
 *
 * @package HalloweenWT
 */

defined( 'WP_UNINSTALL_PLUGIN' ) || exit;

if ( is_multisite() ) {
	$halloween_wt_site_ids = get_sites(
		array(
			'fields' => 'ids',
			'number' => 0,
		)
	);

	foreach ( $halloween_wt_site_ids as $halloween_wt_site_id ) {
		switch_to_blog( (int) $halloween_wt_site_id );
		delete_option( 'halloween_wt_settings' );
		restore_current_blog();
	}
} else {
	delete_option( 'halloween_wt_settings' );
}
