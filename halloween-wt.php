<?php
/**
 * Plugin Name:       Halloween WT – Interactive Halloween Effects
 * Description:       Turns your site into a dark, stormy Halloween night – lightning, rain, glowing eyes, ghosts, bats and pumpkins visitors can grab and throw – without touching your theme or content.
 * Version:           1.0.0
 * Requires at least: 6.3
 * Requires PHP:      7.4
 * Author:            Shahadat
 * Author URI:        https://shahadatdev.com/
 * License:           GPL-2.0-or-later
 * License URI:       https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain:       halloween-wt
 * Domain Path:       /languages
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

define( 'HALLOWEEN_WT_VERSION', '1.0.0' );
define( 'HALLOWEEN_WT_FILE', __FILE__ );
define( 'HALLOWEEN_WT_PATH', plugin_dir_path( __FILE__ ) );
define( 'HALLOWEEN_WT_URL', plugin_dir_url( __FILE__ ) );

require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-settings.php';
require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-scheduler.php';
require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-display-rules.php';
require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-frontend.php';
require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-admin.php';
require_once HALLOWEEN_WT_PATH . 'includes/class-halloween-wt-plugin.php';

register_activation_hook( __FILE__, array( 'Halloween_WT_Plugin', 'activate' ) );

add_action( 'plugins_loaded', array( 'Halloween_WT_Plugin', 'instance' ) );
