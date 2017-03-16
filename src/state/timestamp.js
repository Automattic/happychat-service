/* *
 * Utility method for consistent unix timestamps to the second (not millisecond)
 */
export default () => (
	Math.ceil( Date.now() / 1000 )
)
