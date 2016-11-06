export default () => {
	const middlewares = []
	const external = {
		middleware: ( middleware ) => {
			if ( middleware.length >= 2 ) {
				middlewares.push( ( ... args ) => new Promise( resolve => middleware( ... args.concat( resolve ) ) ) )
			} else {
				middlewares.push( middleware )
			}
			return external
		}
	}
	return {
		middlewares: () => middlewares,
		external
	}
}
