<?php
/**
 * Seasonal scheduling.
 *
 * Schedules are evaluated on each request in the site's timezone, so no
 * cron events are needed.
 *
 * @package HalloweenWT
 */

defined( 'ABSPATH' ) || exit;

/**
 * Computes schedule windows and status.
 */
final class Halloween_WT_Scheduler {

	/**
	 * Returns the relevant schedule window.
	 *
	 * For yearly schedules this is the window containing "now", or the next
	 * upcoming one. Windows may span the new year (e.g. Dec 20 – Jan 5).
	 *
	 * @param array                  $schedule Schedule settings.
	 * @param DateTimeImmutable|null $now      Current time (for testing).
	 * @return array|false|null Array with "start"/"end" DateTimeImmutable,
	 *                          null when no schedule applies, false when
	 *                          the schedule is invalid.
	 */
	public static function get_window( array $schedule, $now = null ) {
		if ( 'range' !== $schedule['mode'] ) {
			return null;
		}

		$tz    = wp_timezone();
		$now   = $now instanceof DateTimeImmutable ? $now : new DateTimeImmutable( 'now', $tz );
		$start = self::parse( $schedule['start'] );
		$end   = self::parse( $schedule['end'] );

		if ( ! $start || ! $end ) {
			return false;
		}

		if ( empty( $schedule['annual'] ) ) {
			$from = self::make( $start[0], $start[1], $start[2], false, $tz );
			$to   = self::make( $end[0], $end[1], $end[2], true, $tz );
			return $from <= $to ? array(
				'start' => $from,
				'end'   => $to,
			) : false;
		}

		$wraps = array( $end[1], $end[2] ) < array( $start[1], $start[2] );
		$year  = (int) $now->format( 'Y' );

		foreach ( array( $year - 1, $year, $year + 1 ) as $y ) {
			$from = self::make( $y, $start[1], $start[2], false, $tz );
			$to   = self::make( $wraps ? $y + 1 : $y, $end[1], $end[2], true, $tz );

			if ( $to >= $now ) {
				return array(
					'start' => $from,
					'end'   => $to,
				);
			}
		}

		return false;
	}

	/**
	 * Whether the schedule currently allows effects.
	 *
	 * @param array                  $schedule Schedule settings.
	 * @param DateTimeImmutable|null $now      Current time (for testing).
	 * @return bool
	 */
	public static function is_active( array $schedule, $now = null ) {
		$tz     = wp_timezone();
		$now    = $now instanceof DateTimeImmutable ? $now : new DateTimeImmutable( 'now', $tz );
		$window = self::get_window( $schedule, $now );

		if ( null === $window ) {
			return true;
		}

		if ( false === $window ) {
			return false;
		}

		return $window['start'] <= $now && $now <= $window['end'];
	}

	/**
	 * Human-oriented status used on the settings screen.
	 *
	 * @param array $settings Full settings.
	 * @return array {
	 *     @type string                 $state One of off, live, scheduled, ended, invalid.
	 *     @type DateTimeImmutable|null $start Window start.
	 *     @type DateTimeImmutable|null $end   Window end.
	 * }
	 */
	public static function status( array $settings ) {
		$result = array(
			'state' => 'live',
			'start' => null,
			'end'   => null,
		);

		if ( empty( $settings['general']['enabled'] ) ) {
			$result['state'] = 'off';
			return $result;
		}

		$now    = new DateTimeImmutable( 'now', wp_timezone() );
		$window = self::get_window( $settings['schedule'], $now );

		if ( null === $window ) {
			return $result;
		}

		if ( false === $window ) {
			$result['state'] = 'invalid';
			return $result;
		}

		$result['start'] = $window['start'];
		$result['end']   = $window['end'];

		if ( $now < $window['start'] ) {
			$result['state'] = 'scheduled';
		} elseif ( $now > $window['end'] ) {
			$result['state'] = 'ended';
		}

		return $result;
	}

	/**
	 * Parses a Y-m-d string.
	 *
	 * @param string $date Date.
	 * @return int[]|null Year, month, day.
	 */
	private static function parse( $date ) {
		if ( ! is_string( $date ) || ! preg_match( '/^(\d{4})-(\d{2})-(\d{2})$/', $date, $m ) ) {
			return null;
		}
		return array( (int) $m[1], (int) $m[2], (int) $m[3] );
	}

	/**
	 * Builds a date, clamping the day to the month length (Feb 29 in
	 * non-leap years becomes Feb 28).
	 *
	 * @param int          $year       Year.
	 * @param int          $month      Month.
	 * @param int          $day        Day.
	 * @param bool         $end_of_day Use 23:59:59 instead of 00:00:00.
	 * @param DateTimeZone $tz         Timezone.
	 * @return DateTimeImmutable
	 */
	private static function make( $year, $month, $day, $end_of_day, DateTimeZone $tz ) {
		$first = new DateTimeImmutable( sprintf( '%04d-%02d-01 00:00:00', $year, $month ), $tz );
		$day   = min( $day, (int) $first->format( 't' ) );
		$date  = $first->setDate( $year, $month, $day );

		return $end_of_day ? $date->setTime( 23, 59, 59 ) : $date;
	}
}
