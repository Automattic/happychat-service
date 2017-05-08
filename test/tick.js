export const tick = ( fn ) => ( ... args ) => process.nextTick( () => fn( ... args ) )
