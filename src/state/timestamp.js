/* *
 * Utility method for consistent unix timestamps to the second (not millisecond)
 */
export default () => (
	Math.ceil( ( new Date() ).getTime() / 1000 )
)
