## Mocha test runner
`runner.js` is a [mocha](https://www.npmjs.com/package/mocha) test runner that makes use of [glob](https://www.npmjs.com/package/glob) package patterns. It has support for [istanbul](https://www.npmjs.com/package/istanbul) coverage and also works with `babel`

This will load `test/integraion` and also search `src/` for `test/` subfolders.

### Configuration
This script uses `runner.json` as a configuration file.
| Field | Description |
| --- | --- |
| `circleTimeout` | Timeout in MS to help circleCI vm to boot |
| `testFiles` | Array of `glob` patterns to find the test files |


### How to use
```
# for help
babel-node ./runner.js --help"

# regular use
babel-node ./runner.js"

# enable coverage
babel-node ./runner.js --coverage"

# change mocha ui
babel-node ./runner.js --ui tdd"

# change mocha reporter
babel-node ./runner.js --reporter min"

# all in one
babel-node .	/runner.js --ui bdd --reporter min --coverage"
```