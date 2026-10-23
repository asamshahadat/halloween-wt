<?php
/**
 * Settings page template.
 *
 * Rendered by Halloween_WT_Admin::render(); $this refers to the Halloween_WT_Admin instance.
 *
 * @package HalloweenWT
 *
 * @var Halloween_WT_Admin $this
 * @var array     $status      Schedule status from Halloween_WT_Scheduler::status().
 * @var string    $preview_url Nonce-protected front-end preview URL.
 */

defined( 'ABSPATH' ) || exit;

$halloween_wt_date_format = get_option( 'date_format' );
$halloween_wt_state       = $status['state'];

switch ( $halloween_wt_state ) {
	case 'off':
		$halloween_wt_status_label = __( 'Effects are switched off', 'halloween-wt' );
		$halloween_wt_status_text  = __( 'Visitors do not see any effects and no plugin files are loaded on your site.', 'halloween-wt' );
		break;
	case 'scheduled':
		$halloween_wt_status_label = __( 'Scheduled', 'halloween-wt' );
		$halloween_wt_status_text  = sprintf(
			/* translators: 1: start date, 2: end date. */
			__( 'Effects will run from %1$s until %2$s.', 'halloween-wt' ),
			wp_date( $halloween_wt_date_format, $status['start']->getTimestamp() ),
			wp_date( $halloween_wt_date_format, $status['end']->getTimestamp() )
		);
		break;
	case 'ended':
		$halloween_wt_status_label = __( 'Schedule ended', 'halloween-wt' );
		$halloween_wt_status_text  = __( 'The scheduled period is over. Choose new dates or turn on "Repeat every year".', 'halloween-wt' );
		break;
	case 'invalid':
		$halloween_wt_status_label = __( 'Schedule needs attention', 'halloween-wt' );
		$halloween_wt_status_text  = __( 'The schedule dates are incomplete or out of order, so effects stay off.', 'halloween-wt' );
		break;
	default:
		$halloween_wt_status_label = __( 'Live on your site', 'halloween-wt' );
		$halloween_wt_status_text  = $status['end']
			? sprintf(
				/* translators: %s: end date. */
				__( 'Effects are running until %s (subject to your display rules).', 'halloween-wt' ),
				wp_date( $halloween_wt_date_format, $status['end']->getTimestamp() )
			)
			: __( 'Effects are running (subject to your display rules).', 'halloween-wt' );
}

