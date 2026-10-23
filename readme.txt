=== Halloween WT – Interactive Halloween Effects ===
Contributors: shahadat
Donate link: https://asamshahadat.gumroad.com/l/rueznx?wanted=true
Tags: halloween, animation, effects, seasonal, interactive
Requires at least: 6.3
Tested up to: 7.1
Requires PHP: 7.4
Stable tag: 1.0.0
License: GPLv2 or later
License URI: https://www.gnu.org/licenses/gpl-2.0.html

A dark, stormy, interactive Halloween atmosphere: lightning, rain, glowing eyes and pumpkins you can grab and throw. No theme edits.

== Description ==

Halloween WT adds a polished Halloween layer on top of your website – without editing your theme, templates, page builder layouts or content. Deactivate the plugin and your site is exactly as it was.

Your site sinks into a dark, stormy night: lightning cracks across the sky and lights up the gloom, rain streaks down, glowing eyes blink at the edges, and ghosts, bats, spiders, skulls and pumpkins drift through the fog. Then they discover the surprise: some objects can be **grabbed, dragged and thrown**. Pumpkins bounce and roll, ghosts float away, spiders swing on their threads and bats flee when clicked.

**Your website always comes first**

* The effect layer never blocks clicks, scrolling, typing, menus, sliders, forms or checkout. Only the small grab zone of a few interactive objects reacts to the pointer.
* Nothing is loaded at all when effects are off, scheduled for later, or excluded on the current page.
* If anything goes wrong in the animation, it quietly removes itself – the page keeps working.
* Animations pause while the browser tab is hidden and automatically reduce detail on slow devices.

**Effects**

* Atmosphere: darkness vignette, thunder & lightning with branching bolts, rain, storm clouds, fog and eyes in the dark.
* Creatures and decoration: pumpkins, bats, ghosts, spiders, spider webs, skulls, glowing embers and autumn leaves.
* Quantity, size, speed and opacity controls where they make sense.
* One-click presets: Subtle, Normal, Spooky and Insane (still performance-capped).

**Interactive objects**

* Drag and throw pumpkins with simple gravity, bounce and rolling.
* Drag ghosts – they glide and float back up.
* Pull spiders – they swing like a pendulum on their thread.
* Click or tap bats to scare them away.
* Works with mouse, touch and stylus (Pointer Events).

**Scheduling and targeting**

* Run whenever enabled, or between two dates – optionally repeating every year (e.g. October 20 – November 1).
* Entire site, homepage only, or selected pages, posts, WooCommerce shop and product pages.
* Exclude any page or post. Cart, checkout and account pages are kept effect-free by default.

**Live preview**

Try every setting in a live preview on the settings screen before saving, or preview on your real site (administrators only).

**Accessibility**

* Respects the visitor's "reduce motion" preference (on by default): only calm, static decoration (darkness, webs and fog) is shown – no lightning, rain or movement.
* Decoration is hidden from screen readers, never receives keyboard focus, and is hidden when printing or in high-contrast mode.
* Lightning is photosensitivity-safe: each strike is at most two flashes, strikes are at least 8 seconds apart, so there are never three or more flashes in any second.
* The darkness keeps the central reading area light; its strength is adjustable.

**Privacy**

Halloween WT does not collect, store or send any visitor data. It sets no cookies, makes no external requests and uses no third-party services. All artwork and code are bundled with the plugin.

== Installation ==

1. Upload the `halloween-wt` folder to `/wp-content/plugins/`, or install it from the Plugins screen.
2. Activate the plugin. Effects start immediately with the "Normal" preset.
3. Go to **Settings → Halloween WT** to choose effects, interaction, schedule and where effects appear.

== Frequently Asked Questions ==

= Will it slow down my site? =

Effects load only after your page has finished loading, are drawn on a single canvas, pause in background tabs and lower their detail automatically on slow devices. When effects are off nothing is loaded.

= Will it block my menus, buttons or checkout? =

No. The effect layer ignores the mouse and touch entirely. Only the small grab zone in the middle of a few interactive objects can be grabbed. Cart, checkout and account pages are effect-free by default.

= Does it work with my theme or page builder? =

Halloween WT does not depend on your theme. It works with block and classic themes and page builders such as Elementor, Divi, Beaver Builder and Bricks. Effects are automatically hidden inside page builder editors.

= I use a page caching plugin. What should I know? =

Cached pages keep whatever was cached. After changing settings, or when a schedule starts, clear your page cache. When a schedule ends, effects on stale cached pages stop by themselves.

= Something sits above the effects / the effects cover something =

Adjust the layer stacking order under **Settings → Halloween WT → Advanced**. The default works with most themes, sticky headers, pop-ups and cookie banners.

= Can I disable effects on a specific page? =

Yes – add it under **Display & schedule → Never show on these pages or posts**. Developers can also use the `halloween_wt_should_load` filter.

== Changelog ==

= 1.0.0 =
* Initial release.

== Upgrade Notice ==

= 1.0.0 =
Initial release.

== Credits ==

All artwork (pumpkins, bats, ghosts, spiders, webs, skulls and leaves) is original work created for this plugin and is released under the same license as the plugin (GPLv2 or later). The plugin uses no third-party libraries.
