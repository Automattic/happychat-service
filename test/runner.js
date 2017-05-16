#!/usr/bin/env node
/* eslint-disable */
'use strict';

// bypass this file if mocha is run directly on the test/ folder
if ( ! global.before ) {
	/**
	 * External dependencies
	 */
	const glob = require( 'glob' );
	const path = require( 'path' );
	const Mocha = require( 'mocha' );
	const program = require( 'commander' );
	const istanbul = require( 'istanbul' );
	const isEmpty = require( 'lodash/isEmpty' );
	const union = require( 'lodash/union' );
	const flatMap = require( 'lodash/flatMap' );

	require( 'babel-core/register' )( {
		presets: [ 'es2015' ],
		plugins: [ '__coverage__' ]
	} );

	/**
	 * Internal dependencies
	 */
	global.BASE_PATH = path.resolve( __dirname, '../' ) + '/';

	// Setup runner cli
	program
		.usage( '[options]' )
		.option( '-u, --ui <name>', 'specify the ui (mocha)', 'bdd' )
		.option( '-R, --reporter <name>', 'specify the reporter to use (mocha)', 'spec' )
		.option( '-c, --coverage', 'run coverage also (mocha)' );

	program.name = 'runner';
	program.parse( process.argv );

	const config = require( './runner.json' );
	const mocha = new Mocha( {
		ui: program.ui,
		reporter: program.reporter,
	} );
	const collector = new istanbul.Collector();
	const reporter = new istanbul.Reporter();

	if ( process.env.CIRCLECI ) {
		// give circle more time by default because containers are slow
		// why 10 seconds? a guess.
		mocha.suite.timeout( config.circleTimeout );
	}

	mocha.suite.beforeAll( () => null );
	mocha.suite.afterAll( () => null );

	const testFiles = union ( flatMap( config.testFiles, ( file ) => glob.sync( file ) ) );

	// add /test/files to mocha
	if ( ! isEmpty( testFiles ) ) {
		testFiles.forEach( ( file ) => mocha.addFile( file ) );

		// run tests
		const runner = mocha.run( ( failures ) => {
			// before exiting, print coverage report
			if ( program.coverage ) {
				collector.add( global.__coverage__ );
				reporter.write( 'asd', true );
				reporter.addAll( [ 'text-summary', 'json', 'html' ] );
				reporter.write( collector, true, () => {
					console.log( '================================================================================' );
					console.log( `Writing coverage object [${ global.BASE_PATH }/coverage/coverage.json]` );
					console.log( `Writing coverage reports at [${ global.BASE_PATH }/coverage]` );
					console.log( '================================================================================' );
				} );
				process.on( 'exit', () => process.exit( failures ) );
			}
		} );

		// force exit if reporter is not watch
		runner.on( 'end', ( status ) => {
			if ( ! program.reporter || 'min' !== program.reporter ) {
				process.exit( status );
			}
		} );
	}
}
