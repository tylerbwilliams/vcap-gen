
// Only works with error-first callback
export default function promisify( action ) {
	return new Promise(( resolve, reject )=> {
		action(function( err/*, ... args */) {
			if ( err ) return reject( err );
			const allArgs = [].slice.call( arguments );
			const args = allArgs.slice( 1 );
			resolve.apply( null, args );
		});
	});
}
