# Changelog

## 5.3.0
  - Allow a counter to be shared setting `exclusive=false`

## 5.2.2
  - Allow nested fields as counters. Thanks @ManoelLobo

## 5.2.1
  - Fix counter reset. It now works even with a custom start value. Thanks to @leeqiang

## 5.2.0
  - Completely change code style
    - Using jest for tests,
    - Adding eslint
    - Moving to more modern JS when possible
  - Add support for sequential hooks.
    The default behavior is to have them as parallel but an option can be set to increment the
    counter sequentially while saving a document. Thanks to `@Artem Kobets`.
  - Add custom start value and increment amount. Thanks to `@Pr0Sh00t3r`.

## 5.1.0
  - Use connection instad of mongoose library
  - Fix: updated dependencies

## 5.0.0
  - Fix scoped counter reset

## 4.0.0

  - Fix: Do not hang on save in production anymore
  - Add `yarn.lock`
  - Add package-lock.json

## 3.2.1

  - Adds donate button

## 3.2.0

  - Add a static method to reset a counter

## 3.1.0

  - Refactored code
  - Improved jsdoc 
  - Add tests for `insertMany` and `create`

## 3.0.2

  - Updated readme
    + added coverall badge
    + added installation instructions
    + some section have benn rewrote
  - Updated dependencies

## 3.0.1

  - Fixed tests for Travis-CI environment

## 3.0.0

  - Fixed bug which prevent more than one counter to work on a collection
  - When setNext is called the document is saved with the incremented field
  + This breaks the precedent behavior but is more natural and behave like the save pre-hook

## 2.0.0

  - Updated mongoose dependecy to version 4.0.0
  - Added coverage for tests
  - Added linting

## 1.0.0

  - Working version
