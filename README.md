<div align="center">

# 🎃 Halloween WT - Interactive Halloween Effects

**Turn any WordPress site into a dark, stormy Halloween night - in one click.**

Lightning, rain, glowing eyes, fog, ghosts, bats, spiders and pumpkins your visitors can **grab and throw**.
No theme edits. No page builder changes. Deactivate it and your site is exactly as it was.

![WordPress](https://img.shields.io/badge/WordPress-6.3%2B-21759b?logo=wordpress&logoColor=white)
![PHP](https://img.shields.io/badge/PHP-7.4%2B-777bb4?logo=php&logoColor=white)
![License](https://img.shields.io/badge/License-GPLv2%2B-green)
![Dependencies](https://img.shields.io/badge/dependencies-none-brightgreen)
![Price](https://img.shields.io/badge/price-free-orange)

[**⬇️ Download**](#-installation) · [**✨ Features**](#-features) · [**❓ FAQ**](#-faq) · [**☕ Buy me a coffee**](https://asamshahadat.gumroad.com/l/rueznx?wanted=true)

</div>

---

## 👻 What is it?

Halloween WT adds a polished, seasonal effect layer **on top of** your website. Your site sinks into a spooky night: lightning cracks across the sky, rain streaks down, glowing eyes blink at the edges, and ghosts, bats, spiders, skulls and pumpkins drift through the fog.

Then visitors discover the surprise - some of those objects are **alive**:

| Object | What happens when you touch it |
| --- | --- |
| 🎃 **Pumpkins** | Grab, drag and **throw** them - they fall with gravity, bounce and roll |
| 👻 **Ghosts** | Drag them around - they glide, then float gently back up |
| 🕷️ **Spiders** | Pull them - they swing like a pendulum on their silk thread |
| 🦇 **Bats** | Click or tap - they get scared and flee |

Works with **mouse, touch and stylus**.

> **Your website always comes first.** The effect layer never blocks clicks, scrolling, typing, menus, sliders, forms or checkout. Only the tiny grab zone in the middle of a few interactive objects reacts to the pointer.

---

## ✨ Features

### 🌩️ 14 effects

| Atmosphere | Creatures & decoration |
| --- | --- |
| 🌑 Darkness vignette (reading area stays light) | 🎃 Glowing jack-o'-lanterns |
| ⚡ Thunder & branching lightning bolts | 🦇 Bats on wavy flight paths |
| 🌧️ Slanted storm rain | 👻 Translucent friendly ghosts |
| ☁️ Storm clouds | 🕷️ Spiders on silk threads |
| 🌫️ Low fog (custom color) | 🕸️ Corner spider webs |
| 👀 Glowing eyes in the dark | 💀 Tumbling skulls |
| ✨ Rising glowing embers | 🍂 Maple, oak & elm autumn leaves |

Every effect can be switched on/off and tuned with **quantity, size, speed, opacity, intensity and color** controls where they make sense.

### 🎚️ One-click presets

| Preset | Mood |
| --- | --- |
| **Subtle** | Light touch - pumpkins, leaves, webs, soft fog. No lightning or rain. |
| **Normal** *(default)* | The full stormy night, balanced. |
| **Spooky** | Darker, more creatures, heavier rain and fog. |
| **Insane** | Everything maxed out - still performance-capped. |

Pick a preset, then fine-tune anything you like.

### 👁️ Live preview before you save

The settings screen has a **live preview** with a desktop/mobile toggle. Every slider updates the preview instantly - grab a pumpkin and notice that the button underneath is still clickable. Administrators can also **preview on the real site** before going live.

### 📅 Scheduling

* Run whenever enabled, **or** between two dates
* **Repeat every year** (e.g. October 20 - November 1) - set it once, forget it forever
* Date ranges can span the new year
* Uses your site's timezone, no cron jobs needed

### 🎯 Targeting

* Entire site, homepage only, or **selected** pages / posts
* WooCommerce **shop** and **product** pages support
* Exclude any page or post
* **Cart, checkout and account pages are effect-free by default** - your sales are never disturbed

### 📱 Mobile friendly

* Enable/disable effects and interaction separately on mobile
* Low / Medium / High mobile density
* Phones and tablets always use reduced limits to protect battery and scrolling

---

## ⚡ Performance

* **Zero cost when off** - nothing is loaded when effects are disabled, scheduled for later, or excluded on the current page.
* Scripts load **deferred**, after your page has finished loading.
* Everything is drawn on a **single canvas**; SVG artwork is rasterised once and reused.
* Slow layers (fog, darkness) repaint at ~15 fps; frame rate is capped on 120/144 Hz screens to save battery.
* Animations **pause** while the browser tab is hidden.
* Detail is **automatically reduced** on slow devices.
* **Self-healing:** if anything goes wrong in the animation, the layer quietly removes itself - the page keeps working.

## ♿ Accessibility

* Respects the visitor's **"reduce motion"** setting (on by default) - only calm, static decoration is shown.
* **Photosensitivity-safe lightning:** max two flashes per strike, strikes at least 8 seconds apart - never three or more flashes in a second.
* Decoration is hidden from screen readers, never receives keyboard focus, and is hidden when printing or in high-contrast mode.

## 🔒 Privacy

Halloween WT **does not collect, store or send any visitor data**. No cookies, no external requests, no third-party services, no tracking. All artwork and code are bundled with the plugin.

## 🧩 Compatibility

Works with block and classic themes and page builders such as **Elementor, Divi, Beaver Builder and Bricks**. Effects are automatically hidden inside page builder editors so they never get in the way of editing. Multisite compatible.

---

## 📦 Installation

### Option 1 - Upload ZIP (easiest)

1. Download the latest ZIP from the [**Releases**](../../releases) page (or click **Code → Download ZIP** above).
2. In WordPress go to **Plugins → Add New → Upload Plugin**.
3. Choose the ZIP file, click **Install Now**, then **Activate**.

### Option 2 - Manual

1. Unzip and copy the `halloween-wt` folder into `/wp-content/plugins/`.
2. Activate **Halloween WT** from the **Plugins** screen.

### Then

Effects start immediately with the **Normal** preset. Go to **Settings → Halloween WT** to pick effects, interaction, schedule and where effects appear.

**Requirements:** WordPress 6.3+ · PHP 7.4+

---

## ❓ FAQ

<details>
<summary><b>Will it slow down my site?</b></summary>

Effects load only after your page has finished loading, are drawn on a single canvas, pause in background tabs and lower their detail automatically on slow devices. When effects are off, nothing is loaded at all.
</details>

<details>
<summary><b>Will it block my menus, buttons or checkout?</b></summary>

No. The effect layer ignores the mouse and touch entirely. Only the small grab zone in the middle of a few interactive objects can be grabbed. Cart, checkout and account pages are effect-free by default.
</details>

<details>
<summary><b>Does it work with my theme or page builder?</b></summary>

Yes. Halloween WT does not depend on your theme. It works with block and classic themes and with Elementor, Divi, Beaver Builder and Bricks. Effects are automatically hidden inside page builder editors.
</details>

<details>
<summary><b>I use a page caching plugin. What should I know?</b></summary>

After changing settings, or when a schedule starts, clear your page cache. When a schedule ends, effects on stale cached pages stop by themselves.
</details>

<details>
<summary><b>Something sits above the effects / the effects cover something</b></summary>

Adjust the layer stacking order under **Settings → Halloween WT → Advanced**. The default (`9990`) works with most themes, sticky headers, pop-ups and cookie banners.
</details>

<details>
<summary><b>Can I disable effects on a specific page?</b></summary>

Yes - add it under **Display & schedule → Never show on these pages or posts**. Developers can also use the `halloween_wt_should_load` filter (see below).
</details>

<details>
<summary><b>What happens when I uninstall it?</b></summary>

Deactivating leaves your site exactly as it was. Deleting the plugin removes its single settings option (on every site in a multisite network) and nothing else.
</details>

---

## 🛠️ For developers

Control loading with the `halloween_wt_should_load` filter:

```php
// Example: never show effects to logged-in users.
add_filter( 'halloween_wt_should_load', function ( $load, $settings ) {
	return is_user_logged_in() ? false : $load;
}, 10, 2 );
```

**Project structure**

```
halloween-wt/
├── halloween-wt.php              # Plugin bootstrap
├── includes/
│   ├── class-halloween-wt-settings.php       # Schema, defaults, presets, sanitising
│   ├── class-halloween-wt-scheduler.php      # Date windows (yearly, cross-year)
│   ├── class-halloween-wt-display-rules.php  # Where effects appear
│   ├── class-halloween-wt-frontend.php       # Conditional asset loading
│   ├── class-halloween-wt-admin.php          # Settings screen
│   └── views/settings-page.php
├── assets/
│   ├── js/engine.js       # Theme-agnostic canvas + drag/throw physics engine
│   ├── js/halloween.js    # Halloween effect pack
│   ├── js/admin.js        # Settings UI + live preview
│   └── images/*.svg       # Original artwork
└── languages/halloween-wt.pot    # Translation ready
```

* Zero third-party libraries, zero build step.
* All settings stored in one option: `halloween_wt_settings`.
* Fully translatable (text domain `halloween-wt`).

---

## ☕ Support the project

Halloween WT is **free** and always will be. If it made your site a little more fun this October, you can say thanks by buying me a coffee - it keeps the updates (and the pumpkins) coming. 🎃

<div align="center">

### [☕ Buy me a coffee](https://asamshahadat.gumroad.com/l/rueznx?wanted=true)

⭐ **Star this repo** if you like it - and share it with a friend who runs a WordPress site!

</div>

Found a bug or have an idea? [Open an issue](../../issues).

---

## 📄 License

Released under the [GNU General Public License v2.0 or later](LICENSE).
All artwork (pumpkins, bats, ghosts, spiders, webs, skulls and leaves) is original work created for this plugin and released under the same license.

Made with 🧡 by **[Shahadat](https://shahadatdev.com/)**
