/* 
 * This is a list of servers to use for backend calls.
 * This was specifically added to bypass the browser limitation
 * in the number of ajax requests that can be made.
 *
 * It can be a list of cname's to the server as well.
 */
CONN_POOL_CFG = {
	urls: [
	"http://metdev1.lcl:8000",
	"http://metdev2.lcl:8000",
	"http://metdev3.lcl:8000"
	]
};