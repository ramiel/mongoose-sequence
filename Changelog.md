# 3.2.0

- Add a static method to reset a counter

# 3.1.0

 - Refactored code
 - Improved jsdoc 
 - Add tests for `insertMany` and `create`

# 3.0.2

- Updated readme
    + added coverall badge
    + added installation instructions
    + some section have benn rewrote
- Updated dependencies

# 3.0.1

- Fixed tests for Travis-CI environment

# 3.0.0

- Fixed bug which prevent more than one counter to work on a collection
- When setNext is called the document is saved with the incremented field
    + This breaks the precedent behavior but is more natural and behave like the save pre-hook

# 2.0.0

- Updated mongoose dependecy to version 4.0.0
- Added coverage for tests
- Added linting

# 1.0.0

- Working version
