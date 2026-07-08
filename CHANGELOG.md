# Changelog

All notable changes to the **Storage Hunters: Open World Mutation Calculator** will be documented in this file.

## [0.3.4] - 2026-07-08

### Added

* Added **Low Items Markup** factor display in the result panel.

### Changed

* Updated calculation logic to support the low items markup.
* Updated the rounding to display identical values to ROBLOX/LUA
* Cleaned up the code a bit

## [0.3.3] - 2026-07-05

### Added

* Added a live Wiki-powered item index that loads item data directly from [`Module:ItemData`](https://storagehunters.fandom.com/wiki/Module:ItemData).
* Added item search by item name and area filters for Junk Yard, Back Alley, Farmyard, Shipyard, Cargo, Lost, and Exclusive.
* Added selectable item cards that automatically load the item base value into the calculator.
* Added active mutation display below the mutation multiplier in the result panel.
* Added styled image export for **Copy Result** with selected item, value stats, and active mutations.

### Changed

* Updated Copy Result output to use a cleaner layout.
* Updated active mutation sorting so **Dirty** is always shown first, followed by highest to lowest multiplier like Ingame.
* Renamed the manual value input and result image stat label to **Custom Value** where appropriate.
* Improved typography, spacing, sticky index behavior, and overall visual consistency.

### Fixed

* Improved visibility for dark mutation styles such as Moonlit, Void, Dirty, Corrupted, and Black.

## [0.3.2] - 2026-07-04

### Changed

* Updated the mutation list to match the current multiplier values.
* Changed the **Pure** mutation multiplier to `1.875x`.
* Changed the **Spotless** mutation multiplier to `3.125x`.
* Added the **Black** mutation as `Unobtainable`.
* Renamed **Base Value ($)** to **Value ($)**.
* Added links to the changelog version and GitHub icon in the footer.
* Updated creator and repository links after the GitHub username change to **Vantacry**.
* Updated the README with the new GitHub Pages calculator link and creator profile.

## [0.3.1] - 2026-07-01

### Changed

* Updated the **Pure** mutation multiplier from a fixed `1.5x` to a range of `1.5x - 2x`.
* Selected mutations are now displayed immediately after selection.
* Selected mutations are now sorted by multiplier size, similar to the in-game order.
* Improved the calculator layout with general visual and usability adjustments.

## [0.3.0] - Initial Release

### Added

* First public release of the Storage Hunters Open World Mutation Calculator.
* Added support for base value, condition, grade, and mutation multipliers.
* Added mutation selection and final value calculation.
* Added a clean layout for sharing and using the calculator more easily.