$halloween_wt_tabs = array(
	'general'     => __( 'General', 'halloween-wt' ),
	'effects'     => __( 'Effects', 'halloween-wt' ),
	'interactive' => __( 'Interactive', 'halloween-wt' ),
	'display'     => __( 'Display & schedule', 'halloween-wt' ),
	'devices'     => __( 'Mobile & accessibility', 'halloween-wt' ),
	'advanced'    => __( 'Advanced', 'halloween-wt' ),
);
?>
<div class="wrap hwt-admin">
	<h1 class="hwt-admin__title">
		<span class="hwt-admin__logo" aria-hidden="true"></span>
		<?php esc_html_e( 'Halloween WT', 'halloween-wt' ); ?>
	</h1>

	<div class="hwt-status hwt-status--<?php echo esc_attr( $halloween_wt_state ); ?>">
		<span class="hwt-status__dot" aria-hidden="true"></span>
		<div>
			<strong><?php echo esc_html( $halloween_wt_status_label ); ?></strong>
			<span><?php echo esc_html( $halloween_wt_status_text ); ?></span>
		</div>
		<a class="button" href="<?php echo esc_url( $preview_url ); ?>" target="_blank" rel="noopener">
			<?php esc_html_e( 'Preview on site', 'halloween-wt' ); ?>
			<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'halloween-wt' ); ?></span>
		</a>
	</div>

	<div class="hwt-layout">
		<div class="hwt-layout__main">
			<form method="post" action="options.php" id="hwt-settings-form" class="hwt-form">
				<?php settings_fields( Halloween_WT_Settings::GROUP ); ?>

				<div class="hwt-tabs" role="tablist" aria-label="<?php esc_attr_e( 'Settings sections', 'halloween-wt' ); ?>">
					<?php foreach ( $halloween_wt_tabs as $halloween_wt_tab => $halloween_wt_tab_label ) : ?>
						<button type="button" class="hwt-tabs__tab" role="tab" id="hwt-tab-<?php echo esc_attr( $halloween_wt_tab ); ?>" aria-controls="hwt-panel-<?php echo esc_attr( $halloween_wt_tab ); ?>" aria-selected="false" tabindex="-1">
							<?php echo esc_html( $halloween_wt_tab_label ); ?>
						</button>
					<?php endforeach; ?>
				</div>

				<?php /* General. */ ?>
				<section class="hwt-panel" id="hwt-panel-general" role="tabpanel" aria-labelledby="hwt-tab-general">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'General', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->toggle(
							array( 'general', 'enabled' ),
							__( 'Enable Halloween effects', 'halloween-wt' ),
							__( 'Master switch. When off, nothing is loaded on your site.', 'halloween-wt' )
						);
						?>
					</div>
					<div class="hwt-card">
						<?php
						$this->radios(
							array( 'general', 'preset' ),
							__( 'Intensity preset', 'halloween-wt' ),
							array(
								'subtle' => __( 'Subtle', 'halloween-wt' ),
								'normal' => __( 'Normal', 'halloween-wt' ),
								'spooky' => __( 'Spooky', 'halloween-wt' ),
								'insane' => __( 'Insane', 'halloween-wt' ),
								'custom' => __( 'Custom', 'halloween-wt' ),
							),
							__( 'Choosing a preset fills in the effect settings for you. You can fine-tune everything afterwards. Even "Insane" stays within safe performance limits.', 'halloween-wt' )
						);
						?>
					</div>
				</section>

				<?php /* Effects. */ ?>
				<section class="hwt-panel" id="hwt-panel-effects" role="tabpanel" aria-labelledby="hwt-tab-effects">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'Effects', 'halloween-wt' ); ?></h2>
					<div class="hwt-effects">
						<?php
						foreach ( array_keys( Halloween_WT_Admin::effect_labels() ) as $halloween_wt_effect ) {
							$this->effect_card( $halloween_wt_effect );
						}
						?>
					</div>
				</section>

				<?php /* Interactive. */ ?>
				<section class="hwt-panel" id="hwt-panel-interactive" role="tabpanel" aria-labelledby="hwt-tab-interactive">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'Interactive objects', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->toggle(
							array( 'interactive', 'enabled' ),
							__( 'Enable interactive objects', 'halloween-wt' ),
							__( 'A few larger objects can be grabbed, thrown or tapped. Only their small grab zone reacts to the pointer – everything else on your site stays clickable.', 'halloween-wt' )
						);
						?>
						<div class="hwt-grid">
							<?php
							$this->toggle( array( 'interactive', 'pumpkins' ), __( 'Pumpkins can be dragged and thrown', 'halloween-wt' ) );
							$this->toggle( array( 'interactive', 'ghosts' ), __( 'Ghosts can be dragged and float away', 'halloween-wt' ) );
							$this->toggle( array( 'interactive', 'spiders' ), __( 'Spiders can be pulled and swing', 'halloween-wt' ) );
							$this->toggle( array( 'interactive', 'bats' ), __( 'Bats fly away when clicked', 'halloween-wt' ) );
							?>
						</div>
						<?php
						$this->range( array( 'interactive', 'max_objects' ), __( 'Maximum interactive objects', 'halloween-wt' ) );
						$this->radios(
							array( 'interactive', 'intensity' ),
							__( 'Interaction intensity', 'halloween-wt' ),
							array(
								'subtle'  => __( 'Subtle', 'halloween-wt' ),
								'normal'  => __( 'Normal', 'halloween-wt' ),
								'playful' => __( 'Playful', 'halloween-wt' ),
							),
							__( 'Controls how far objects can be thrown and how bouncy they are.', 'halloween-wt' )
						);
						?>
					</div>
				</section>

				<?php /* Display & schedule. */ ?>
				<section class="hwt-panel" id="hwt-panel-display" role="tabpanel" aria-labelledby="hwt-tab-display">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'Where to show effects', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->radios(
							array( 'display', 'mode' ),
							__( 'Show effects on', 'halloween-wt' ),
							array(
								'all'      => __( 'Entire website', 'halloween-wt' ),
								'home'     => __( 'Homepage only', 'halloween-wt' ),
								'selected' => __( 'Selected locations', 'halloween-wt' ),
							)
						);
						?>
						<div class="hwt-conditional" data-hwt-show-when="display-mode" data-hwt-value="selected">
							<?php
							$this->toggle( array( 'display', 'home' ), __( 'Homepage', 'halloween-wt' ) );
							$this->picker( array( 'display', 'pages' ), __( 'Selected pages', 'halloween-wt' ), 'page' );
							$this->picker( array( 'display', 'posts' ), __( 'Selected posts', 'halloween-wt' ), 'post' );
							$this->toggle(
								array( 'display', 'shop' ),
								__( 'WooCommerce shop and product categories', 'halloween-wt' ),
								__( 'Only applies when WooCommerce is active.', 'halloween-wt' )
							);
							$this->toggle(
								array( 'display', 'products' ),
								__( 'WooCommerce product pages', 'halloween-wt' ),
								__( 'Only applies when WooCommerce is active.', 'halloween-wt' )
							);
							?>
						</div>
					</div>
					<div class="hwt-card">
						<?php
						$this->picker(
							array( 'display', 'excluded' ),
							__( 'Never show on these pages or posts', 'halloween-wt' ),
							'page,post',
							__( 'Exclusions always win over the rules above.', 'halloween-wt' )
						);
						$this->toggle(
							array( 'display', 'exclude_commerce' ),
							__( 'Keep cart, checkout and account pages effect-free', 'halloween-wt' ),
							__( 'Recommended for shops so buying stays distraction-free.', 'halloween-wt' )
						);
						?>
					</div>

					<h2 class="hwt-panel__title"><?php esc_html_e( 'Schedule', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->radios(
							array( 'schedule', 'mode' ),
							__( 'Run effects', 'halloween-wt' ),
							array(
								'always' => __( 'Whenever enabled', 'halloween-wt' ),
								'range'  => __( 'Between dates', 'halloween-wt' ),
							)
						);
						?>
						<div class="hwt-conditional" data-hwt-show-when="schedule-mode" data-hwt-value="range">
							<div class="hwt-grid">
								<?php
								$this->date( array( 'schedule', 'start' ), __( 'Start date', 'halloween-wt' ) );
								$this->date( array( 'schedule', 'end' ), __( 'End date', 'halloween-wt' ) );
								?>
							</div>
							<?php
							$this->toggle(
								array( 'schedule', 'annual' ),
								__( 'Repeat every year', 'halloween-wt' ),
								__( 'Only the day and month are used, so the same dates work every season. Periods across New Year are supported.', 'halloween-wt' )
							);
							?>
							<p class="description">
								<?php
								printf(
									/* translators: %s: timezone name. */
									esc_html__( 'Dates use your site timezone (%s). Effects start at the beginning of the start date and stop at the end of the end date.', 'halloween-wt' ),
									esc_html( wp_timezone_string() )
								);
								?>
							</p>
						</div>
					</div>
				</section>

				<?php /* Mobile & accessibility. */ ?>
				<section class="hwt-panel" id="hwt-panel-devices" role="tabpanel" aria-labelledby="hwt-tab-devices">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'Mobile & tablets', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->toggle( array( 'mobile', 'enabled' ), __( 'Enable effects on mobile', 'halloween-wt' ) );
						$this->toggle(
							array( 'mobile', 'interactive' ),
							__( 'Enable interactive objects on mobile', 'halloween-wt' ),
							__( 'Touch devices show at most three interactive objects.', 'halloween-wt' )
						);
						$this->radios(
							array( 'mobile', 'density' ),
							__( 'Mobile density', 'halloween-wt' ),
							array(
								'low'    => __( 'Low', 'halloween-wt' ),
								'medium' => __( 'Medium', 'halloween-wt' ),
								'high'   => __( 'High', 'halloween-wt' ),
							),
							__( 'Phones and tablets always use reduced limits to protect battery and scrolling performance.', 'halloween-wt' )
						);
						?>
					</div>

					<h2 class="hwt-panel__title"><?php esc_html_e( 'Accessibility', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->toggle(
							array( 'accessibility', 'reduced_motion' ),
							__( 'Respect reduced motion preference', 'halloween-wt' ),
							__( 'Visitors who ask their device to reduce motion see only calm, static decoration (webs and fog). Strongly recommended.', 'halloween-wt' )
						);
						?>
						<p class="description">
							<?php esc_html_e( 'Effects are always hidden from screen readers, never receive keyboard focus, and are hidden when printing or in high-contrast mode.', 'halloween-wt' ); ?>
						</p>
					</div>
				</section>

				<?php /* Advanced. */ ?>
				<section class="hwt-panel" id="hwt-panel-advanced" role="tabpanel" aria-labelledby="hwt-tab-advanced">
					<h2 class="hwt-panel__title"><?php esc_html_e( 'Advanced', 'halloween-wt' ); ?></h2>
					<div class="hwt-card">
						<?php
						$this->number(
							array( 'advanced', 'z_index' ),
							__( 'Layer stacking order (z-index)', 'halloween-wt' ),
							__( 'Default 9990: above most page content and sticky headers, below most pop-ups, modals and cookie banners. The layer never blocks clicks, so this only affects what is drawn on top.', 'halloween-wt' )
						);
						?>
					</div>
				</section>

				<div class="hwt-submit">
					<?php submit_button( __( 'Save changes', 'halloween-wt' ), 'primary', 'submit', false ); ?>
				</div>
			</form>

			<form method="post" action="<?php echo esc_url( admin_url( 'admin-post.php' ) ); ?>" class="hwt-reset" data-confirm="<?php esc_attr_e( 'Reset all Halloween WT settings to their defaults?', 'halloween-wt' ); ?>">
				<input type="hidden" name="action" value="halloween_wt_reset_settings" />
				<?php wp_nonce_field( 'halloween_wt_reset_settings' ); ?>
				<button type="submit" class="button-link hwt-reset__button"><?php esc_html_e( 'Reset all settings to defaults', 'halloween-wt' ); ?></button>
			</form>

			<p class="description hwt-support">
				<?php esc_html_e( 'Enjoying Halloween WT? It is free and always will be.', 'halloween-wt' ); ?>
				<a href="<?php echo esc_url( Halloween_WT_Admin::SUPPORT_URL ); ?>" target="_blank" rel="noopener">
					<?php esc_html_e( '☕ Buy me a coffee', 'halloween-wt' ); ?>
					<span class="screen-reader-text"><?php esc_html_e( '(opens in a new tab)', 'halloween-wt' ); ?></span>
				</a>
			</p>
		</div>

		<aside class="hwt-layout__preview" aria-labelledby="hwt-preview-title">
			<div class="hwt-preview">
				<div class="hwt-preview__bar">
					<h2 id="hwt-preview-title" class="hwt-preview__title"><?php esc_html_e( 'Live preview', 'halloween-wt' ); ?></h2>
					<div class="hwt-preview__controls">
						<div class="hwt-segmented hwt-segmented--small" role="group" aria-label="<?php esc_attr_e( 'Preview device', 'halloween-wt' ); ?>">
							<button type="button" class="hwt-segmented__button is-active" data-hwt-device="desktop" aria-pressed="true"><?php esc_html_e( 'Desktop', 'halloween-wt' ); ?></button>
							<button type="button" class="hwt-segmented__button" data-hwt-device="mobile" aria-pressed="false"><?php esc_html_e( 'Mobile', 'halloween-wt' ); ?></button>
						</div>
						<button type="button" class="button hwt-preview__pause" aria-pressed="false"><?php esc_html_e( 'Pause', 'halloween-wt' ); ?></button>
					</div>
				</div>
				<div class="hwt-preview__stage-wrap">
					<div class="hwt-preview__stage" id="hwt-preview-stage">
						<div class="hwt-mock">
							<div class="hwt-mock__header">
								<span class="hwt-mock__logo"><?php esc_html_e( 'Your Site', 'halloween-wt' ); ?></span>
								<span class="hwt-mock__nav"><span></span><span></span><span></span></span>
							</div>
							<div class="hwt-mock__hero">
								<span class="hwt-mock__line hwt-mock__line--title"></span>
								<span class="hwt-mock__line"></span>
								<span class="hwt-mock__line hwt-mock__line--short"></span>
								<button type="button" class="button button-primary hwt-mock__button"><?php esc_html_e( 'Click me', 'halloween-wt' ); ?></button>
								<span class="hwt-mock__result" aria-live="polite"></span>
							</div>
							<div class="hwt-mock__cards"><span></span><span></span><span></span></div>
						</div>
					</div>
				</div>
				<p class="hwt-preview__note description" aria-live="polite"></p>
				<p class="description">
					<?php esc_html_e( 'The preview updates as you change settings, before saving. Try grabbing a pumpkin, and notice the button underneath stays clickable.', 'halloween-wt' ); ?>
				</p>
			</div>
		</aside>
	</div>
</div>
